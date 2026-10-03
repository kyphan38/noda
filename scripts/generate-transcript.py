#!/usr/bin/env python3
"""
============================================
NODA TRANSCRIPT GENERATOR
============================================
Copy tu ~/Downloads/main/converted_script.py, chinh cho quy trinh noda.

Backend  : mlx-whisper (Apple Silicon)
Model    : whisper-large-v3 (mac dinh). Da thu turbo tren video 43 phut:
           bia chu o doan nhac mo dau + bo mat loi lap that, chi nhanh
           hon ~2-3 phut. Van thu duoc bang --model.
Alignment: stable-ts / faster-whisper large-v3 (forced alignment,
           LUON BAT - tat di gio se lech). Tu nao lech > 1s so voi gio
           goc cua Whisper thi lay gio goc (xem _guard_refined_words).
Language : English
SRT mode : word-level timestamps (refined)
           fallback: proportional split
Filters  : context-aware hallucination filter (chi cat dong rac,
           KHONG cat tu theo diem - mat chu te hon lech gio)
Splitting: hybrid (punctuation -> clause -> max words, 14 tu/dong)

Khac ban goc:
  1. normalize_audio: backup *_orig_backup TRUOC, ghi ra file tam, chi
     doi ten khi ffmpeg thanh cong. Da co backup = da normalize -> bo qua
     (khong ma hoa lai mp3 moi lan chay).
  2. extract_wav: that bai in loi ffmpeg that (khong giu kin nua).
  3. Giu JSON canh file .srt: X.whisper.json (gio goc) + X.refined.json
     (gio stable-ts). --from-json X.whisper.json cat cau lai trong vai
     giay, khong chay lai whisper/stable-ts. --clean-json de xoa.
  4. validate_srt_timing: phat hien dong de gio nhau (prev_end_ms).
  5. Kep end >= start + 200ms nhung KHONG vuot start cau sau.
  6. Bo dong khong co chu cai/so nao (vd "!" - rac cua Whisper).
  7. Chan stable-ts keo dai tu qua khoang lang/nhac (lech 1-15s).
  8. --model de doi model tu dong lenh.
============================================
"""

import argparse
import difflib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


# ── Config ────────────────────────────────────────────────────────────────────

MLX_MODEL = "mlx-community/whisper-large-v3-mlx"
STABLE_TS_MODEL = "large-v3"
INITIAL_PROMPT = ""

PREPEND_PUNCTUATIONS = "\"'¿([{-"
APPEND_PUNCTUATIONS  = "\"'.,。，!！?？:：\")]}、"
SENTENCE_END_CHARS   = {'.', '!', '?'}
CLAUSE_SPLIT_CHARS   = {',', ';', ':', '–', '—'}
CLAUSE_CONJUNCTIONS  = {
    "and", "but", "or", "so", "yet", "because", "although", "though",
    "while", "when", "where", "which", "who", "that", "if", "since",
    "unless", "before", "after", "until",
}

MAX_WORDS_PER_BLOCK    = 14
MIN_WORDS_PER_BLOCK    = 3
SILENCE_GAP_THRESHOLD  = 2.0
END_PADDING_MS         = 150  # buffer after last word's Whisper end timestamp.
                             # GIU NGUYEN 150: noda dung audio o end - 0.03s,
                             # giam xuong de cat mat duoi cau (xem giai thich
                             # trong plan). Noi nhanh thi end da bi kep vao
                             # start cau sau nen padding khong anh huong.
MIN_BLOCK_MS           = 200  # block nao ngan hon thi keo dai end ra
MIN_LINE_WPS           = 1.0  # lines below this words/sec are likely hallucinations
REFINE_MAX_DRIFT_S     = 1.0  # stable-ts lech hon muc nay so voi Whisper goc -> lay gio goc.
                             # Do tren video 43 phut: median lech 0s, p95 ~0.4s;
                             # ~4% dong lech 1-15s (stable-ts nuot khoang lang/nhac).


# ── Hallucination patterns (two tiers) ────────────────────────────────────────

ALWAYS_FILTER_PATTERNS = [
    # TV / media boilerplate
    r"copyright",
    r"www\.",
    r"\.com\b",
    r"\.net\b",
    r"\.org\b",
    # YouTube-style filler
    r"subscribe",
    r"please\s+subscribe",
    r"don'?t\s+forget\s+to",
    r"hit\s+the\s+(bell|like)",
    r"smash\s+that\s+(like|subscribe)",
    r"ring\s+the\s+bell",
    # Music / sound markers
    r"♪", r"🎵",
    r"\[music\]",
    r"\[applause\]",
    r"\[laughter\]",
]

SUSPECT_FILTER_PATTERNS = [
    # Real phrases Whisper hallucinates during silence
    r"^thank(s|\s+you)\s+for\s+(watching|listening|tuning\s+in)",
    r"^see\s+you\s+(next\s+time|soon|in\s+the\s+next)",
    r"^(bye|goodbye)\s*(for\s+now)?\.?$",
    r"^thanks\s+for\s+joining",
    r"^stay\s+tuned",
    r"^like\s+and\s+subscribe",
    r"^please\s+like",
    r"^leave\s+a\s+comment",
    r"^if\s+you\s+enjoyed",
]

_ALWAYS_RE  = re.compile("|".join(ALWAYS_FILTER_PATTERNS),  re.IGNORECASE)
_SUSPECT_RE = re.compile("|".join(SUSPECT_FILTER_PATTERNS), re.IGNORECASE)


def _is_prompt_leakage(text: str, prompt: str) -> bool:
    """Detect if transcribed text was hallucinated from the initial prompt."""
    if not prompt:
        return False
    clean = lambda s: re.sub(r'[^\w\s]', '', s.lower()).split()
    text_words = clean(text)
    prompt_words = clean(prompt)
    if len(text_words) < 3 or not prompt_words:
        return False
    prompt_str = ' '.join(prompt_words)
    text_str = ' '.join(text_words)
    if text_str in prompt_str:
        return True
    overlap = sum(1 for w in text_words if w in prompt_words)
    return overlap / len(text_words) >= 0.8


# ── Timestamp helpers ─────────────────────────────────────────────────────────

def ms_to_ts(ms: float) -> str:
    ms = max(0.0, ms)
    t  = int(round(ms))
    h, t = divmod(t, 3_600_000)
    m, t = divmod(t, 60_000)
    s, t = divmod(t, 1_000)
    return f"{h:02}:{m:02}:{s:02},{t:03}"

def sec_to_ms(sec: float) -> float:
    return float(sec) * 1000.0

def ts_to_ms(ts: str) -> int:
    h, m, rest = ts.strip().split(":")
    s, ms = rest.split(",")
    return int(h)*3_600_000 + int(m)*60_000 + int(s)*1_000 + int(ms)


# ── Segment-level filtering ──────────────────────────────────────────────────

def filter_segments(segments: list[dict]) -> list[dict]:
    if not segments:
        return segments

    kept    = []
    removed = 0

    for i, seg in enumerate(segments):
        text = seg.get("text", "").strip()
        if not text:
            removed += 1
            continue

        start = float(seg.get("start", 0))
        end   = float(seg.get("end",   0))
        dur   = end - start

        # Tier 0: initial prompt leakage
        if _is_prompt_leakage(text, INITIAL_PROMPT):
            print(f"   🧹  Filtered prompt leakage: \"{text[:60]}\"")
            removed += 1
            continue

        # Tier 1: always filter
        if _ALWAYS_RE.search(text):
            removed += 1
            continue

        # Tier 2: only filter if context is suspicious
        if _SUSPECT_RE.search(text):
            is_last      = (i == len(segments) - 1)
            is_near_last = (i >= len(segments) - 2)
            is_short     = (dur < 3.0)

            gap_before = 0.0
            if i > 0:
                prev_end   = float(segments[i - 1].get("end", 0))
                gap_before = start - prev_end

            suspicious = (
                (is_last and is_short) or
                (is_near_last and gap_before > SILENCE_GAP_THRESHOLD * 2) or
                (is_short and gap_before > SILENCE_GAP_THRESHOLD * 2)
            )

            if suspicious:
                removed += 1
                continue

        # Tier 3: suspiciously slow speaking rate (hallucination during silence)
        seg_words = text.split()
        if len(seg_words) > 2 and dur > 0 and len(seg_words) / dur < MIN_LINE_WPS:
            print(f"   🧹  Filtered slow segment ({len(seg_words)/dur:.1f} wps): \"{text[:60]}\"")
            removed += 1
            continue

        kept.append(seg)

    if removed:
        print(f"   🧹  Filtered {removed} hallucinated segment(s)")

    return kept


# ── Word extraction + dedup ───────────────────────────────────────────────────

def extract_words(json_path: Path) -> list[dict]:
    data = json.loads(json_path.read_text(encoding="utf-8"))
    raw_segments = data.get("segments", [])
    clean_segments = filter_segments(raw_segments)

    words = []
    for seg in clean_segments:
        for w in seg.get("words", []):
            word  = w.get("word", "").strip()
            if not word:
                continue
            start = float(w.get("start") or seg.get("start", 0))
            end   = float(w.get("end")   or seg.get("end",   0))
            words.append({"word": word, "start": start, "end": end})

    return words


def dedupe_words(words: list[dict]) -> list[dict]:
    result  = []
    removed = 0

    for w in words:
        duration = w["end"] - w["start"]

        if duration < 0:
            removed += 1
            continue

        if duration == 0:
            w = {**w, "end": w["start"] + 0.001}

        if (result
                and result[-1]["word"].lower() == w["word"].lower()
                and abs(result[-1]["start"] - w["start"]) < 0.1):
            removed += 1
            continue

        result.append(w)

    if removed:
        print(f"   🧹  Removed {removed} zero-duration/duplicate word(s)")

    return result


def filter_tail_silence(words: list[dict]) -> list[dict]:
    if len(words) < 2:
        return words

    for i in range(len(words) - 1, 0, -1):
        gap = words[i]["start"] - words[i - 1]["end"]
        if gap > SILENCE_GAP_THRESHOLD * 2:
            tail_duration = words[-1]["end"] - words[i]["start"]
            if tail_duration < 3.0:
                removed_text = " ".join(w["word"] for w in words[i:])
                print(f"   🧹  Removed trailing: \"{removed_text}\"")
                return words[:i]

    return words


def _norm_word(word: str) -> str:
    return re.sub(r"[^\w']", "", word.lower())


def _guard_refined_words(refined: list[dict], raw: list[dict]) -> list[dict]:
    """Lay gio goc cua Whisper cho tu nao stable-ts lech qua REFINE_MAX_DRIFT_S.

    stable-ts doi khi keo dai tu dau/cuoi cau qua khoang lang hoac nhac nen
    (vd "Being up here..." bi dat som 10s). Trong noda, cau do highlight som
    va dictation phai nghe 10s im lang. Gio goc cua Whisper o nhung cho nay
    dung hon; 96% tu con lai van giu gio stable-ts.
    """
    if not raw:
        return refined
    a  = [_norm_word(w["word"]) for w in refined]
    b  = [_norm_word(w["word"]) for w in raw]
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)

    out   = [dict(w) for w in refined]
    fixed = 0
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            r, g = out[blk.a + k], raw[blk.b + k]
            start_off = abs(r["start"] - g["start"]) > REFINE_MAX_DRIFT_S
            end_off   = abs(r["end"]   - g["end"])   > REFINE_MAX_DRIFT_S
            if not (start_off or end_off):
                continue
            if start_off:
                r["start"] = g["start"]
            if end_off:
                r["end"] = g["end"]
            # Chi sua 1 dau ma lam tu hong (end <= start) -> lay ca 2 dau goc.
            if r["end"] <= r["start"]:
                r["start"], r["end"] = g["start"], g["end"]
            fixed += 1

    if fixed:
        print(f"   🛡  Restored Whisper timing for {fixed} word(s) stable-ts moved > {REFINE_MAX_DRIFT_S:.0f}s")
    return out


def _has_text(text: str) -> bool:
    """Dong chi co dau cau (vd "!") la rac cua Whisper, noda khong nen hien."""
    return bool(re.search(r"[^\W_]", text))


def extract_segments_fallback(json_path: Path) -> list[dict]:
    data = json.loads(json_path.read_text(encoding="utf-8"))
    raw  = data.get("segments", [])
    clean = filter_segments(raw)
    segs = []
    for seg in clean:
        text = seg.get("text", "").strip()
        dur  = float(seg.get("end", 0)) - float(seg.get("start", 0))
        if text and _has_text(text) and dur > 0:
            segs.append({
                "text":  text,
                "start": float(seg.get("start", 0)),
                "end":   float(seg.get("end",   0)),
            })
    return segs



# ── Hybrid line splitting ────────────────────────────────────────────────────
#
# Three layers:
#   1. Split on sentence-ending punctuation (. ! ?) and silence gaps
#   2. If a chunk exceeds MAX_WORDS, split at clause boundaries (, ; : — and conjunctions)
#   3. If still too long, hard-split at MAX_WORDS
#

def _word_text(w: dict) -> str:
    return w["word"].strip()


def _is_clause_boundary(word: str) -> bool:
    """Check if a word ends with a clause-splitting character."""
    return bool(word) and word[-1] in CLAUSE_SPLIT_CHARS


def _is_conjunction(word: str) -> bool:
    """Check if a word (lowered, stripped of punctuation) is a conjunction."""
    clean = re.sub(r'[^\w]', '', word).lower()
    return clean in CLAUSE_CONJUNCTIONS


def _split_long_chunk(chunk: list[dict]) -> list[list[dict]]:
    """
    Split a chunk that exceeds MAX_WORDS_PER_BLOCK.
    Layer 2: try clause boundaries (commas, conjunctions).
    Layer 3: hard-split at MAX_WORDS as last resort.
    """
    if len(chunk) <= MAX_WORDS_PER_BLOCK:
        return [chunk]

    # Layer 2: find clause split points
    split_points = []
    for i, w in enumerate(chunk):
        word = _word_text(w)
        # Split AFTER a comma/semicolon/colon/dash
        if _is_clause_boundary(word) and i > 0:
            split_points.append(i + 1)  # split after this word
        # Split BEFORE a conjunction (if not at the start)
        elif _is_conjunction(word) and i >= MIN_WORDS_PER_BLOCK:
            split_points.append(i)      # split before this word

    if split_points:
        # Pick split points that produce chunks closest to MAX_WORDS
        result = []
        start = 0
        for sp in split_points:
            segment_len = sp - start
            remaining = len(chunk) - sp
            # Only split if current segment is getting long enough
            # and the remainder isn't too short
            if segment_len >= MIN_WORDS_PER_BLOCK and remaining >= MIN_WORDS_PER_BLOCK:
                if segment_len >= MAX_WORDS_PER_BLOCK or (len(chunk) - start) > MAX_WORDS_PER_BLOCK:
                    result.append(chunk[start:sp])
                    start = sp
        # Add remainder
        if start < len(chunk):
            result.append(chunk[start:])

        # If clause splitting produced valid results, recursively check each
        if len(result) > 1:
            final = []
            for r in result:
                final.extend(_split_long_chunk(r))
            return final

    # Layer 3: hard-split at MAX_WORDS (with anti-orphan)
    result = []
    for i in range(0, len(chunk), MAX_WORDS_PER_BLOCK):
        segment = chunk[i:i + MAX_WORDS_PER_BLOCK]
        if segment:
            result.append(segment)

    # Anti-orphan: if last chunk is ≤2 words, merge into previous
    if len(result) > 1 and len(result[-1]) <= 2:
        result[-2].extend(result[-1])
        result.pop()

    return result


def split_words_into_lines(words: list[dict]) -> list[list[dict]]:
    """
    Hybrid three-layer splitting:
      1. Sentence punctuation + silence gaps → raw chunks
      2. Clause boundaries → medium chunks
      3. Hard word limit → final blocks
    """
    # Layer 1: split on punctuation and silence gaps
    raw_chunks = []
    current = []

    for w in words:
        if current and (w["start"] - current[-1]["end"]) > SILENCE_GAP_THRESHOLD:
            raw_chunks.append(current)
            current = []

        current.append(w)

        word = _word_text(w)
        if word and word[-1] in SENTENCE_END_CHARS:
            raw_chunks.append(current)
            current = []

    if current:
        raw_chunks.append(current)

    # Layers 2+3: split any oversized chunks
    final = []
    for chunk in raw_chunks:
        final.extend(_split_long_chunk(chunk))

    # Layer 4: merge backward-orphans — short blocks followed by a large silence
    # gap indicate Whisper placed words at the wrong timestamp (e.g. "A few"
    # stranded 8s before the rest of the sentence). Merge them into the next
    # block so they don't appear over silence.
    merged = []
    for i, blk in enumerate(final):
        if (merged
                and len(merged[-1]) < MIN_WORDS_PER_BLOCK
                and blk
                and merged[-1]
                and blk[0]["start"] - merged[-1][-1]["end"] > SILENCE_GAP_THRESHOLD):
            merged[-1].extend(blk)
        else:
            merged.append(blk)

    return merged


# ── SRT builders ──────────────────────────────────────────────────────────────

def _filter_slow_lines(lines: list[list[dict]]) -> list[list[dict]]:
    """Remove word groups with suspiciously slow speaking rate (likely hallucinations)."""
    result = []
    for ln in lines:
        if not ln:
            continue
        duration = ln[-1]["end"] - ln[0]["start"]
        word_count = len(ln)
        if duration > 0 and word_count > 2 and word_count / duration < MIN_LINE_WPS:
            text = " ".join(w["word"] for w in ln).strip()
            wps = word_count / duration
            print(f"   🧹  Filtered slow line ({wps:.1f} wps, {word_count} words in {duration:.1f}s): \"{text[:60]}\"")
            continue
        result.append(ln)
    return result


def srt_from_words(words: list[dict], *, skip_slow_filter: bool = False) -> str:
    lines = split_words_into_lines(words)
    if not skip_slow_filter:
        lines = _filter_slow_lines(lines)
    lines = [ln for ln in lines if _has_text(" ".join(w["word"] for w in ln))]
    # Pre-compute start_ms for each line so we can clamp the previous end.
    line_starts = [sec_to_ms(ln[0]["start"]) if ln else None for ln in lines]
    blocks = []
    for idx, ln in enumerate(lines, 1):
        if not ln:
            continue
        start_ms     = sec_to_ms(ln[0]["start"])
        padded_end   = sec_to_ms(ln[-1]["end"]) + END_PADDING_MS
        # Clamp to next line's start to prevent overlap.
        next_start   = next((line_starts[j] for j in range(idx, len(lines)) if line_starts[j] is not None), None)
        end_ms       = min(padded_end, next_start) if next_start is not None else padded_end
        # Keo end ra it nhat MIN_BLOCK_MS (tranh block end <= start) nhung
        # khong vuot start cau sau - neu vuot thi lai thanh de gio.
        end_ms = max(end_ms, start_ms + MIN_BLOCK_MS)
        if next_start is not None and next_start > start_ms:
            end_ms = min(end_ms, next_start)
        text         = " ".join(w["word"] for w in ln).strip()
        text         = re.sub(r'\s+([.,!?:;])', r'\1', text)
        blocks.append(f"{idx}\n{ms_to_ts(start_ms)} --> {ms_to_ts(end_ms)}\n{text}")
    return "\n\n".join(blocks) + "\n"


def split_segment_proportional(start_ts, end_ts, text):
    sents = re.split(r'(?<=[.!?])\s+', text.strip())
    sents = [s.strip() for s in sents if s.strip()]
    if len(sents) <= 1:
        return [(start_ts, end_ts, text.strip())]
    start_ms    = ts_to_ms(start_ts)
    end_ms      = ts_to_ms(end_ts)
    total_ms    = end_ms - start_ms
    total_chars = sum(len(s) for s in sents)
    results, cur = [], start_ms
    for i, s in enumerate(sents):
        dur     = int(total_ms * len(s) / total_chars)
        seg_end = cur + dur if i < len(sents) - 1 else end_ms
        results.append((ms_to_ts(cur), ms_to_ts(seg_end), s))
        cur = seg_end
    return results


def srt_from_segments(segments: list[dict]) -> str:
    blocks, new_idx = [], 1
    for i, seg in enumerate(segments):
        next_start_ms = sec_to_ms(segments[i + 1]["start"]) if i + 1 < len(segments) else None
        padded_end_ms = sec_to_ms(seg["end"]) + END_PADDING_MS
        clamped_end_ms = min(padded_end_ms, next_start_ms) if next_start_ms is not None else padded_end_ms
        start_ms = sec_to_ms(seg["start"])
        # Cung kep nhu srt_from_words: khong block hong, khong de gio.
        clamped_end_ms = max(clamped_end_ms, start_ms + MIN_BLOCK_MS)
        if next_start_ms is not None and next_start_ms > start_ms:
            clamped_end_ms = min(clamped_end_ms, next_start_ms)
        parts = split_segment_proportional(
            ms_to_ts(sec_to_ms(seg["start"])),
            ms_to_ts(clamped_end_ms),
            seg["text"],
        )
        for s, e, t in parts:
            blocks.append(f"{new_idx}\n{s} --> {e}\n{t}")
            new_idx += 1
    return "\n\n".join(blocks) + "\n"


def validate_srt_timing(content: str) -> list[str]:
    """Check generated SRT for timing anomalies (overlaps included)."""
    warnings: list[str] = []
    blocks = content.strip().split('\n\n')

    prev_end_ms: int | None = None
    for block in blocks:
        lines_block = block.split('\n')
        if len(lines_block) < 3:
            continue

        idx = lines_block[0].strip()
        time_match = re.match(
            r'(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})',
            lines_block[1],
        )
        if not time_match:
            continue

        start_ms = ts_to_ms(time_match.group(1))
        end_ms = ts_to_ms(time_match.group(2))
        duration_s = (end_ms - start_ms) / 1000.0

        text = ' '.join(lines_block[2:]).strip()
        word_count = len(text.split())

        # Dong nay bat dau truoc khi dong truoc ket thuc: noda se cat ngan
        # dong truoc, highlight co the nhay sai.
        if prev_end_ms is not None and start_ms < prev_end_ms:
            warnings.append(
                f"Line {idx}: starts {prev_end_ms - start_ms}ms before previous line ends"
                f" - noda will shorten the previous line"
            )

        if duration_s <= 0:
            warnings.append(f"Line {idx}: zero/negative duration ({duration_s:.2f}s)")
            prev_end_ms = end_ms
            continue

        wps = word_count / duration_s

        if word_count > 2 and wps < MIN_LINE_WPS:
            warnings.append(
                f"Line {idx}: {wps:.1f} wps ({word_count} words in {duration_s:.1f}s)"
                f" — suspiciously slow, possible hallucination"
            )

        if wps > 9:
            warnings.append(f"Line {idx}: {wps:.1f} wps — suspiciously fast")

        prev_end_ms = end_ms

    return warnings


def json_to_srt(json_path: Path, srt_path: Path, *, words_override: list[dict] | None = None) -> int:
    is_refined = words_override is not None
    if is_refined:
        raw_words = _guard_refined_words(words_override, extract_words(json_path))
    else:
        raw_words = extract_words(json_path)

    if raw_words:
        words = dedupe_words(raw_words)
        words = filter_tail_silence(words)

        if words:
            print(f"   ✔  Word-level{' (refined)' if is_refined else ''}: {len(words)} words")
            content = srt_from_words(words, skip_slow_filter=is_refined)
        else:
            print("   ⚠  All words filtered — segment fallback")
            segments = extract_segments_fallback(json_path)
            content  = srt_from_segments(segments)
    else:
        segments = extract_segments_fallback(json_path)
        print(f"   ⚠  No word timestamps — fallback ({len(segments)} segments)")
        content = srt_from_segments(segments)

    warnings = validate_srt_timing(content)
    if warnings:
        print(f"   ⚠️  {len(warnings)} timing warning(s):")
        for w in warnings[:10]:
            print(f"      {w}")

    srt_path.write_text(content, encoding="utf-8")
    count = content.strip().count("\n\n") + 1 if content.strip() else 0
    return count


# ── Dependency checks ─────────────────────────────────────────────────────────

def require(cmd, hint):
    if not shutil.which(cmd):
        print(f"❌  '{cmd}' not found.\n💡  {hint}")
        sys.exit(1)

def check_deps(need_ytdlp=False):
    require("mlx_whisper", "pip install mlx-whisper")
    require("ffmpeg",      "brew install ffmpeg")
    if need_ytdlp:
        require("yt-dlp",  "brew install yt-dlp")


# ── Audio extraction ──────────────────────────────────────────────────────────

def extract_wav(media_path: Path, wav_path: Path):
    cmd = ["ffmpeg", "-nostdin", "-y", "-i", str(media_path),
           "-ar", "16000", "-ac", "1", "-vn", str(wav_path)]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        # Hien loi that thay vi giu kin: khong co stderr thi doan mo.
        err_tail = (proc.stderr or "").strip().splitlines()[-5:]
        print(f"❌  ffmpeg failed: {media_path}")
        for line in err_tail:
            print(f"      {line.strip()[:160]}")
        sys.exit(1)


def normalize_audio(media_path: Path) -> Path:
    """Re-encode MP3 as CBR for accurate browser seeking (VBR without Xing header causes seek drift).

    KHONG bao gio xoa file goc truoc: backup *_orig_backup, ghi ra file tam,
    chi doi ten khi ffmpeg thanh cong.
    """
    if media_path.suffix.lower() != ".mp3":
        return media_path
    # Backup chi ton tai khi lan truoc normalize thanh cong -> khong ma hoa
    # lai (moi lan ma hoa lai mp3 la mat them chat luong).
    backup_path = media_path.with_stem(media_path.stem + "_orig_backup")
    if backup_path.exists():
        print(f"⏩  Already normalized (backup {backup_path.name} exists)")
        return media_path

    probe = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=bit_rate",
         "-of", "default=noprint_wrappers=1:nokey=1", str(media_path)],
        capture_output=True, text=True,
    )
    bitrate = int(probe.stdout.strip() or "0")
    target_kbps = max(128, min(320, round(bitrate / 1000 / 32) * 32)) if bitrate else 128
    print(f"🔧  Normalizing MP3 to CBR {target_kbps}k for accurate seeking …")

    shutil.copy2(media_path, backup_path)
    print(f"   💾  Original backed up as {backup_path.name}")

    with tempfile.NamedTemporaryFile(
        suffix=".mp3", dir=str(media_path.parent), delete=False
    ) as tmp:
        tmp_path = Path(tmp.name)
    try:
        cmd = ["ffmpeg", "-nostdin", "-y", "-i", str(media_path),
               "-c:a", "libmp3lame", "-b:a", f"{target_kbps}k", str(tmp_path)]
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode != 0:
            err_tail = (proc.stderr or "").strip().splitlines()[-5:]
            print("   ⚠  CBR normalization failed — keeping original")
            for line in err_tail:
                print(f"      {line.strip()[:160]}")
            # Xoa backup: lan sau van thu normalize lai.
            backup_path.unlink(missing_ok=True)
            return media_path
        # Chi toi day moi thay file goc: goc van con trong backup du co gi xay ra.
        tmp_path.replace(media_path)
    finally:
        tmp_path.unlink(missing_ok=True)
    print(f"   ✔  Normalized to CBR {target_kbps}k (original kept as {backup_path.name})")
    return media_path


# ── mlx_whisper runner ────────────────────────────────────────────────────────

def run_mlx_whisper(media_path: Path, output_dir: Path, *, model: str) -> Path | None:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = Path(tmp.name)

    try:
        print("🔄  Extracting audio …")
        extract_wav(media_path, wav_path)

        cmd = [
            "mlx_whisper", str(wav_path),
            "--model",                      model,
            "--language",                   "en",
            "--word-timestamps",            "True",
            "--initial-prompt",             INITIAL_PROMPT,
            "--condition-on-previous-text", "False",
            "--prepend-punctuations",       PREPEND_PUNCTUATIONS,
            "--append-punctuations",        APPEND_PUNCTUATIONS,
            "--output-format",              "json",
            "--output-dir",                 str(output_dir),
        ]

        print(f"🤖  Running mlx_whisper ({model}) …\n")
        result = subprocess.run(cmd)
        if result.returncode != 0:
            return None

        json_out = output_dir / (wav_path.stem + ".json")
        return json_out if json_out.exists() else None

    finally:
        wav_path.unlink(missing_ok=True)


_stable_ts_model = None

def _get_stable_ts_model():
    global _stable_ts_model
    if _stable_ts_model is not None:
        return _stable_ts_model
    try:
        import stable_whisper
    except ImportError:
        print("   ⚠  stable-ts not installed — using raw Whisper timestamps")
        print("   💡  pip install stable-ts faster-whisper")
        return None
    print("🔧  Loading stable-ts model …")
    _stable_ts_model = stable_whisper.load_faster_whisper(STABLE_TS_MODEL)
    return _stable_ts_model


def _refine_timestamps(media_path: Path, json_path: Path) -> list[dict] | None:
    """Use stable-ts forced alignment for accurate word-level timestamps."""
    model = _get_stable_ts_model()
    if model is None:
        return None

    data = json.loads(json_path.read_text(encoding="utf-8"))
    segments = data.get("segments", [])
    if not segments:
        return None

    clean_segments = filter_segments(segments)
    full_text = " ".join(
        seg.get("text", "").strip()
        for seg in clean_segments
        if seg.get("text", "").strip()
    )
    if not full_text.strip():
        return None

    print("🔧  Refining word timestamps (stable-ts forced alignment) …")
    result = model.align(str(media_path), full_text, language="en")

    words = []
    for segment in result.segments:
        for w in segment.words:
            word = w.word.strip()
            if not word:
                continue
            words.append({"word": word, "start": round(w.start, 3), "end": round(w.end, 3)})

    if words:
        print(f"   ✔  Refined {len(words)} word timestamps")
        return words

    print("   ⚠  Refinement produced no words — keeping raw timestamps")
    return None


def transcribe_to_srt(
    media_path: Path,
    output_dir: Path,
    srt_path: Path,
    *,
    refine: bool = True,
    model: str,
    keep_json: bool = True,
) -> bool:
    json_path = run_mlx_whisper(media_path, output_dir, model=model)
    if not json_path:
        return False
    try:
        refined = _refine_timestamps(media_path, json_path) if refine else None
        count = json_to_srt(json_path, srt_path, words_override=refined)
        print(f"✅  {count} lines → {srt_path}")

        # Giu ca gio goc lan gio stable-ts canh file .srt: --from-json cat cau
        # lai trong vai giay, khong chay lai whisper + stable-ts (~20 phut).
        if keep_json:
            kept = srt_path.with_suffix(".whisper.json")
            if json_path.resolve() != kept.resolve():
                shutil.move(str(json_path), str(kept))
                json_path = kept
            print(f"   💾  Kept intermediate JSON → {kept.name}")
            if refined:
                refined_path = srt_path.with_suffix(".refined.json")
                refined_path.write_text(json.dumps(refined), encoding="utf-8")
                print(f"   💾  Kept refined timings → {refined_path.name}")

        lines = srt_path.read_text(encoding="utf-8").strip().split("\n\n")
        print("\n   📋  Preview (first 5):")
        for block in lines[:5]:
            rows = block.splitlines()
            if len(rows) >= 3:
                print(f"      {rows[1]}  {rows[2]}")
        print()
        return True
    finally:
        if not keep_json:
            json_path.unlink(missing_ok=True)


# ── Mode 1: YouTube ───────────────────────────────────────────────────────────

def mode_youtube(*, refine: bool = True, model: str, keep_json: bool = True):
    check_deps(need_ytdlp=True)
    url = input("🔗  Paste the YouTube link: ").strip()
    if not url:
        sys.exit("❌  No URL entered.")

    print()
    print("🎬  Select format:")
    print("   [1] Audio (MP3)")
    print("   [2] Video (MP4 – Max 720p)")
    fmt        = ask("Enter 1 or 2: ", {"1": "audio", "2": "video"})
    media_ext  = "mp3" if fmt == "audio" else "mp4"

    print()
    print("📝  Generate transcript?")
    print("   [1] Yes")
    print("   [2] No (download only)")
    do_transcript = ask("Enter 1 or 2: ", {"1": True, "2": False})

    if do_transcript:
        check_deps()

    output_dir = Path("./youtube_downloads")
    output_dir.mkdir(exist_ok=True)

    print("\n======================================")
    print("1. DOWNLOADING FROM YOUTUBE …")
    print("======================================")

    try:
        video_id  = subprocess.check_output(
            ["yt-dlp", "--get-id", url], stderr=subprocess.DEVNULL).decode().strip()
        raw_title = subprocess.check_output(
            ["yt-dlp", "--get-title", url], stderr=subprocess.DEVNULL).decode().strip()
    except subprocess.CalledProcessError:
        sys.exit("❌  Could not fetch video info.")

    safe_title = re.sub(r"[^A-Za-z0-9._-]", "_", raw_title)
    filename   = f"{safe_title}_{video_id}"
    media_path = output_dir / f"{filename}.{media_ext}"
    srt_path   = output_dir / f"{filename}.srt"

    if not media_path.exists():
        dl_cmd = (
            ["yt-dlp", "--no-playlist",
             "-f", "bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4][height<=720]/best",
             "--merge-output-format", "mp4", "-o", str(media_path), url]
            if fmt == "video" else
            ["yt-dlp", "--no-playlist", "-f", "bestaudio", "-x",
             "--audio-format", "mp3", "-o", str(media_path), url]
        )
        if subprocess.run(dl_cmd).returncode != 0:
            sys.exit("❌  Download failed.")
        print(f"✅  Downloaded {media_ext.upper()}")
        normalize_audio(media_path)
    else:
        print(f"⏩  Already exists: {media_path}")

    if not do_transcript:
        _print_results_download(media_path)
        return

    if srt_path.exists():
        _print_results(media_path, srt_path)
        return

    print(f"\n======================================")
    print(f"2. GENERATING TRANSCRIPT …")
    print("======================================")

    if not transcribe_to_srt(media_path, output_dir, srt_path, refine=refine, model=model,
                              keep_json=keep_json):
        sys.exit("❌  Transcription failed.")
    _print_results(media_path, srt_path)


# ── Mode 2: Local batch ───────────────────────────────────────────────────────

MEDIA_EXTENSIONS = {".mp3", ".m4a", ".wav", ".mp4", ".mkv", ".mov"}

def mode_local(*, refine: bool = True, model: str, keep_json: bool = True):
    check_deps()
    output_dir = Path("./subs")
    output_dir.mkdir(exist_ok=True)
    print("======================================")
    print("SCANNING MEDIA FILES …")
    print(f"Output: {output_dir}\n")

    media_files = sorted(
        p for p in Path(".").iterdir()
        if p.is_file() and p.suffix.lower() in MEDIA_EXTENSIONS
    )
    if not media_files:
        sys.exit("⚠️   No media files found.")

    failed = []
    for i, media_path in enumerate(media_files, 1):
        srt_path = output_dir / (media_path.stem + ".srt")
        if srt_path.exists():
            print(f"⏩  Skipping '{media_path.name}'")
            continue
        print(f"---\n🎧  [{i}/{len(media_files)}] {media_path.name}")
        normalize_audio(media_path)
        if not transcribe_to_srt(media_path, output_dir, srt_path, refine=refine, model=model,
                                 keep_json=keep_json):
            failed.append(media_path.name)

    print("======================================")
    print(f"🎉  COMPLETE! {len(media_files)} file(s)")
    if failed:
        print(f"⚠️   Failed: {', '.join(failed)}")
    print(f"📂  Saved in: {output_dir}")


# ── Mode 3: Re-cut from kept JSON ─────────────────────────────────────────────

def mode_from_json(whisper_json: Path):
    """Ghi lai X.srt tu X.whisper.json (+ X.refined.json neu co), khong chay model."""
    suffix = ".whisper.json"
    if not whisper_json.name.endswith(suffix) or not whisper_json.exists():
        sys.exit(f"❌  Need an existing *{suffix} file, got: {whisper_json}")
    base         = whisper_json.name[:-len(suffix)]
    srt_path     = whisper_json.with_name(base + ".srt")
    refined_path = whisper_json.with_name(base + ".refined.json")

    refined = None
    if refined_path.exists():
        refined = json.loads(refined_path.read_text(encoding="utf-8"))
        print(f"📂  Using refined timings: {refined_path.name}")
    else:
        print("⚠️   No .refined.json - using raw Whisper timings")

    count = json_to_srt(whisper_json, srt_path, words_override=refined)
    print(f"✅  {count} lines → {srt_path}")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _print_results(media: Path, srt: Path):
    print(f"\n✅  SUCCESS!\n   🎬  {media}\n   📝  {srt}")

def _print_results_download(media: Path):
    print(f"\n✅  SUCCESS!\n   🎬  {media}")

def ask(prompt, choices):
    while True:
        ans = input(prompt).strip()
        if ans in choices:
            return choices[ans]
        print(f"   ⚠️  Enter: {', '.join(choices)}")


# ── Entry ─────────────────────────────────────────────────────────────────────

def main(argv: list[str] | None = None):
    parser = argparse.ArgumentParser(description="NODA transcript generator")
    parser.add_argument("--no-refine", action="store_true",
                        help="skip stable-ts refinement (KHONG NEN - gio se lech)")
    parser.add_argument("--model", default=MLX_MODEL,
                        help=f"mlx_whisper model (default: {MLX_MODEL})")
    parser.add_argument("--clean-json", action="store_true",
                        help="xoa JSON trung gian sau khi xong (mac dinh GIU lai)")
    parser.add_argument("--from-json", type=Path, metavar="X.whisper.json",
                        help="cat cau lai tu JSON da giu, ghi de X.srt (khong chay model)")
    args = parser.parse_args(argv)

    if args.from_json:
        mode_from_json(args.from_json)
        return

    refine = not args.no_refine

    print("============================================")
    print("🎧  NODA TRANSCRIPT GENERATOR")
    print(f"    mlx-whisper • {args.model.split('/')[-1]} • Apple Silicon")
    if not refine:
        print("    ⚡ stable-ts refinement SKIPPED (gio co the lech!)")
    print("============================================\n")

    print("📥  Input source:")
    print("   [1] YouTube")
    print("   [2] Local files (batch)")
    print()
    mode = ask("Enter 1 or 2: ", {"1": "youtube", "2": "local"})

    print()
    if mode == "youtube":
        mode_youtube(refine=refine, model=args.model, keep_json=not args.clean_json)
    else:
        mode_local(refine=refine, model=args.model, keep_json=not args.clean_json)

    print("\n✨  Done!")

if __name__ == "__main__":
    main()

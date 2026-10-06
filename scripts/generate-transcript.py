#!/usr/bin/env python3
"""
============================================
NODA TRANSCRIPT GENERATOR
============================================
Copied from ~/Downloads/main/converted_script.py, adapted for noda.

Backend  : mlx-whisper (Apple Silicon)
Model    : whisper-large-v3 (default). Turbo on a 43-minute video made up
           words over the intro music and dropped real repeats, for only
           ~2-3 minutes saved. Still selectable with --model.
Alignment: stable-ts / faster-whisper large-v3 (forced alignment, ALWAYS
           ON - timings drift without it). A word more than 1s off the raw
           Whisper time falls back to it (see _guard_refined_words).
Language : English
SRT mode : word-level timestamps (refined)
           fallback: proportional split
Filters  : context-aware hallucination filter (drops junk lines only,
           NOT words by score - lost words are worse than drifted times)
Splitting: hybrid (punctuation -> clause -> max words, 14 words/line)

Changes from the original:
  1. normalize_audio: back up to *_orig_backup FIRST, write to a temp
     file, rename only if ffmpeg succeeds. Backup exists = already
     normalized -> skip (no mp3 re-encode on every run).
  2. extract_wav: on failure, print the real ffmpeg error.
  3. Keep JSON next to the .srt: X.whisper.json (raw times) + X.refined.json
     (stable-ts times). --from-json X.whisper.json re-splits lines in a few
     seconds without rerunning whisper/stable-ts. --clean-json deletes them.
  4. validate_srt_timing: detect overlapping lines (prev_end_ms).
  5. Clamp end >= start + 200ms, but NEVER past the next line's start.
  6. Drop lines with no letter or digit (e.g. "!" - Whisper junk).
  7. Stop stable-ts from stretching words over silence/music (1-15s off).
  8. --model switches the model from the command line.
  9. Snap end to real loudness: if speech runs past end, move end to where
     it stops (max +400ms, never past the next line's start).
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
CLAUSE_SPLIT_CHARS   = {',', ';', ':', '\N{EN DASH}', '\N{EM DASH}'}
CLAUSE_CONJUNCTIONS  = {
    "and", "but", "or", "so", "yet", "because", "although", "though",
    "while", "when", "where", "which", "who", "that", "if", "since",
    "unless", "before", "after", "until",
}

MAX_WORDS_PER_BLOCK    = 14
MIN_WORDS_PER_BLOCK    = 3
SILENCE_GAP_THRESHOLD  = 2.0
END_PADDING_MS         = 150  # buffer after last word's Whisper end timestamp.
                             # KEEP AT 150: noda stops audio at end - 0.03s, so
                             # less cuts off line endings (see the plan). In fast
                             # speech end is already clamped to the next start,
                             # so padding has no effect there.
MIN_BLOCK_MS           = 200  # shorter blocks get their end extended
END_SNAP_MAX_MS        = 400  # max end extension while speech continues
END_SNAP_TAIL_MS       = 30   # noda stops at end - 0.03s -> add that much back
SPEECH_DB_ABOVE_FLOOR  = 12   # dB above the floor (30th percentile) that counts as speech
END_SNAP_GAP_FRAMES    = 6    # gaps <= 60ms inside a final sound still count as speech
MIN_LINE_WPS           = 1.0  # lines below this words/sec are likely hallucinations
REFINE_MAX_DRIFT_S     = 1.0  # stable-ts further than this from raw Whisper -> use the raw time.
                             # On a 43-minute video: median drift 0s, p95 ~0.4s;
                             # ~4% of lines drift 1-15s (stable-ts swallows silence/music).


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
    """Use the raw Whisper time for words stable-ts moved more than REFINE_MAX_DRIFT_S.

    stable-ts sometimes stretches a line's first/last word over silence or music
    (e.g. "Being up here..." placed 10s early). In noda that line highlights early
    and dictation plays 10s of silence. Raw Whisper is right in those spots; the
    other 96% of words keep the stable-ts time.
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
            # Fixing one side broke the word (end <= start) -> use both raw times.
            if r["end"] <= r["start"]:
                r["start"], r["end"] = g["start"], g["end"]
            fixed += 1

    if fixed:
        print(f"   🛡  Restored Whisper timing for {fixed} word(s) stable-ts moved > {REFINE_MAX_DRIFT_S:.0f}s")
    return out


def _has_text(text: str) -> bool:
    """A line of only punctuation (e.g. "!") is Whisper junk; noda should not show it."""
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
#   2. If a chunk exceeds MAX_WORDS, split at clause boundaries (, ; : en or em dash, and conjunctions)
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

    # Layer 4: merge backward-orphans - short blocks followed by a large silence
    # gap indicate Whisper placed words at the wrong timestamp (e.g. "A few"
    # stranded 8s before the rest of the sentence). Merge them into the next
    # block so they don't appear over silence.
    # A short block ending in . ! ? is a full sentence ("Wow.", "Bye bye!"),
    # not misplaced words -> keep it alone. Merging would stretch a line over
    # 5-13s of silence (early highlight, silent dictation).
    merged = []
    for i, blk in enumerate(final):
        if (merged
                and len(merged[-1]) < MIN_WORDS_PER_BLOCK
                and blk
                and merged[-1]
                and _word_text(merged[-1][-1])[-1:] not in SENTENCE_END_CHARS
                and blk[0]["start"] - merged[-1][-1]["end"] > SILENCE_GAP_THRESHOLD):
            merged[-1].extend(blk)
        else:
            merged.append(blk)

    return merged


# ── Speech mask (am luong that) ──────────────────────────────────────────────

def load_speech_mask(media_path: Path | None):
    """Bool array, one item per 10ms: True when that frame has speech (above the floor).

    stable-ts often ends the last word 0.1-0.3s early; fixed padding can't cover
    it, and noda (stopping at end - 0.03s) clips the final sound in dictation.
    Measure real loudness to see when speech stops. Any error returns None (step skipped).
    """
    if media_path is None or not media_path.exists():
        return None
    try:
        import numpy as np
    except ImportError:
        return None
    proc = subprocess.run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-i", str(media_path),
         "-ar", "16000", "-ac", "1", "-f", "s16le", "-"],
        capture_output=True,
    )
    if proc.returncode != 0 or not proc.stdout:
        return None
    x = np.frombuffer(proc.stdout, dtype=np.int16).astype(np.float32)
    frame = 160  # 10ms @ 16kHz
    n = len(x) // frame
    if n == 0:
        return None
    rms = np.sqrt(np.mean(x[: n * frame].reshape(n, frame) ** 2, axis=1)) + 1e-6
    db = 20 * np.log10(rms)
    return db > np.percentile(db, 30) + SPEECH_DB_ABOVE_FLOOR


def _snap_end_to_speech(end_ms: float, limit_ms: float | None, speech) -> float:
    """Extend end over a trailing sound, up to END_SNAP_MAX_MS, never past limit_ms."""
    if speech is None:
        return end_ms
    cap = end_ms + END_SNAP_MAX_MS
    if limit_ms is not None:
        cap = min(cap, limit_ms)
    i = int(end_ms // 10)
    if i >= len(speech) or not speech[i]:
        return end_ms  # end is already in silence: keep it
    # Skip short gaps (<= END_SNAP_GAP_FRAMES): a final cluster like "k-s" in
    # "cortex" has a tiny stop before it releases.
    t = end_ms
    while t < cap and i < len(speech):
        if speech[i]:
            t += 10
            i += 1
            continue
        ahead = speech[i + 1 : i + 1 + END_SNAP_GAP_FRAMES]
        if not ahead.any():
            break
        step = int(ahead.argmax()) + 1
        t += 10 * step
        i += step
    return min(t + END_SNAP_TAIL_MS, cap)


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


def srt_from_words(words: list[dict], *, skip_slow_filter: bool = False, speech=None) -> str:
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
        # Extend end to at least MIN_BLOCK_MS (no end <= start), but never past
        # the next line's start - that would overlap again.
        end_ms = max(end_ms, start_ms + MIN_BLOCK_MS)
        if next_start is not None and next_start > start_ms:
            end_ms = min(end_ms, next_start)
        limit = next_start if next_start is not None and next_start > start_ms else None
        end_ms = _snap_end_to_speech(end_ms, limit, speech)
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
        # Same clamp as srt_from_words: no broken block, no overlap.
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

        # Starts before the previous line ends: noda cuts the previous line
        # short and the highlight may jump.
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
                f" - suspiciously slow, possible hallucination"
            )

        if wps > 9:
            warnings.append(f"Line {idx}: {wps:.1f} wps - suspiciously fast")

        prev_end_ms = end_ms

    return warnings


def json_to_srt(
    json_path: Path,
    srt_path: Path,
    *,
    words_override: list[dict] | None = None,
    media_path: Path | None = None,
) -> int:
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
            speech = load_speech_mask(media_path)
            if speech is None:
                print("   ⚠  No audio for end-snap - keeping padded ends")
            content = srt_from_words(words, skip_slow_filter=is_refined, speech=speech)
        else:
            print("   ⚠  All words filtered - segment fallback")
            segments = extract_segments_fallback(json_path)
            content  = srt_from_segments(segments)
    else:
        segments = extract_segments_fallback(json_path)
        print(f"   ⚠  No word timestamps - fallback ({len(segments)} segments)")
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
        # Show the real error: without stderr we would only be guessing.
        err_tail = (proc.stderr or "").strip().splitlines()[-5:]
        print(f"❌  ffmpeg failed: {media_path}")
        for line in err_tail:
            print(f"      {line.strip()[:160]}")
        sys.exit(1)


def normalize_audio(media_path: Path) -> Path:
    """Re-encode MP3 as CBR for accurate browser seeking (VBR without Xing header causes seek drift).

    NEVER delete the original first: back up to *_orig_backup, write to a temp
    file, rename only if ffmpeg succeeds.
    """
    if media_path.suffix.lower() != ".mp3":
        return media_path
    # A backup only exists after a successful normalize -> don't re-encode
    # (each mp3 re-encode loses quality).
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
            print("   ⚠  CBR normalization failed - keeping original")
            for line in err_tail:
                print(f"      {line.strip()[:160]}")
            # Remove the backup so the next run tries again.
            backup_path.unlink(missing_ok=True)
            return media_path
        # Only now replace the original; it stays in the backup whatever happens.
        # The temp file is created 0600 -> copy the original's permissions.
        shutil.copymode(backup_path, tmp_path)
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
        print("   ⚠  stable-ts not installed - using raw Whisper timestamps")
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

    print("   ⚠  Refinement produced no words - keeping raw timestamps")
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
        count = json_to_srt(json_path, srt_path, words_override=refined, media_path=media_path)
        print(f"✅  {count} lines → {srt_path}")

        # Keep raw and stable-ts times next to the .srt: --from-json re-splits
        # in seconds, without rerunning whisper + stable-ts (~20 minutes).
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

def _find_media(folder: Path, base: str) -> Path | None:
    """Media file with the same name: next to the JSON (YouTube mode) or in the parent folder (local mode, JSON in subs/)."""
    for d in (folder, folder.parent):
        for ext in sorted(MEDIA_EXTENSIONS):
            cand = d / f"{base}{ext}"
            if cand.exists():
                return cand
    return None


def mode_from_json(whisper_json: Path, media_path: Path | None = None):
    """Rewrite X.srt from X.whisper.json (+ X.refined.json if present) without running a model."""
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

    media_path = media_path or _find_media(whisper_json.parent, base)
    if media_path:
        print(f"🎧  Audio for end-snap: {media_path}")
    count = json_to_srt(whisper_json, srt_path, words_override=refined, media_path=media_path)
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
                        help="skip stable-ts refinement (NOT advised - times will drift)")
    parser.add_argument("--model", default=MLX_MODEL,
                        help=f"mlx_whisper model (default: {MLX_MODEL})")
    parser.add_argument("--clean-json", action="store_true",
                        help="delete the intermediate JSON when done (default: keep)")
    parser.add_argument("--from-json", type=Path, metavar="X.whisper.json",
                        help="re-split lines from saved JSON and overwrite X.srt (no model run)")
    parser.add_argument("--media", type=Path,
                        help="audio/video file for --from-json (default: same name next to the JSON)")
    args = parser.parse_args(argv)

    if args.from_json:
        mode_from_json(args.from_json, args.media)
        return

    refine = not args.no_refine

    print("============================================")
    print("🎧  NODA TRANSCRIPT GENERATOR")
    print(f"    mlx-whisper • {args.model.split('/')[-1]} • Apple Silicon")
    if not refine:
        print("    ⚡ stable-ts refinement SKIPPED (times may drift!)")
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

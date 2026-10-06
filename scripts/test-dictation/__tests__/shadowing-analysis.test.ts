import { describe, it, expect } from 'vitest';
import {
  normalizeShadowingAnalysis,
  ShadowingShapeError,
} from '../../../functions/src/lib/normalizeShadowingAnalysis';
import { analysisAudioPath } from '../../../functions/src/lib/analysisAudioPath';
import { lessonStoragePaths } from '../../../functions/src/lib/lessonCleanup';
import { firebaseDownloadUrl } from '../../../functions/src/lib/firebaseDownloadUrl';
import { isRenderableAnalysis } from '@/lib/shadowingChunks';
import { nextSentencesToPrefetch } from '@/lib/shadowingPrefetch';
import { ShadowingRequestTracker } from '@/lib/shadowingRequests';
import { SHADOWING_PREFETCH_COUNT } from '@/constants';
import type { Sentence } from '@/types';

const token = (w: string, level = 'normal', display?: string) => ({
  w,
  display: display ?? w,
  level,
});

/** "the manager had to stop" split as "the manager had to" + "stop". */
const twoChunks = (overrides: Record<string, unknown> = {}) => ({
  chunks: [
    {
      tokens: [token('the', 'weak'), token('manager', 'strong', 'MANager'), token('had', 'weak'), token('to', 'weak')],
      tone: 'rise',
      toneStrength: 'weak',
    },
    {
      tokens: [token('stop', 'strong', 'STOP')],
      tone: 'fall',
      toneStrength: 'strong',
    },
  ],
  notes: [],
  ...overrides,
});
const SOURCE = 'the manager had to stop';

describe('normalizeShadowingAnalysis', () => {
  it('keeps a well-formed response', () => {
    const out = normalizeShadowingAnalysis(twoChunks(), SOURCE);
    expect(out.chunks).toHaveLength(2);
    expect(out.chunks[0].tokens[1].display).toBe('MANager');
    expect(out.chunks[0].tone).toBe('rise');
    expect(out.chunks[0].toneStrength).toBe('weak');
  });

  it('throws when the tokens no longer spell the transcript', () => {
    const raw = twoChunks();
    raw.chunks[1].tokens = [token('stopped', 'strong', 'STOPPED')];
    expect(() => normalizeShadowingAnalysis(raw, SOURCE)).toThrow(ShadowingShapeError);
  });

  it('throws when a word is dropped entirely', () => {
    const raw = twoChunks();
    raw.chunks[0].tokens = raw.chunks[0].tokens.slice(0, 3);
    expect(() => normalizeShadowingAnalysis(raw, SOURCE)).toThrow(ShadowingShapeError);
  });

  it('throws on an empty or unusable chunk list', () => {
    expect(() => normalizeShadowingAnalysis({ chunks: [], notes: [] }, SOURCE)).toThrow(ShadowingShapeError);
    expect(() => normalizeShadowingAnalysis(null, SOURCE)).toThrow(ShadowingShapeError);
  });

  it('resets a display whose letters drifted, keeping the transcript word', () => {
    const raw = twoChunks();
    raw.chunks[0].tokens[1] = token('manager', 'strong', 'MANAGERS');
    const out = normalizeShadowingAnalysis(raw, SOURCE);
    expect(out.chunks[0].tokens[1].display).toBe('manager');
  });

  it('rejects a display that adds punctuation the transcript never had', () => {
    const raw = twoChunks();
    // Seen in the wild: Gemini returned "HALF-way" for the word "halfway".
    raw.chunks[0].tokens[1] = token('manager', 'strong', 'MAN-ager');
    const out = normalizeShadowingAnalysis(raw, SOURCE);
    expect(out.chunks[0].tokens[1].display).toBe('manager');
  });

  it('keeps punctuation that is genuinely part of the word', () => {
    const raw = twoChunks();
    raw.chunks[1].tokens = [token('stop', 'strong', 'STOP')];
    expect(normalizeShadowingAnalysis(raw, SOURCE).chunks[1].tokens[0].display).toBe('STOP');
  });

  it('ignores a recased display on a token that is not stressed', () => {
    const raw = twoChunks();
    raw.chunks[0].tokens[0] = token('the', 'weak', 'THE');
    const out = normalizeShadowingAnalysis(raw, SOURCE);
    expect(out.chunks[0].tokens[0].display).toBe('the');
  });

  it('promotes a content word marked weak, but leaves function words weak', () => {
    const raw = twoChunks();
    raw.chunks[1].tokens = [token('stop', 'weak')];
    const out = normalizeShadowingAnalysis(raw, SOURCE);
    expect(out.chunks[1].tokens[0].level).toBe('normal');
    expect(out.chunks[0].tokens[0].level).toBe('weak');
    expect(out.chunks[0].tokens[2].level).toBe('weak');
  });

  it('falls back to a flat tone on an unknown tone value', () => {
    const raw = twoChunks();
    (raw.chunks[0] as { tone: string }).tone = 'swoop';
    expect(normalizeShadowingAnalysis(raw, SOURCE).chunks[0].tone).toBe('flat');
  });

  describe('notes', () => {
    const note = (extra: Record<string, unknown> = {}) => ({
      type: 'linking',
      text: 'had to',
      sounds: 'had-tuh',
      ipa: '/hæd tə/',
      why: "Don't release the /d/.",
      ...extra,
    });

    it('drops an accented respelling but keeps the rest of the note', () => {
      // Seen in the wild: accented respellings next to English-style "sheh-ruh".
      const out = normalizeShadowingAnalysis(
        twoChunks({ notes: [note({ sounds: 'lï-dl' }), note({ sounds: 'ʃeh-ruh' }), note({ sounds: 'LIH-dl' })] }),
        SOURCE
      );
      expect(out.notes.map((n) => n.sounds)).toEqual(['', '', 'LIH-dl']);
      expect(out.notes[0].ipa).toBe('/hæd tə/');
      expect(out.notes[0].why).toBe("Don't release the /d/.");
    });

    it('truncates to the six-note cap', () => {
      const out = normalizeShadowingAnalysis(twoChunks({ notes: Array.from({ length: 12 }, () => note()) }), SOURCE);
      expect(out.notes).toHaveLength(6);
    });

    it('keeps a via step, but drops an empty one or one that repeats the text', () => {
      const out = normalizeShadowingAnalysis(
        twoChunks({ notes: [note({ via: 'hadda' }), note({ via: '' }), note({ via: 'Had to' })] }),
        SOURCE
      );
      expect(out.notes.map((n) => n.via)).toEqual(['hadda', undefined, undefined]);
    });

    it('keeps only one rhythm note, blanks its example fields, and moves it last', () => {
      const raw = twoChunks({
        notes: [
          note({ type: 'rhythm', why: 'Drop your pitch firmly on the last chunk.' }),
          note({ type: 'rhythm', why: 'Say the middle chunk faster.' }),
          note(),
        ],
      });
      const out = normalizeShadowingAnalysis(raw, SOURCE);
      expect(out.notes).toHaveLength(2);
      expect(out.notes.filter((n) => n.type === 'rhythm')).toHaveLength(1);
      // Sound note first even though the model listed rhythm first.
      expect(out.notes[0].type).toBe('linking');
      expect(out.notes[1]).toMatchObject({ type: 'rhythm', text: '', sounds: '', ipa: '' });
    });

    it('preserves the sentence order the model returned for sound notes', () => {
      const raw = twoChunks({
        notes: [note({ text: 'the manager' }), note({ text: 'had to' }), note({ text: 'to stop' })],
      });
      const out = normalizeShadowingAnalysis(raw, SOURCE);
      expect(out.notes.map((n) => n.text)).toEqual(['the manager', 'had to', 'to stop']);
    });

    it('drops notes with no coaching instruction or an unknown type', () => {
      const raw = twoChunks({ notes: [note({ why: '   ' }), note({ type: 'vowel-shift' }), note()] });
      const out = normalizeShadowingAnalysis(raw, SOURCE);
      expect(out.notes).toHaveLength(1);
      expect(out.notes[0].text).toBe('had to');
    });

    it('accepts an empty note list - a cleanly articulated sentence is a real answer', () => {
      expect(normalizeShadowingAnalysis(twoChunks({ notes: [] }), SOURCE).notes).toEqual([]);
      expect(normalizeShadowingAnalysis(twoChunks({ notes: 'none' }), SOURCE).notes).toEqual([]);
    });
  });
});

describe('isRenderableAnalysis', () => {
  const ok = {
    chunks: [{ tokens: [{ w: 'hi', display: 'HI', level: 'strong' }], tone: 'fall', toneStrength: 'strong' }],
    notes: [],
  };

  it('accepts a v2 analysis', () => {
    expect(isRenderableAnalysis(ok)).toBe(true);
  });

  it('rejects a v1 analysis, which is what a not-yet-deployed function returns', () => {
    const v1 = {
      stressRhythm: { summary: 's', stressedWords: ['hi'] },
      intonationPitch: { summary: 's', pattern: 'falling' },
      connectedSpeech: { summary: 's', features: [] },
      chunking: { summary: 's', groups: ['hi'] },
    };
    expect(isRenderableAnalysis(v1)).toBe(false);
  });

  it('rejects empty, malformed, and missing values', () => {
    expect(isRenderableAnalysis(null)).toBe(false);
    expect(isRenderableAnalysis(undefined)).toBe(false);
    expect(isRenderableAnalysis('chunks')).toBe(false);
    expect(isRenderableAnalysis({ chunks: [], notes: [] })).toBe(false);
    expect(isRenderableAnalysis({ chunks: 'nope', notes: [] })).toBe(false);
    expect(isRenderableAnalysis({ ...ok, notes: 'nope' })).toBe(false);
    expect(isRenderableAnalysis({ chunks: [{ tokens: [] }], notes: [] })).toBe(false);
    expect(isRenderableAnalysis({ chunks: [{ tokens: [{ w: 'hi' }] }], notes: [] })).toBe(false);
  });

  it('tolerates a missing notes list rather than calling the whole analysis bad', () => {
    expect(isRenderableAnalysis({ chunks: ok.chunks })).toBe(true);
  });
});

describe('nextSentencesToPrefetch', () => {
  const s = (id: number): Sentence => ({ id, text: `s${id}`, start: id, end: id + 1 });
  const transcript = [s(1), s(2), s(3), s(4), s(5)];

  it('returns the next sentences in transcript order', () => {
    expect(nextSentencesToPrefetch(transcript, 2, 2).map((x) => x.id)).toEqual([3, 4]);
  });

  it('stops at the end of the lesson instead of wrapping', () => {
    expect(nextSentencesToPrefetch(transcript, 4, 2).map((x) => x.id)).toEqual([5]);
    expect(nextSentencesToPrefetch(transcript, 5, 2)).toEqual([]);
  });

  it('prefetches nothing for an id that is not in this transcript', () => {
    expect(nextSentencesToPrefetch(transcript, 99, 2)).toEqual([]);
    expect(nextSentencesToPrefetch([], 1, 2)).toEqual([]);
  });

  it('follows transcript order, not id arithmetic', () => {
    // Sentence ids come from the SRT and need not be contiguous.
    const gappy = [s(2), s(7), s(9)];
    expect(nextSentencesToPrefetch(gappy, 2, 2).map((x) => x.id)).toEqual([7, 9]);
  });

  it('prefetches nothing when the count is zero or negative', () => {
    expect(nextSentencesToPrefetch(transcript, 1, 0)).toEqual([]);
    expect(nextSentencesToPrefetch(transcript, 1, -1)).toEqual([]);
  });

  it('defaults to the configured prefetch count', () => {
    expect(nextSentencesToPrefetch(transcript, 1)).toHaveLength(SHADOWING_PREFETCH_COUNT);
  });
});

describe('ShadowingRequestTracker', () => {
  it('refuses a second request for a sentence that is already loading', () => {
    const t = new ShadowingRequestTracker();
    expect(t.begin(3)).not.toBeNull();
    expect(t.begin(3)).toBeNull();
    expect(t.isLoading(3)).toBe(true);
  });

  it('frees the sentence when the request ends', () => {
    const t = new ShadowingRequestTracker();
    const token = t.begin(3)!;
    t.end(token);
    expect(t.isLoading(3)).toBe(false);
    expect(t.begin(3)).not.toBeNull();
  });

  it('marks a request from the previous lesson as stale after a lesson switch', () => {
    const t = new ShadowingRequestTracker();
    const lessonA = t.begin(3)!;
    t.reset();
    expect(t.isCurrent(lessonA)).toBe(false);
  });

  it('does not let a previous-lesson request block the same sentence id in the new lesson', () => {
    const t = new ShadowingRequestTracker();
    t.begin(3);
    t.reset();
    expect(t.isLoading(3)).toBe(false);
    const lessonB = t.begin(3);
    expect(lessonB).not.toBeNull();
    expect(t.isCurrent(lessonB!)).toBe(true);
  });

  it('a late end() from the previous lesson leaves the new lesson request loading', () => {
    const t = new ShadowingRequestTracker();
    const lessonA = t.begin(3)!;
    t.reset();
    t.begin(3);
    t.end(lessonA);
    expect(t.isLoading(3)).toBe(true);
  });
});

describe('analysisAudioPath', () => {
  it('maps an upload to its FLAC copy under analysis-audio', () => {
    expect(analysisAudioPath('u1', 'users/u1/media/123-456-talk.mp4')).toBe(
      'users/u1/analysis-audio/123-456-talk.mp4.flac'
    );
  });

  it("rejects another user's upload", () => {
    expect(analysisAudioPath('u1', 'users/u2/media/123-talk.mp4')).toBeNull();
  });

  it('rejects paths outside media/ or with nested segments', () => {
    expect(analysisAudioPath('u1', 'users/u1/analysis-audio/x.flac')).toBeNull();
    expect(analysisAudioPath('u1', 'users/u1/media/../media/x.mp4')).toBeNull();
    expect(analysisAudioPath('u1', 'users/u1/media/')).toBeNull();
  });
});

describe('lessonStoragePaths', () => {
  it('returns the upload and its analysis copy', () => {
    expect(lessonStoragePaths('u1', { mediaPath: 'users/u1/media/1-talk.mp4' })).toEqual([
      'users/u1/media/1-talk.mp4',
      'users/u1/analysis-audio/1-talk.mp4.flac',
    ]);
  });

  it("never returns paths outside the owner's media folder", () => {
    expect(lessonStoragePaths('u1', { mediaPath: 'users/u2/media/1-talk.mp4' })).toEqual([]);
    expect(lessonStoragePaths('u1', { mediaPath: 'public/shared.mp4' })).toEqual([]);
  });

  it('returns nothing for lessons without a mediaPath', () => {
    expect(lessonStoragePaths('u1', {})).toEqual([]);
    expect(lessonStoragePaths('u1', { mediaPath: null })).toEqual([]);
  });
});

describe('firebaseDownloadUrl', () => {
  it('builds a token URL with the path encoded as one segment', () => {
    expect(firebaseDownloadUrl('b.firebasestorage.app', 'users/u1/media/1 talk.mp4', 'tok1,tok2')).toBe(
      'https://firebasestorage.googleapis.com/v0/b/b.firebasestorage.app/o/users%2Fu1%2Fmedia%2F1%20talk.mp4?alt=media&token=tok1'
    );
  });

  it('returns null without a token', () => {
    expect(firebaseDownloadUrl('b', 'p', undefined)).toBeNull();
    expect(firebaseDownloadUrl('b', 'p', '')).toBeNull();
  });
});


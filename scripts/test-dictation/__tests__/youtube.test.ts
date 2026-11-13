import { describe, it, expect } from 'vitest';
import {
  parseYoutubeVideoId,
  pickUploadedEnglishTrack,
  checkSrtFitsVideo,
  videoIdFromFileName,
  lessonNameFromTitle,
} from '@/lib/youtube';
import type { Sentence } from '@/types';

describe('parseYoutubeVideoId', () => {
  it('reads every common link shape', () => {
    const id = 'h-NZcQF7jgI';
    for (const link of [
      `https://youtu.be/${id}?si=y9okBkkj1rxTUnF5`,
      `youtu.be/${id}`,
      `https://www.youtube.com/watch?v=${id}`,
      `https://www.youtube.com/watch?v=${id}&t=42s&list=PL123`,
      `https://m.youtube.com/watch?v=${id}`,
      `https://music.youtube.com/watch?v=${id}`,
      `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/embed/${id}?start=10`,
      `https://www.youtube.com/live/${id}`,
      `https://www.youtube-nocookie.com/embed/${id}`,
      `  https://youtu.be/${id}  `,
    ]) {
      expect(parseYoutubeVideoId(link), link).toBe(id);
    }
  });

  it('rejects text that is not a video link', () => {
    for (const text of [
      '',
      'hello',
      'h-NZcQF7jgI',
      'https://vimeo.com/123456789',
      'https://www.youtube.com/',
      'https://www.youtube.com/watch?v=short',
      'https://www.youtube.com/@bbclearningenglish',
      'https://youtu.be/',
      'https://evil.com/watch?v=h-NZcQF7jgI',
      'https://youtube.com.evil.com/watch?v=h-NZcQF7jgI',
    ]) {
      expect(parseYoutubeVideoId(text), text).toBeNull();
    }
  });
});

describe('pickUploadedEnglishTrack', () => {
  it('prefers en, then en-US, then en-GB, then any en-*', () => {
    expect(pickUploadedEnglishTrack([{ languageCode: 'en-GB' }, { languageCode: 'en' }])?.languageCode).toBe('en');
    expect(pickUploadedEnglishTrack([{ languageCode: 'en-GB' }, { languageCode: 'en-US' }])?.languageCode).toBe('en-US');
    expect(pickUploadedEnglishTrack([{ languageCode: 'en-AU' }, { languageCode: 'en-GB' }])?.languageCode).toBe('en-GB');
    expect(pickUploadedEnglishTrack([{ languageCode: 'fr' }, { languageCode: 'en-AU' }])?.languageCode).toBe('en-AU');
  });

  it('skips auto-generated and non-English tracks', () => {
    expect(pickUploadedEnglishTrack([])).toBeNull();
    expect(pickUploadedEnglishTrack([{ languageCode: 'en', kind: 'asr' }])).toBeNull();
    expect(pickUploadedEnglishTrack([{ languageCode: 'vi' }, { languageCode: 'eo' }])).toBeNull();
    expect(pickUploadedEnglishTrack([{ languageCode: 'en', kind: '' }])?.languageCode).toBe('en');
  });
});

describe('checkSrtFitsVideo', () => {
  const s = (start: number, end: number): Sentence => ({ id: start, start, end, text: 'x' });

  it('accepts subtitles that end inside the video', () => {
    expect(checkSrtFitsVideo([s(0, 1), s(1, 381)], 382)).toBeNull();
    expect(checkSrtFitsVideo([s(0, 383.5)], 382)).toBeNull();
  });

  it('rejects an empty file and one longer than the video', () => {
    expect(checkSrtFitsVideo([], 382)).toMatch(/No subtitles/);
    expect(checkSrtFitsVideo([s(0, 1), s(500, 505)], 382)).toMatch(/longer than the video/);
  });

  it('skips the length check when the duration is unknown', () => {
    expect(checkSrtFitsVideo([s(0, 9999)], 0)).toBeNull();
  });
});

describe('videoIdFromFileName', () => {
  it('reads the id from yt-dlp names', () => {
    expect(videoIdFromFileName('David_Goggins_Mindset-_Hard_truths_-nMxwlqdl7I.srt')).toBe('-nMxwlqdl7I');
    expect(videoIdFromFileName('Learning_from_generations_h-NZcQF7jgI.en-GB.srt')).toBe('h-NZcQF7jgI');
    expect(videoIdFromFileName('Learning_from_generations_h-NZcQF7jgI.en.srt')).toBe('h-NZcQF7jgI');
    expect(videoIdFromFileName('Learning from generations [h-NZcQF7jgI].srt')).toBe('h-NZcQF7jgI');
  });

  it('returns null when the name has no id', () => {
    expect(videoIdFromFileName('Software_Engineering.srt')).toBeNull();
    expect(videoIdFromFileName('my subtitles.srt')).toBeNull();
  });
});

describe('lessonNameFromTitle', () => {
  it('lowercases, drops emoji and the part after " | "', () => {
    expect(lessonNameFromTitle('Learning from different generations ⏲️ 6 Minute English')).toBe(
      'learning from different generations 6 minute english'
    );
    expect(lessonNameFromTitle('Do schools kill creativity? | Sir Ken Robinson | TED')).toBe(
      'do schools kill creativity?'
    );
  });
});

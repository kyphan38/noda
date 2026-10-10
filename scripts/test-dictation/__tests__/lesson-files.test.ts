import { describe, it, expect } from 'vitest';
import { lessonNameFromFile, pairLessonFiles } from '@/lib/lessonFiles';

const file = (name: string, type = '') => new File(['x'], name, { type });

describe('lessonNameFromFile', () => {
  it('makes a lowercase name with spaces from a yt-dlp file name', () => {
    expect(
      lessonNameFromFile('How_to_Build_Extreme_Willpower___David_Goggins___Dr._Andrew_Huberman_84dYijIpWjQ.mp3')
    ).toBe('how to build extreme willpower');
    expect(lessonNameFromFile('Why_People_Think_The_Government_Killed_JFK_2r5eKpptixo.mp4')).toBe(
      'why people think the government killed jfk'
    );
    expect(lessonNameFromFile('Naval_Ravikant_-_11_Rules_For_Life__Genius_Rules__TmAO9jBqJf4.mp3')).toBe(
      'naval ravikant - 11 rules for life genius rules'
    );
  });

  it('drops a video id that starts with a dash', () => {
    expect(lessonNameFromFile('Hard_truths_-nMxwlqdl7I.mp4')).toBe('hard truths');
  });

  it('keeps a real 11-letter last word', () => {
    expect(lessonNameFromFile('Software_Engineering.mp3')).toBe('software engineering');
  });

  it('handles plain names', () => {
    expect(lessonNameFromFile('My Talk.mp3')).toBe('my talk');
    expect(lessonNameFromFile('Download_1.mp4')).toBe('download 1');
  });
});

describe('pairLessonFiles', () => {
  it('pairs media with the .srt of the same name, ignoring case and other files', () => {
    const { pairs, unmatchedTranscripts, ignored } = pairLessonFiles([
      file('B_Talk_84dYijIpWjQ.mp3', 'audio/mpeg'),
      file('B_Talk_84dYijIpWjQ.srt'),
      file('a_clip.MP4', 'video/mp4'),
      file('A_CLIP.srt'),
      file('B_Talk_84dYijIpWjQ.whisper.json', 'application/json'),
      file('orphan.srt'),
    ]);
    expect(pairs.map((p) => [p.name, p.media.name, p.transcript?.name ?? null])).toEqual([
      ['a clip', 'a_clip.MP4', 'A_CLIP.srt'],
      ['b talk', 'B_Talk_84dYijIpWjQ.mp3', 'B_Talk_84dYijIpWjQ.srt'],
    ]);
    expect(unmatchedTranscripts.map((f) => f.name)).toEqual(['orphan.srt']);
    expect(ignored.map((f) => f.name)).toEqual(['B_Talk_84dYijIpWjQ.whisper.json']);
  });

  it('allows media without a transcript', () => {
    const { pairs } = pairLessonFiles([file('one.mp3', 'audio/mpeg'), file('two.mp3', 'audio/mpeg')]);
    expect(pairs.map((p) => p.transcript)).toEqual([null, null]);
  });
});

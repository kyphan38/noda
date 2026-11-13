import { describe, it, expect } from 'vitest';
import { parseClipSource, youtubeClipPart } from '../../../functions/src/lib/clipSource';

describe('parseClipSource', () => {
  it('reads an upload path', () => {
    expect(parseClipSource({ mediaStoragePath: 'users/u/media/a.mp3' })).toEqual({
      kind: 'storage',
      mediaStoragePath: 'users/u/media/a.mp3',
    });
  });

  it('reads a youtube video id', () => {
    expect(parseClipSource({ youtubeVideoId: 'h-NZcQF7jgI' })).toEqual({
      kind: 'youtube',
      youtubeVideoId: 'h-NZcQF7jgI',
    });
    expect(parseClipSource({ youtubeVideoId: 'h-NZcQF7jgI', mediaStoragePath: '' })).toMatchObject({ kind: 'youtube' });
  });

  it('rejects both, neither, and anything that is not a video id', () => {
    expect(parseClipSource({ mediaStoragePath: 'users/u/media/a.mp3', youtubeVideoId: 'h-NZcQF7jgI' })).toHaveProperty('error');
    expect(parseClipSource({})).toHaveProperty('error');
    expect(parseClipSource({ mediaStoragePath: '  ' })).toHaveProperty('error');
    for (const bad of ['short', 'h-NZcQF7jgI&x=1', 'https://youtu.be/h-NZcQF7jgI', 42, {}]) {
      expect(parseClipSource({ youtubeVideoId: bad }), String(bad)).toHaveProperty('error');
    }
  });
});

describe('youtubeClipPart', () => {
  it('builds the watch URL and a time range in seconds', () => {
    expect(youtubeClipPart('h-NZcQF7jgI', 15.36, 16.8)).toEqual({
      fileData: { fileUri: 'https://www.youtube.com/watch?v=h-NZcQF7jgI', mimeType: 'video/*' },
      videoMetadata: { startOffset: '15.36s', endOffset: '16.80s' },
    });
  });
});

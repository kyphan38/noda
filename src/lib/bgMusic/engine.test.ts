import { describe, expect, it } from 'vitest';

import { createBgMusicEngine, noopBgMusicEngine } from './engine';

describe('createBgMusicEngine', () => {
  it('returns the silent engine where there is no Web Audio', () => {
    const engine = createBgMusicEngine();
    expect(engine).toBe(noopBgMusicEngine);
    expect(() => {
      engine.unlock();
      engine.setSource('x.mp3');
      engine.setActive(true);
      engine.dispose();
    }).not.toThrow();
  });
});

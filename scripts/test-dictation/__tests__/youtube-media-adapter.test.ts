import { describe, it, expect, beforeEach } from 'vitest';
import { YoutubeMediaAdapter } from '@/lib/youtubeMediaAdapter';
import { YT_STATE, type YTPlayer } from '@/lib/youtubeIframeApi';

/** A fake player whose reports lag our commands, like the real one. */
function fakePlayer() {
  const p = {
    time: 0,
    state: YT_STATE.UNSTARTED as number,
    rate: 1,
    duration: 382,
    calls: [] as string[],
    seekTo(t: number) {
      p.calls.push(`seek:${t}`);
    },
    playVideo() {
      p.calls.push('play');
    },
    pauseVideo() {
      p.calls.push('pause');
    },
    getCurrentTime: () => p.time,
    getDuration: () => p.duration,
    getPlayerState: () => p.state,
    getPlaybackRate: () => p.rate,
    setPlaybackRate(r: number) {
      // YouTube rounds to a rate it has.
      p.rate = Math.round(r * 4) / 4;
    },
  };
  return p;
}

let clock = 0;
let player: ReturnType<typeof fakePlayer>;
let media: YoutubeMediaAdapter;
let events: string[];

beforeEach(() => {
  clock = 10_000;
  player = fakePlayer();
  media = new YoutubeMediaAdapter(() => clock);
  media.attach(player as unknown as YTPlayer);
  player.calls = [];
  events = [];
  for (const type of ['play', 'pause', 'playing', 'waiting', 'ended', 'seeking', 'error', 'loadedmetadata']) {
    media.addEventListener(type, () => events.push(type));
  }
});

describe('YoutubeMediaAdapter', () => {
  it('flips paused at once on play and pause, like a media element', async () => {
    expect(media.paused).toBe(true);
    await media.play();
    expect(media.paused).toBe(false);
    media.pause();
    expect(media.paused).toBe(true);
    expect(events).toEqual(['play', 'pause']);
    expect(player.calls).toEqual(['play', 'pause']);
  });

  it('reports the seek target until the player catches up', () => {
    player.time = 10;
    media.currentTime = 42.5;
    expect(player.calls).toEqual(['seek:42.5']);
    expect(media.currentTime).toBe(42.5);
    expect(media.seeking).toBe(true);
    player.time = 42.6;
    expect(media.seeking).toBe(false);
    expect(media.currentTime).toBe(42.6);
  });

  it('stops holding a seek target that never lands', () => {
    player.time = 10;
    media.currentTime = 42.5;
    clock += 2500;
    expect(media.currentTime).toBe(10);
    expect(media.seeking).toBe(false);
  });

  it('clamps bad seek targets to 0', () => {
    media.currentTime = -3;
    media.currentTime = Number.NaN;
    expect(player.calls).toEqual(['seek:0', 'seek:0']);
  });

  it('ignores a late state report that contradicts our last command', async () => {
    await media.play();
    media.pause();
    clock += 300;
    media.handleStateChange(YT_STATE.PLAYING); // from the play, arriving after the pause
    expect(media.paused).toBe(true);
    await media.play();
    clock += 300;
    media.handleStateChange(YT_STATE.PAUSED); // from the pause, arriving after the replay
    expect(media.paused).toBe(false);
  });

  it('follows play and pause started from the YouTube frame', () => {
    media.handleStateChange(YT_STATE.PLAYING);
    expect(media.paused).toBe(false);
    media.handleStateChange(YT_STATE.PAUSED);
    expect(media.paused).toBe(true);
    expect(events).toEqual(['playing', 'play', 'pause']);
  });

  it('pauses on end and on error', async () => {
    await media.play();
    media.handleStateChange(YT_STATE.ENDED);
    expect(media.paused).toBe(true);
    await media.play();
    media.handleError();
    expect(media.paused).toBe(true);
    expect(events).toEqual(['play', 'pause', 'ended', 'play', 'pause', 'error']);
  });

  it('gives up on a play the browser blocked', async () => {
    await media.play();
    player.state = YT_STATE.UNSTARTED;
    clock += 1000;
    void media.currentTime;
    expect(media.paused).toBe(false);
    clock += 2000;
    void media.currentTime;
    expect(media.paused).toBe(true);
  });

  it('does not give up while the video buffers', async () => {
    await media.play();
    player.state = YT_STATE.BUFFERING;
    clock += 5000;
    void media.currentTime;
    expect(media.paused).toBe(false);
  });

  it('maps buffering to waiting', () => {
    media.handleStateChange(YT_STATE.BUFFERING);
    expect(events).toEqual(['waiting']);
  });

  it('reports the asked rate until the player applies it, then the real one', () => {
    media.playbackRate = 0.8;
    expect(media.playbackRate).toBe(0.8);
    clock += 1500;
    expect(media.playbackRate).toBe(0.75);
  });

  it('passes duration through', () => {
    expect(media.duration).toBe(382);
    player.duration = 0;
    expect(Number.isNaN(media.duration)).toBe(true);
  });

  it('stops calling removed listeners', async () => {
    const seen: string[] = [];
    const listener = () => seen.push('x');
    media.addEventListener('play', listener);
    media.removeEventListener('play', listener);
    await media.play();
    expect(seen).toEqual([]);
  });
});

describe('YoutubeMediaAdapter before the player is ready', () => {
  it('keeps a seek and a play, then applies them on attach', async () => {
    const early = new YoutubeMediaAdapter(() => clock);
    const seen: string[] = [];
    early.addEventListener('play', () => seen.push('play'));
    early.addEventListener('loadedmetadata', () => seen.push('loadedmetadata'));
    early.currentTime = 30;
    early.playbackRate = 0.75;
    await early.play();
    expect(early.currentTime).toBe(30);
    expect(early.playbackRate).toBe(0.75);
    expect(early.paused).toBe(false);
    expect(Number.isNaN(early.duration)).toBe(true);

    const p = fakePlayer();
    early.attach(p as unknown as YTPlayer);
    expect(p.calls).toEqual(['seek:30', 'play']);
    expect(p.rate).toBe(0.75);
    expect(seen).toEqual(['play', 'loadedmetadata']);
  });

  it('keeps a seek still when no play was asked for', () => {
    const early = new YoutubeMediaAdapter(() => clock);
    early.currentTime = 12;
    const p = fakePlayer();
    early.attach(p as unknown as YTPlayer);
    expect(p.calls).toEqual(['seek:12', 'pause']);
    expect(early.paused).toBe(true);
  });

  it('reads 0 and paused with nothing asked', () => {
    const early = new YoutubeMediaAdapter(() => clock);
    expect(early.currentTime).toBe(0);
    expect(early.paused).toBe(true);
    expect(early.seeking).toBe(false);
    expect(early.playbackRate).toBe(1);
  });
});

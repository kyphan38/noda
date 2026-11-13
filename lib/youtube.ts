import type { Sentence } from '@/types';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Video id from a YouTube link, or null when the text is not one. */
export function parseYoutubeVideoId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1] ?? null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else id = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/]+)/)?.[1] ?? null;
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

/** One entry of the embedded player's `getOption('captions', 'tracklist')`. */
export interface YoutubeCaptionTrack {
  languageCode: string;
  /** "asr" for auto-generated captions; empty for tracks the channel uploaded. */
  kind?: string;
  displayName?: string;
}

const PREFERRED_ENGLISH = ['en', 'en-US', 'en-GB'];

/**
 * The uploaded English track, or null. The player's tracklist leaves out
 * auto-generated tracks today; the `kind` check keeps that true if it changes.
 */
export function pickUploadedEnglishTrack(tracks: readonly YoutubeCaptionTrack[]): YoutubeCaptionTrack | null {
  const english = tracks.filter((t) => /^en(-|$)/i.test(t.languageCode) && !t.kind);
  for (const code of PREFERRED_ENGLISH) {
    const match = english.find((t) => t.languageCode === code);
    if (match) return match;
  }
  return english[0] ?? null;
}

/** A subtitle may end a little after the video's reported length. */
const SRT_END_SLACK_SEC = 2;

/**
 * Why a parsed .srt does not fit a video of `durationSec`, or null. Catches an
 * empty file and a file made for a longer video. Unknown duration (0) skips
 * the length check.
 */
export function checkSrtFitsVideo(sentences: readonly Sentence[], durationSec: number): string | null {
  if (sentences.length === 0) return 'No subtitles found in this file.';
  const lastEnd = Math.max(...sentences.map((s) => s.end));
  if (durationSec > 0 && lastEnd > durationSec + SRT_END_SLACK_SEC) {
    return 'This .srt is longer than the video.';
  }
  return null;
}

/**
 * Video id in a yt-dlp file name, or null: "Title_<id>.srt", "Title_<id>.en-GB.srt"
 * or the yt-dlp default "Title [<id>].srt". A "_<id>" ending only counts when
 * it looks random (see lessonNameFromFile), so "_Engineering" is not an id.
 */
export function videoIdFromFileName(fileName: string): string | null {
  const stem = fileName.replace(/\.srt$/i, '').replace(/\.[a-z]{2,3}(-[A-Za-z0-9]{2,4})?$/, '');
  const bracket = stem.match(/\[([A-Za-z0-9_-]{11})\]$/);
  if (bracket) return bracket[1];
  const tail = stem.match(/_([A-Za-z0-9_-]{11})$/);
  return tail && /[0-9_-]|.[A-Z]/.test(tail[1]) ? tail[1] : null;
}

/** Lesson name from a video title, in the same style as lessonNameFromFile. */
export function lessonNameFromTitle(title: string): string {
  const cut = title.split(' | ')[0];
  return cut
    .replace(/[\p{Extended_Pictographic}️]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

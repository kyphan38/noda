/** File checks for new lessons, and pairing media with .srt files dropped together. */

export const MEDIA_MAX_BYTES = 200 * 1024 * 1024;
export const MEDIA_WARN_BYTES = 100 * 1024 * 1024;

export function isAcceptedLessonMedia(file: File): boolean {
  const name = file.name.toLowerCase();
  if (file.type.startsWith('audio/')) return true;
  if (file.type === 'video/mp4' || file.type === 'video/webm') return true;
  if (/\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name)) return true;
  if (name.endsWith('.webm') && (file.type === '' || file.type === 'application/octet-stream')) return true;
  if (name.endsWith('.mp4')) {
    if (file.type === '' || file.type === 'application/octet-stream') return true;
    return file.type.startsWith('video/');
  }
  return false;
}

/** Reject obvious extension vs MIME mismatch (AC 1.1.4). */
export function isExtensionMimeMismatch(file: File): boolean {
  const name = file.name.toLowerCase();
  const t = file.type;
  if (!t || t === 'application/octet-stream') return false;
  if (name.endsWith('.mp4')) return !t.startsWith('video/');
  if (name.endsWith('.webm')) return !t.startsWith('video/') && !t.startsWith('audio/');
  return false;
}

export function mediaTypeFromFile(file: File): 'audio' | 'video' {
  if (file.type.startsWith('video/')) return 'video';
  if (file.name.toLowerCase().endsWith('.mp4')) return 'video';
  return 'audio';
}

export function isSrtFile(file: File) {
  return file.name.toLowerCase().endsWith('.srt') || file.type === 'application/x-subrip' || file.type === 'text/plain';
}

/** File name without its last extension: "Talk.v2.mp4" -> "Talk.v2". */
export function fileStem(name: string): string {
  return name.replace(/\.[^/.]+$/, '');
}

/**
 * Lesson name for a downloaded file, lowercase with spaces:
 * "How_to_Build_Extreme_Willpower___David_Goggins___Dr._Andrew_Huberman_84dYijIpWjQ.mp3"
 * -> "how to build extreme willpower".
 *
 * yt-dlp file names (scripts/generate-transcript.py) end in "_<11-char video id>"
 * and write " | " as "___"; the part after it is usually the channel or guest.
 * The id is only dropped when it looks random (a digit, "-", "_", or an inner
 * capital), so a real 11-letter last word like "_Engineering" stays.
 */
export function lessonNameFromFile(fileName: string): string {
  let name = fileStem(fileName);
  const id = name.match(/_([A-Za-z0-9_-]{11})$/);
  if (id && /[0-9_-]|.[A-Z]/.test(id[1])) name = name.slice(0, -12);
  const cut = name.indexOf('___');
  if (cut > 0) name = name.slice(0, cut);
  const pretty = name.replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  return pretty || fileStem(fileName);
}

/** Why a media file cannot become a lesson, or null when it can. */
export function mediaFileError(file: File): string | null {
  if (file.size > MEDIA_MAX_BYTES) {
    return 'File is too large (200MB max). Compress the video or extract audio before importing.';
  }
  if (!isAcceptedLessonMedia(file)) return 'Invalid file. Supported: common audio formats, MP4, and WebM.';
  if (isExtensionMimeMismatch(file)) return 'File type does not match extension (e.g. use real MP4/WebM).';
  return null;
}

export interface LessonFilePair {
  /** Lesson name from the media file name (lessonNameFromFile). */
  name: string;
  media: File;
  transcript: File | null;
}

export interface PairedLessonFiles {
  pairs: LessonFilePair[];
  /** .srt files with no media of the same name. */
  unmatchedTranscripts: File[];
  /** Neither media nor .srt (e.g. the .json files the transcript script writes). */
  ignored: File[];
}

/**
 * Pairs media with the .srt of the same name, ignoring case: "Talk.mp4" +
 * "talk.srt" -> one lesson "Talk". Only a real .srt extension counts here; the
 * single-file transcript box also takes text/plain, but in a mixed drop that
 * would grab unrelated text files.
 */
export function pairLessonFiles(files: readonly File[]): PairedLessonFiles {
  const transcripts = new Map<string, File>();
  const media: File[] = [];
  const ignored: File[] = [];
  for (const f of files) {
    if (f.name.toLowerCase().endsWith('.srt')) transcripts.set(fileStem(f.name).toLowerCase(), f);
    else if (isAcceptedLessonMedia(f)) media.push(f);
    else ignored.push(f);
  }

  const used = new Set<string>();
  const pairs = media
    .map((m) => {
      const key = fileStem(m.name).toLowerCase();
      const transcript = transcripts.get(key) ?? null;
      if (transcript) used.add(key);
      return { name: lessonNameFromFile(m.name), media: m, transcript };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const unmatchedTranscripts = [...transcripts.entries()].filter(([k]) => !used.has(k)).map(([, f]) => f);
  return { pairs, unmatchedTranscripts, ignored };
}

import type { FlashcardData, LessonRecord } from '@/lib/db';
import { getLesson, getLessonsForGistExport, saveLesson } from '@/lib/db';

const GIST_FILENAME = 'noda-data.json';
const LAST_SYNC_KEY = 'noda_last_sync';

export type NodaExportLesson = {
  id: string;
  type?: 'audio' | 'flashcard';
  /** Omitted from JSON file; set on merge for audio lessons. */
  mediaType?: 'audio' | 'video';
  name: string;
  language: string;
  transcriptText: string;
  completedSentences: Record<number, boolean>;
  totalSentences: number;
  createdAt: number;
  lastAccessed: number;
  /** Required for merge; older files without it treated as 0. */
  updatedAt: number;
  isTrashed?: boolean;
  trashedAt?: number;
  flashcardData?: FlashcardData;
};

/** Trim and strip accidental `Bearer ` if the whole header was pasted into .env */
function normalizePat(raw: string | undefined): string {
  let t = (raw ?? '').trim();
  if (/^bearer\s+/i.test(t)) t = t.replace(/^bearer\s+/i, '').trim();
  return t;
}

function getToken(): string {
  const t = normalizePat(process.env.NEXT_PUBLIC_GIST_TOKEN);
  if (!t) {
    throw new Error(
      'NEXT_PUBLIC_GIST_TOKEN is missing or empty. For this app (static export), vars are baked in at build time — set secrets for CI, then rebuild/redeploy; locally run `npm run dev` or `npm run build` after editing .env.local.'
    );
  }
  return t;
}

/** Accepts bare hex id or full gist URL; GitHub API path needs the id only. */
function parseGistIdFromEnv(raw: string): string {
  let s = normalizePat(raw);
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (u.hostname === 'gist.github.com' || u.hostname === 'www.gist.github.com') {
        const parts = u.pathname.split('/').filter(Boolean);
        const last = parts[parts.length - 1];
        if (last && /^[0-9a-f]{20,40}$/i.test(last)) s = last;
      }
    } catch {
      /* keep s */
    }
  }
  return s;
}

function getGistId(): string {
  const id = parseGistIdFromEnv(process.env.NEXT_PUBLIC_GIST_ID ?? '');
  if (!id) {
    throw new Error(
      'NEXT_PUBLIC_GIST_ID is missing or empty. Use the gist id (hex string) or paste the full https://gist.github.com/... URL.'
    );
  }
  return id;
}

async function readGithubErrorBody(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { message?: string; documentation_url?: string };
    if (j?.message) {
      return `${res.status} ${j.message}${j.documentation_url ? ` — ${j.documentation_url}` : ''}`;
    }
  } catch {
    /* use raw */
  }
  return `${res.status} ${text.slice(0, 280)}${text.length > 280 ? '…' : ''}`;
}

export function lessonToExportRow(lesson: LessonRecord): NodaExportLesson {
  const { mediaFile: _omit, ...rest } = lesson;
  return rest as NodaExportLesson;
}

function parseExportPayload(text: string): NodaExportLesson[] {
  const data = JSON.parse(text) as unknown;
  if (!Array.isArray(data)) throw new Error('Gist JSON must be an array');
  return data as NodaExportLesson[];
}

/** Merge one remote row: blob preservation order; winner by updatedAt. */
export async function mergeRemoteLesson(remote: NodaExportLesson): Promise<void> {
  const existing = await getLesson(remote.id);
  const localBlob = existing?.mediaFile;

  const rU = typeof remote.updatedAt === 'number' ? remote.updatedAt : 0;
  const lU = existing && typeof existing.updatedAt === 'number' ? existing.updatedAt : 0;

  let winner: LessonRecord;

  if (!existing) {
    winner = {
      ...remote,
      mediaFile: localBlob ?? null,
      mediaType: remote.mediaType ?? 'audio',
      updatedAt: typeof remote.updatedAt === 'number' ? remote.updatedAt : Date.now(),
    } as LessonRecord;
  } else if (rU >= lU) {
    winner = {
      ...existing,
      ...remote,
      mediaFile: localBlob ?? null,
      mediaType: remote.mediaType ?? existing.mediaType ?? 'audio',
    } as LessonRecord;
  } else {
    winner = {
      ...existing,
      mediaFile: localBlob ?? null,
    };
  }

  winner.mediaFile = localBlob ?? null;
  if (winner.type !== 'flashcard' && winner.mediaType == null) {
    winner.mediaType = 'audio';
  }
  await saveLesson(winner);
}

export async function pushToGist(): Promise<void> {
  const token = getToken();
  const gistId = getGistId();
  const lessons = await getLessonsForGistExport();
  const rows: NodaExportLesson[] = lessons.map(lessonToExportRow);
  if (rows.length === 0) {
    return;
  }
  let content: string;
  try {
    content = JSON.stringify(rows);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Cannot serialize lessons for Gist: ${msg}`);
  }

  let res: Response;
  try {
    res = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: {
          [GIST_FILENAME]: { content },
        },
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Network error calling GitHub: ${msg}`);
  }

  if (!res.ok) {
    const detail = await readGithubErrorBody(res);
    throw new Error(`Gist push failed: ${detail}`);
  }

  if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
    localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
  }
}

export async function pullFromGist(): Promise<void> {
  const token = getToken();
  const gistId = getGistId();

  let res: Response;
  try {
    res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Network error calling GitHub: ${msg}`);
  }

  if (!res.ok) {
    const detail = await readGithubErrorBody(res);
    throw new Error(`Gist fetch failed: ${detail}`);
  }

  const body = (await res.json()) as {
    files?: Record<string, { content?: string }>;
  };
  const file = body.files?.[GIST_FILENAME];
  const content = file?.content;
  if (content == null || content === '') {
    throw new Error(`Gist is missing file ${GIST_FILENAME}`);
  }

  const remotes = parseExportPayload(content);
  for (const row of remotes) {
    if (!row?.id) continue;
    if (row.type !== 'flashcard') continue;
    await mergeRemoteLesson(row);
  }
}

export function getLastSyncTime(): Date | null {
  if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
    return null;
  }
  const raw = localStorage.getItem(LAST_SYNC_KEY);
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return new Date(n);
}

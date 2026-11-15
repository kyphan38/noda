/** Export every lesson, its sub-documents and the folders to one JSON file. Pure: reads live in db.ts. */

export type ExportDoc = { id: string } & Record<string, unknown>;

export type ExportLesson = ExportDoc & {
  content: ExportDoc[];
  shadowingAnalysis: ExportDoc[];
  speakingAttempts: ExportDoc[];
};

export type ExportInput = { lessons: ExportLesson[]; sidebarFolders: ExportDoc[] };

/** Sub-collections under users/{uid}/lessons/{id}. Media files stay in Storage; only their URLs are in the lesson. */
export const LESSON_SUBCOLLECTIONS = ['content', 'shadowingAnalysis', 'speakingAttempts'] as const;

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function exportFilename(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `noda-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

export function buildExport(data: ExportInput, exportedAt: number): string {
  const lessons = [...data.lessons].sort(byId).map((l) => ({
    ...l,
    content: [...l.content].sort(byId),
    shadowingAnalysis: [...l.shadowingAnalysis].sort(byId),
    speakingAttempts: [...l.speakingAttempts].sort(byId),
  }));
  const sidebarFolders = [...data.sidebarFolders].sort(byId);
  return JSON.stringify(
    {
      app: 'noda',
      version: 1,
      exportedAt: new Date(exportedAt).toISOString(),
      counts: { lessons: lessons.length, sidebarFolders: sidebarFolders.length },
      lessons,
      sidebarFolders,
    },
    null,
    2,
  );
}

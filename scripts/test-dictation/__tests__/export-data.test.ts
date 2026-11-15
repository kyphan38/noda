import { describe, expect, it } from 'vitest';
import { buildExport, exportFilename } from '@/lib/exportData';

describe('buildExport', () => {
  it('sorts lessons and sub-documents by id and counts them', () => {
    const out = JSON.parse(
      buildExport(
        {
          lessons: [
            { id: 'b', name: 'B', content: [], shadowingAnalysis: [], speakingAttempts: [] },
            { id: 'a', name: 'A', content: [{ id: 'main' }], shadowingAnalysis: [{ id: '2' }, { id: '1' }], speakingAttempts: [] },
          ],
          sidebarFolders: [{ id: 'f1', name: 'Folder' }],
        },
        Date.UTC(2026, 10, 15),
      ),
    );
    expect(out.app).toBe('noda');
    expect(out.exportedAt).toBe('2026-11-15T00:00:00.000Z');
    expect(out.counts).toEqual({ lessons: 2, sidebarFolders: 1 });
    expect(out.lessons.map((l: { id: string }) => l.id)).toEqual(['a', 'b']);
    expect(out.lessons[0].shadowingAnalysis.map((d: { id: string }) => d.id)).toEqual(['1', '2']);
  });
});

describe('exportFilename', () => {
  it('uses the local date', () => {
    expect(exportFilename(new Date(2026, 10, 5, 23, 0))).toBe('noda-2026-11-05.json');
  });
});

'use client';

import { useCallback, useState } from 'react';

import { readAllForExport } from '@/lib/db';
import { buildExport, exportFilename } from '@/lib/exportData';

/** Downloads all data as one .json file. */
export function useExportAll() {
  const [exporting, setExporting] = useState(false);

  const exportAll = useCallback(async () => {
    setExporting(true);
    try {
      const now = Date.now();
      const json = buildExport(await readAllForExport(), now);
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFilename(new Date(now));
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Safari reads the blob after click returns, so revoke later.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.warn('[export]', err);
    } finally {
      setExporting(false);
    }
  }, []);

  return { exporting, exportAll };
}

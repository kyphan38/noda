/**
 * One-time auth-state capture script.
 *
 * Run ONCE (with the dev server running):
 *   npx tsx scripts/setup-auth.ts
 *
 * A visible Chromium window opens. Log in with Google.
 * The script automatically detects when auth completes,
 * saves localStorage + IndexedDB auth state to scripts/.auth.json,
 * and closes.
 */
import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const APP_URL = 'http://localhost:3000';
// Use cwd so this works regardless of __dirname resolution in ESM
const AUTH_FILE = path.join(process.cwd(), 'scripts', '.auth.json');

async function readIdbAuthData(page: import('@playwright/test').Page): Promise<unknown[]> {
  return page.evaluate(() => {
    return new Promise<unknown[]>((resolve) => {
      try {
        const req = indexedDB.open('firebaseLocalStorageDb', 1);
        req.onsuccess = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          try {
            const tx = db.transaction('firebaseLocalStorage', 'readonly');
            const store = tx.objectStore('firebaseLocalStorage');
            const allReq = store.getAll();
            allReq.onsuccess = () => resolve(allReq.result ?? []);
            allReq.onerror = () => resolve([]);
          } catch {
            resolve([]);
          }
        };
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  });
}

async function main() {
  console.log('\n🔑  noda auth setup');
  console.log('Make sure the dev server is running (npm run dev).\n');
  console.log('A browser window will open. Log in with Google and wait for the sidebar to appear.\n');

  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(APP_URL);

  console.log('Waiting for you to log in and for the app sidebar to appear…');

  // Poll until either the sidebar or the upload panel is visible - this indicates
  // auth completed and the main app has loaded.
  await page.waitForFunction(
    () => {
      // Sidebar toggle button or lesson list or upload panel - any of these
      // means we are past the login screen.
      return (
        document.querySelector('[class*="sidebar"]') !== null ||
        document.querySelector('input[type="file"][accept="audio/*"]') !== null ||
        document.querySelector('nav[aria-label="Lesson mode"]') !== null ||
        // The "Continue with Google" button being GONE is another signal
        !document.querySelector('button')
      );
    },
    { timeout: 120_000 } // 2 min to log in
  );

  // Give a moment for Firebase to finish writing its auth tokens to storage
  await new Promise((r) => setTimeout(r, 1500));

  const storageState = await context.storageState();
  const idbData = await readIdbAuthData(page);

  if (idbData.length > 0) {
    console.log(`✓ Captured ${idbData.length} IndexedDB auth entry/entries.`);
  } else {
    console.log('⚠  No IDB auth entries (Firebase may be using localStorage - that is fine).');
  }

  fs.writeFileSync(AUTH_FILE, JSON.stringify({ storageState, idbData }, null, 2));
  console.log(`\n✅  Saved to: ${AUTH_FILE}`);
  console.log('You can now run: npx tsx scripts/test-dictation.ts\n');

  await browser.close();
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Vitest global setup - unzips audio SRT fixtures into audio/ before tests run.
 * The audio/ directory is gitignored; the zip is tracked in git for portability.
 */
export function setup() {
  const zipPath = path.join(process.cwd(), 'scripts', 'fixtures', 'audio-srt.zip');
  const audioDir = path.join(process.cwd(), 'audio');

  if (!fs.existsSync(zipPath)) return;

  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }

  execSync(`unzip -o "${zipPath}" -d "${audioDir}"`, { stdio: 'ignore' });
}

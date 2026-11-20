/**
 * Text clean-up for model output, applied to the raw JSON before parsing.
 * No imports, so the app's vitest suite can load it.
 */

/** The long dash, built from its code so it never appears in this source (house rule). */
const LONG_DASH = String.fromCharCode(0x2014);
const AROUND = new RegExp(`\\s*${LONG_DASH}\\s*`, "g");

/** The app never shows a long dash: the model's become commas. Safe on JSON text (only inside strings). */
export function noLongDash(s: string): string {
  return s.replace(AROUND, ", ").replace(/,\s*([,.?!])/g, "$1");
}

// noda - Talk: text clean-up for what the AI writes. Pure.

/** The long dash, built from its code so it never appears in this source (house rule). */
const LONG_DASH = String.fromCharCode(0x2014);
const AROUND = new RegExp(`\\s*${LONG_DASH}\\s*`, 'g');

/** "fees<long dash>does that" -> "fees, does that". Older saved talks show clean too. */
export function noLongDash(s: string): string {
  return s.replace(AROUND, ', ').replace(/,\s*([,.?!])/g, '$1');
}

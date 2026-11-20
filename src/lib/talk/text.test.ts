import { describe, expect, it } from 'vitest';
import { noLongDash } from './text';

const D = String.fromCharCode(0x2014);

describe('noLongDash', () => {
  it('turns a long dash into a comma, with or without spaces', () => {
    expect(noLongDash(`Got it, thanks Andy${D}pulling up ABC now.`)).toBe('Got it, thanks Andy, pulling up ABC now.');
    expect(noLongDash(`no early fees ${D} does that work?`)).toBe('no early fees, does that work?');
    expect(noLongDash(`Wait${D}?`)).toBe('Wait?');
    expect(noLongDash('plain - hyphen stays')).toBe('plain - hyphen stays');
  });
});

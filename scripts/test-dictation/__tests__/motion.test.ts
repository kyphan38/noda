import { describe, it, expect } from 'vitest';
import { reducedMotion } from '../../../lib/motion';

describe('reducedMotion', () => {
  it('is true in Node, where matchMedia does not exist', () => {
    expect(reducedMotion()).toBe(true);
  });
});

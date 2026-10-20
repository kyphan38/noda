import { describe, it, expect } from 'vitest';
import { drawerOffset, drawerShouldClose, reducedMotion } from '../../../lib/motion';

describe('reducedMotion', () => {
  it('is true in Node, where matchMedia does not exist', () => {
    expect(reducedMotion()).toBe(true);
  });
});

describe('drawerShouldClose', () => {
  it('closes past a third of the width', () => {
    expect(drawerShouldClose(-120, 288, 0)).toBe(true);
  });
  it('springs back on a short slow drag', () => {
    expect(drawerShouldClose(-40, 288, -0.1)).toBe(false);
  });
  it('closes on a short fast flick left', () => {
    expect(drawerShouldClose(-40, 288, -0.8)).toBe(true);
  });
  it('does not close when flicked right', () => {
    expect(drawerShouldClose(10, 288, 0.8)).toBe(false);
  });
});

describe('drawerOffset', () => {
  it('follows the finger to the left', () => {
    expect(drawerOffset(-50)).toBe(-50);
  });
  it('damps a drag to the right', () => {
    expect(drawerOffset(50)).toBe(10);
  });
});

import type { RepeatCount } from '@/types';

export const REPEAT_COUNT_OPTIONS: readonly RepeatCount[] = [1, 2, 3, 'infinite'];

export function isRepeatCountActive(count: RepeatCount): boolean {
  return count !== 1;
}

export function shouldRepeatSentenceAtEnd(
  repeatCount: RepeatCount,
  sentencePlayCount: number
): boolean {
  if (repeatCount === 'infinite') return true;
  return repeatCount > 1 && sentencePlayCount < repeatCount - 1;
}

export function repeatCountAriaLabel(count: RepeatCount): string {
  if (count === 'infinite') return 'Repeat infinitely';
  return `Repeat ${count} time${count > 1 ? 's' : ''}`;
}

export function repeatCountTitle(count: RepeatCount): string {
  if (count === 'infinite') return 'Repeat ∞';
  return `Repeat ${count}×`;
}

export function repeatOptionAriaLabel(count: RepeatCount): string {
  return repeatCountAriaLabel(count);
}

export function cycleRepeatCount(count: RepeatCount): RepeatCount {
  const i = REPEAT_COUNT_OPTIONS.indexOf(count);
  return REPEAT_COUNT_OPTIONS[(i + 1) % REPEAT_COUNT_OPTIONS.length];
}

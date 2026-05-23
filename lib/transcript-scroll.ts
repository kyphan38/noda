/**
 * Scrolls a transcript row into the vertical center of its scroll container.
 */
export function scrollTranscriptRowIntoView(
  container: HTMLElement,
  rowIndex: number,
  behavior: ScrollBehavior = 'smooth',
): boolean {
  const activeElement = container.querySelector(`[data-index="${rowIndex}"]`);
  if (!activeElement) return false;

  const el = activeElement as HTMLElement;
  const containerRect = container.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const targetScrollTop =
    container.scrollTop +
    (elRect.top - containerRect.top) -
    (container.clientHeight - el.offsetHeight) / 2;
  container.scrollTo({ top: Math.max(0, targetScrollTop), behavior });
  return true;
}

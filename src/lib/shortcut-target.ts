// noda - when a one-letter shortcut may run, given the focused element (no React, no DOM types).

export type FocusedField = {
  tag: string;
  readOnly?: boolean;
  editable?: boolean;
};

/**
 * True when the focused element takes typed text, so a letter key must type, not act.
 * A read-only input takes no text: a finished Dictation line keeps one focused to catch Enter.
 */
export function takesTyping(field: FocusedField | null): boolean {
  if (!field) return false;
  if (field.editable) return true;
  const tag = field.tag.toUpperCase();
  if (tag === 'TEXTAREA') return !field.readOnly;
  if (tag === 'INPUT') return !field.readOnly;
  return false;
}

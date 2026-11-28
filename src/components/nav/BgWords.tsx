'use client';

export const wordClass = (on: boolean) => (on ? 'font-medium text-gray-100' : 'text-gray-500 hover:text-gray-100');

/** One row of words, like Theme: the chosen one is bright. */
export function BgWords<T extends string>(props: {
  label: string;
  items: readonly { id: T; name: string }[];
  value: T | undefined;
  onPick: (id: T) => void;
}) {
  return (
    <span role="radiogroup" aria-label={props.label} className="flex flex-wrap gap-x-2 gap-y-1 text-xs">
      {props.items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="radio"
          aria-checked={it.id === props.value}
          onClick={() => props.onPick(it.id)}
          className={wordClass(it.id === props.value)}
        >
          {it.name}
        </button>
      ))}
    </span>
  );
}

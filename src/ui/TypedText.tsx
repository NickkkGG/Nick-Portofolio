import { typedCount } from './reveal';

/** Shows the first part of `text` with a block cursor, like a terminal typing it. */
export function TypedText({ text, fraction }: { text: string; fraction: number }) {
  const n = typedCount(text.length, fraction);
  if (n === 0) return null;
  return (
    <span>
      {text.slice(0, n)}
      {n < text.length && <span aria-hidden>█</span>}
    </span>
  );
}

export type TextWidthMeasure = (value: string) => number;

/**
 * Splits a label into the fewest lines that fit the available width. Long
 * unbroken words are split by Unicode code point so they cannot escape a
 * narrow sector.
 */
export function wrapCanvasText(
  value: string,
  maxWidth: number,
  maxLines: number,
  measure: TextWidthMeasure,
): string[] | null {
  if (!(maxWidth > 0) || !(maxLines >= 1) || !value) return null;
  const lines: string[] = [];
  let line = '';

  const commit = () => {
    if (!line) return false;
    lines.push(line);
    line = '';
    return lines.length <= maxLines;
  };

  for (const word of value.trim().split(/\s+/u)) {
    if (!word) continue;
    const withWord = line ? `${line} ${word}` : word;
    if (measure(withWord) <= maxWidth) {
      line = withWord;
      continue;
    }

    if (line && !commit()) return null;

    if (measure(word) <= maxWidth) {
      line = word;
      continue;
    }

    let fragment = '';
    for (const character of Array.from(word)) {
      const next = `${fragment}${character}`;
      if (fragment && measure(next) > maxWidth) {
        line = fragment;
        if (!commit()) return null;
        fragment = character;
      } else {
        fragment = next;
      }
    }
    line = fragment;
  }

  if (!commit()) return null;
  return lines.length ? lines : null;
}

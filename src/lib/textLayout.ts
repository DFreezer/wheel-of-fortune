export type TextWidthMeasure = (value: string) => number;

/** Truncates a single canvas line without splitting a Unicode code point. */
export function ellipsizeCanvasText(value: string, maxWidth: number, measure: TextWidthMeasure): string {
  if (!(maxWidth > 0) || !value) return '';
  if (measure(value) <= maxWidth) return value;

  const suffix = '…';
  if (measure(suffix) > maxWidth) return '';
  const characters = Array.from(value);
  let end = characters.length;
  while (end > 0 && measure(`${characters.slice(0, end).join('')}${suffix}`) > maxWidth) end -= 1;
  return `${characters.slice(0, end).join('')}${suffix}`;
}

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

/**
 * Wraps at word boundaries, truncating a word that cannot fit on one line and
 * the final visible line when the text needs more than `maxLines` lines.
 */
export function wrapCanvasTextWithEllipsis(
  value: string,
  maxWidth: number,
  maxLines: number,
  measure: TextWidthMeasure,
): string[] | null {
  if (!(maxWidth > 0) || !(maxLines >= 1) || !value) return null;
  const lines: string[] = [];
  let line = '';

  for (const word of value.trim().split(/\s+/u)) {
    if (!word) continue;
    if (!line) {
      line = measure(word) <= maxWidth ? word : ellipsizeCanvasText(word, maxWidth, measure);
      if (!line) return null;
      continue;
    }

    const withWord = `${line} ${word}`;
    if (measure(withWord) <= maxWidth) {
      line = withWord;
      continue;
    }

    if (lines.length + 1 >= maxLines) {
      const last = ellipsizeCanvasText(withWord, maxWidth, measure);
      return last ? [...lines, last] : null;
    }

    lines.push(line);
    line = measure(word) <= maxWidth ? word : ellipsizeCanvasText(word, maxWidth, measure);
    if (!line) return null;
  }

  if (!line) return null;
  lines.push(line);
  return lines;
}

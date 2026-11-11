export interface ExcerptSegment {
  text: string;
  highlighted: boolean;
}

// Caractères de contrôle posés par la base autour des mots trouvés : contrairement à des
// balises, ils ne peuvent pas être confondus avec le texte du cours, qui n'est jamais
// renvoyé comme du HTML.
export const HIGHLIGHT_START = '\u0001';
export const HIGHLIGHT_STOP = '\u0002';

// Découpe un extrait en segments surlignés ou non.
export function parseExcerpt(raw: string): ExcerptSegment[] {
  const segments: ExcerptSegment[] = [];
  for (const [index, part] of raw.split(HIGHLIGHT_START).entries()) {
    const [inside, ...outside] =
      index === 0 ? ['', part] : part.split(HIGHLIGHT_STOP);
    for (const [text, highlighted] of [
      [inside, true],
      [outside.join(''), false],
    ] as const) {
      const clean = text.replace(/\s+/g, ' ');
      if (clean.length > 0) {
        segments.push({ text: clean, highlighted });
      }
    }
  }
  return segments;
}

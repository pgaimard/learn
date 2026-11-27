import { ContentNode } from './content-node.js';

const INLINE_CONTAINERS = new Set([
  'paragraph',
  'heading',
  'codeBlock',
  'figure',
  'quizChoice',
]);
// Blocs dont le titre est un attribut : il se cherche comme le reste.
const TITLED = new Set(['slideshow', 'quiz']);

function inlineText(node: ContentNode): string {
  return (node.content ?? [])
    .map((child) => (child.type === 'hardBreak' ? '\n' : (child.text ?? '')))
    .join('');
}

function collect(node: ContentNode, lines: string[]): void {
  const title: unknown = TITLED.has(node.type) ? node.attrs?.['title'] : '';
  if (typeof title === 'string' && title.trim().length > 0) {
    lines.push(title.trim());
  }
  if (INLINE_CONTAINERS.has(node.type)) {
    const text = inlineText(node).trim();
    if (text.length > 0) {
      lines.push(text);
    }
    return;
  }
  for (const child of node.content ?? []) {
    collect(child, lines);
  }
}

// Texte brut du cours, un bloc par ligne : il alimente la recherche.
export function extractPlainText(document: ContentNode): string {
  const lines: string[] = [];
  collect(document, lines);
  return lines.join('\n');
}

import { ContentNode } from './content-node';

export interface OutlineEntry {
  // Rang du titre parmi tous les titres du document : il sert à le retrouver à l'écran.
  index: number;
  level: number;
  text: string;
}

function readText(node: ContentNode): string {
  return (node.content ?? []).map((child) => child.text ?? '').join('');
}

function collectHeadings(node: ContentNode, headings: ContentNode[]): void {
  if (node.type === 'heading') {
    headings.push(node);
    return;
  }
  for (const child of node.content ?? []) {
    collectHeadings(child, headings);
  }
}

// Sommaire du cours : les titres dans l'ordre du document, numérotation telle qu'écrite.
export function buildOutline(document: ContentNode): OutlineEntry[] {
  const headings: ContentNode[] = [];
  collectHeadings(document, headings);
  return headings
    .map((heading, index) => ({
      index,
      level: typeof heading.attrs?.['level'] === 'number' ? heading.attrs['level'] : 2,
      text: readText(heading).trim(),
    }))
    .filter((entry) => entry.text.length > 0);
}

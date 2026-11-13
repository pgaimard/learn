import { ContentNode } from '../content/content-node.js';

// Texte alternatif de la figure qui référence ce chemin du paquet.
export function findAltText(node: ContentNode, path: string): string {
  if (node.type === 'figure' && node.attrs?.['src'] === path) {
    return typeof node.attrs['alt'] === 'string' ? node.attrs['alt'] : '';
  }
  for (const child of node.content ?? []) {
    const altText = findAltText(child, path);
    if (altText) {
      return altText;
    }
  }
  return '';
}

// Remplace, dans chaque figure, le chemin du paquet par l'adresse de l'image enregistrée.
export function placeImages(
  node: ContentNode,
  sources: Map<string, string>,
): ContentNode {
  if (node.type === 'figure') {
    const path = String(node.attrs?.['src']);
    return {
      ...node,
      attrs: { ...node.attrs, src: sources.get(path) ?? path },
    };
  }
  return node.content
    ? {
        ...node,
        content: node.content.map((child) => placeImages(child, sources)),
      }
    : node;
}

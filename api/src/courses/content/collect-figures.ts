import { ContentNode } from './content-node.js';

// Ressource à laquelle une image est rattachée, telle qu'elle apparaît dans son adresse.
export type ImageOwner = 'courses' | 'terms';

export interface FigureReference {
  owner: ImageOwner;
  ownerId: number;
  imageId: number;
  altText: string;
}

const IMAGE_SOURCE = /^\/api\/(courses|terms)\/(\d+)\/images\/(\d+)$/;

export function buildImageSource(
  owner: ImageOwner,
  ownerId: number,
  imageId: number,
): string {
  return `/api/${owner}/${ownerId}/images/${imageId}`;
}

export function isImageSource(value: unknown): boolean {
  return typeof value === 'string' && IMAGE_SOURCE.test(value);
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function collect(node: ContentNode, figures: FigureReference[]): void {
  if (node.type === 'figure') {
    const match = IMAGE_SOURCE.exec(readString(node.attrs?.['src']));
    if (match) {
      figures.push({
        owner: match[1] as ImageOwner,
        ownerId: Number(match[2]),
        imageId: Number(match[3]),
        altText: readString(node.attrs?.['alt']),
      });
    }
    return;
  }
  for (const child of node.content ?? []) {
    collect(child, figures);
  }
}

// Images référencées par un contenu déjà validé par la liste blanche.
export function collectFigures(document: ContentNode): FigureReference[] {
  const figures: FigureReference[] = [];
  collect(document, figures);
  return figures;
}

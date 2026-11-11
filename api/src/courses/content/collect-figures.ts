import { ContentNode } from './content-node.js';

export interface FigureReference {
  courseId: number;
  imageId: number;
  altText: string;
}

const IMAGE_SOURCE = /^\/api\/courses\/(\d+)\/images\/(\d+)$/;

export function buildImageSource(courseId: number, imageId: number): string {
  return `/api/courses/${courseId}/images/${imageId}`;
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
        courseId: Number(match[1]),
        imageId: Number(match[2]),
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

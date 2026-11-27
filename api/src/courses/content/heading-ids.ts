import { randomBytes } from 'node:crypto';
import { ContentNode } from './content-node.js';

// Identifiant d'un titre : il désigne sa section et ne change pas quand on le renomme.
const HEADING_ID = /^[a-z0-9]{8}$/;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function isHeadingId(value: unknown): boolean {
  return typeof value === 'string' && HEADING_ID.test(value);
}

export function newHeadingId(): string {
  return Array.from(
    randomBytes(8),
    (byte) => ALPHABET[byte % ALPHABET.length],
  ).join('');
}

function withIds(node: ContentNode, taken: Set<string>): ContentNode {
  if (node.type === 'heading') {
    const current: unknown = node.attrs?.['id'];
    let id = isHeadingId(current) ? (current as string) : newHeadingId();
    while (taken.has(id)) {
      id = newHeadingId();
    }
    taken.add(id);
    return { ...node, attrs: { ...node.attrs, id } };
  }
  return node.content
    ? { ...node, content: node.content.map((child) => withIds(child, taken)) }
    : node;
}

// Donne un identifiant à chaque titre qui n'en a pas, ou qui porte celui d'un titre
// précédent (copie). L'éditeur les attribue lui-même ; ceci est le filet pour ce qui
// n'en vient pas : import d'un paquet, restauration, écriture de l'IA.
export function ensureHeadingIds(document: ContentNode): ContentNode {
  return withIds(document, new Set());
}

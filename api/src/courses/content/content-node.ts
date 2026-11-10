// Forme du document de l'éditeur (Tiptap / ProseMirror) tel qu'il est stocké.
export interface ContentMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface ContentNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ContentNode[];
  text?: string;
  marks?: ContentMark[];
}

export const EMPTY_CONTENT: ContentNode = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

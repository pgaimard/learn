// Forme du document de l'éditeur (Tiptap / ProseMirror), telle que l'API la stocke.
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

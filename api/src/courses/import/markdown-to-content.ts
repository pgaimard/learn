import MarkdownIt from 'markdown-it';
import type { Token } from 'markdown-it';
import { ContentMark, ContentNode } from '../content/content-node.js';
import { isSafeLink } from '../content/content-schema.js';

export interface ConvertedMarkdown {
  // Document de l'éditeur ; la source des figures est encore le chemin dans le paquet.
  document: ContentNode;
  imagePaths: string[];
  sectionCount: number;
  errors: string[];
}

const CALLOUT_MARKER = /^\[!([^\]\s]+)\]\s*/;
const CALLOUT_KINDS = ['retenir', 'change', 'attention'];
export const IMAGE_PATH =
  /^images\/[A-Za-z0-9][A-Za-z0-9._-]*\.(svg|png|jpe?g)$/i;
const MAX_ERRORS = 10;

// HTML désactivé : une balise écrite dans le Markdown reste du texte.
const parser = new MarkdownIt({ html: false, linkify: false });

class Converter {
  readonly errors: string[] = [];
  readonly imagePaths: string[] = [];
  sectionCount = 0;
  private index = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly lineOffset: number,
    private readonly source: string,
  ) {}

  // Lit les blocs jusqu'au jeton de fermeture indiqué (ou la fin du document).
  parseBlocks(closingType: string | null): ContentNode[] {
    const blocks: ContentNode[] = [];
    while (this.index < this.tokens.length) {
      const token = this.tokens[this.index];
      if (token.type === closingType) {
        this.index += 1;
        break;
      }
      const block = this.parseBlock(token);
      if (block) {
        blocks.push(block);
      }
    }
    return blocks;
  }

  private parseBlock(token: Token): ContentNode | null {
    this.index += 1;
    switch (token.type) {
      case 'heading_open':
        return this.parseHeading(token);
      case 'paragraph_open':
        return this.parseParagraph();
      case 'bullet_list_open':
        return {
          type: 'bulletList',
          content: this.parseBlocks('bullet_list_close'),
        };
      case 'ordered_list_open':
        return {
          type: 'orderedList',
          attrs: { start: Number(token.attrGet('start') ?? 1), type: null },
          content: this.parseBlocks('ordered_list_close'),
        };
      case 'list_item_open':
        return {
          type: 'listItem',
          content: this.parseBlocks('list_item_close'),
        };
      case 'blockquote_open':
        return this.parseBlockquote(token);
      case 'fence':
      case 'code_block':
        return codeBlock(token);
      case 'hr':
        return { type: 'horizontalRule' };
      case 'table_open':
        return { type: 'table', content: this.parseTableRows() };
      default:
        this.fail(
          token,
          `élément Markdown non pris en charge (${token.type}).`,
        );
        return null;
    }
  }

  private parseHeading(token: Token): ContentNode {
    const level = Number(token.tag.slice(1));
    if (level < 2 || level > 5) {
      this.fail(
        token,
        `titre de niveau ${level} non pris en charge : utilisez les niveaux 2 à 5.`,
      );
    }
    if (level === 2) {
      this.sectionCount += 1;
    }
    const content = this.parseInline(this.tokens[this.index]);
    this.index += 2;
    return { type: 'heading', attrs: { level }, content };
  }

  private parseParagraph(): ContentNode {
    const inline = this.tokens[this.index];
    this.index += 2;
    const children = inline.children ?? [];
    if (children.length === 1 && children[0].type === 'image') {
      return this.figure(children[0], inline);
    }
    return withContent({ type: 'paragraph' }, this.parseInline(inline));
  }

  private figure(image: Token, line: Token): ContentNode {
    const path = readAttribute(image, 'src');
    if (IMAGE_PATH.test(path)) {
      this.imagePaths.push(path);
    } else {
      this.fail(
        line,
        `image « ${path} » refusée : elle doit être un fichier du dossier images/.`,
      );
    }
    const caption = readAttribute(image, 'title');
    return withContent(
      { type: 'figure', attrs: { src: path, alt: image.content } },
      caption ? [{ type: 'text', text: caption }] : [],
    );
  }

  private parseBlockquote(token: Token): ContentNode {
    const content = this.parseBlocks('blockquote_close');
    const firstText =
      content[0]?.type === 'paragraph' ? content[0].content?.[0] : undefined;
    const marker = CALLOUT_MARKER.exec(firstText?.text ?? '');
    if (!firstText || !marker) {
      return { type: 'blockquote', content };
    }
    if (!CALLOUT_KINDS.includes(marker[1])) {
      this.fail(
        token,
        `type d’encadré inconnu « ${marker[1]} » (retenir, change ou attention).`,
      );
    }
    const body = stripMarker(content, marker[0].length);
    if (body.length === 0) {
      this.fail(token, 'encadré vide.');
    }
    return { type: 'callout', attrs: { kind: marker[1] }, content: body };
  }

  private parseTableRows(): ContentNode[] {
    const rows: ContentNode[] = [];
    while (this.tokens[this.index].type !== 'table_close') {
      const token = this.tokens[this.index];
      this.index += 1;
      if (token.type === 'tr_open') {
        rows.push({ type: 'tableRow', content: this.parseTableCells() });
      }
    }
    this.index += 1;
    return rows;
  }

  private parseTableCells(): ContentNode[] {
    const cells: ContentNode[] = [];
    while (this.tokens[this.index].type !== 'tr_close') {
      const open = this.tokens[this.index];
      const paragraph = withContent(
        { type: 'paragraph' },
        this.parseInline(this.tokens[this.index + 1]),
      );
      this.index += 3;
      cells.push({
        type: open.type === 'th_open' ? 'tableHeader' : 'tableCell',
        attrs: {
          colspan: 1,
          rowspan: 1,
          colwidth: null,
          align: readAlignment(open),
        },
        content: [paragraph],
      });
    }
    this.index += 1;
    return cells;
  }

  private parseInline(inline: Token): ContentNode[] {
    const nodes: ContentNode[] = [];
    const marks: ContentMark[] = [];
    const pushText = (text: string, extra: ContentMark[] = marks): void => {
      if (text.length > 0) {
        appendText(nodes, text, extra);
      }
    };
    for (const child of inline.children ?? []) {
      switch (child.type) {
        case 'text':
          pushText(child.content);
          break;
        case 'softbreak':
          pushText(' ');
          break;
        case 'hardbreak':
          nodes.push({ type: 'hardBreak' });
          break;
        case 'code_inline':
          pushText(child.content, [{ type: 'code' }]);
          break;
        case 'strong_open':
          marks.push({ type: 'bold' });
          break;
        case 'em_open':
          marks.push({ type: 'italic' });
          break;
        case 's_open':
          marks.push({ type: 'strike' });
          break;
        case 'link_open':
          marks.push(this.linkMark(child, inline));
          break;
        case 'strong_close':
        case 'em_close':
        case 's_close':
        case 'link_close':
          marks.pop();
          break;
        case 'image':
          this.fail(inline, 'une image doit être seule dans son paragraphe.');
          break;
        default:
          this.fail(
            inline,
            `mise en forme non prise en charge (${child.type}).`,
          );
      }
    }
    return nodes;
  }

  private linkMark(link: Token, line: Token): ContentMark {
    const href = readAttribute(link, 'href');
    if (!isSafeLink(href)) {
      this.fail(
        line,
        `lien « ${href} » refusé : seuls http, https et mailto sont acceptés.`,
      );
    }
    return {
      type: 'link',
      attrs: {
        href,
        target: '_blank',
        rel: 'noopener noreferrer nofollow',
        class: null,
        title: readAttribute(link, 'title') || null,
      },
    };
  }

  private fail(token: Token, message: string): void {
    if (this.errors.length < MAX_ERRORS) {
      const line = token.map
        ? `ligne ${token.map[0] + 1 + this.lineOffset} : `
        : '';
      this.errors.push(`${this.source}, ${line}${message}`);
    }
  }
}

// Ajoute du texte en le fusionnant avec le texte précédent s'il porte les mêmes marques,
// comme le fait l'éditeur.
function appendText(
  nodes: ContentNode[],
  text: string,
  marks: ContentMark[],
): void {
  const last = nodes.at(-1);
  if (
    last?.type === 'text' &&
    JSON.stringify(last.marks ?? []) === JSON.stringify(marks)
  ) {
    last.text = (last.text ?? '') + text;
    return;
  }
  nodes.push(
    marks.length > 0
      ? { type: 'text', text, marks: marks.map((mark) => ({ ...mark })) }
      : { type: 'text', text },
  );
}

function withContent(node: ContentNode, content: ContentNode[]): ContentNode {
  return content.length > 0 ? { ...node, content } : node;
}

function readAttribute(token: Token, name: string): string {
  const value = token.attrGet(name);
  return value === null ? '' : String(value);
}

function codeBlock(token: Token): ContentNode {
  const language = token.info.trim().split(/\s+/)[0] || null;
  const text = token.content.replace(/\n$/, '');
  return withContent(
    { type: 'codeBlock', attrs: { language } },
    text.length > 0 ? [{ type: 'text', text }] : [],
  );
}

function readAlignment(cell: Token): string | null {
  const match = /text-align:(left|center|right)/.exec(
    readAttribute(cell, 'style'),
  );
  return match ? match[1] : null;
}

// Retire le marqueur « [!type] » du début de l'encadré, et le paragraphe s'il n'avait que lui.
function stripMarker(
  content: ContentNode[],
  markerLength: number,
): ContentNode[] {
  const [first, ...rest] = content;
  const [firstText, ...otherInline] = first.content ?? [];
  const remaining = (firstText.text ?? '').slice(markerLength);
  const inline =
    remaining.length > 0
      ? [{ ...firstText, text: remaining }, ...otherInline]
      : otherInline;
  return inline.length > 0 ? [{ ...first, content: inline }, ...rest] : rest;
}

export function markdownToContent(
  markdown: string,
  lineOffset = 0,
  // Nom donné au contenu dans les messages d'erreur.
  source = 'cours.md',
): ConvertedMarkdown {
  const converter = new Converter(
    parser.parse(markdown, {}),
    lineOffset,
    source,
  );
  const content = converter.parseBlocks(null);
  return {
    document: {
      type: 'doc',
      content: content.length > 0 ? content : [{ type: 'paragraph' }],
    },
    imagePaths: [...new Set(converter.imagePaths)],
    sectionCount: converter.sectionCount,
    errors: converter.errors,
  };
}

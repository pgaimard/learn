import { ContentMark, ContentNode } from './content-node.js';

// Signale ce que le Markdown ne sait pas exprimer et qu'une réécriture perdrait.
export type ReportLoss = (loss: string) => void;

const DELIMITERS: Record<string, string> = {
  bold: '**',
  italic: '*',
  strike: '~~',
};

// Neutralise ce que le Markdown lirait comme une mise en forme.
export function escapeText(text: string): string {
  return text
    .replace(/[\\`*[\]~]/g, '\\$&')
    .replace(/<(?=[A-Za-z])/g, '\\<')
    .replace(/&(?=#?\w+;)/g, '\\&')
    .replace(/(?<![\p{L}\p{N}])_|_(?![\p{L}\p{N}])/gu, '\\_');
}

// Neutralise ce qui, en début de ligne, ouvrirait un titre, une citation, une liste ou
// une ligne de séparation.
function escapeLineStart(line: string): string {
  return line
    .trimStart()
    .replace(/^(#{1,6}(\s|$)|>|[-+=](\s|$|[-=]))/, '\\$1')
    .replace(/^(\d{1,9})([.)])(\s|$)/, '$1\\$2$3');
}

function codeSpan(text: string): string {
  const runs = text.match(/`+/g) ?? [];
  const fence = '`'.repeat(Math.max(0, ...runs.map((run) => run.length)) + 1);
  const padded =
    /^`|`$/.test(text) || (/^ .* $/.test(text) && text.trim() !== '');
  return padded ? `${fence} ${text} ${fence}` : `${fence}${text}${fence}`;
}

function isSameMark(a: ContentMark, b: ContentMark): boolean {
  return (
    a.type === b.type &&
    a.attrs?.['href'] === b.attrs?.['href'] &&
    a.attrs?.['title'] === b.attrs?.['title']
  );
}

function opener(mark: ContentMark): string {
  return mark.type === 'link' ? '[' : DELIMITERS[mark.type];
}

function closer(mark: ContentMark): string {
  if (mark.type !== 'link') {
    return DELIMITERS[mark.type];
  }
  const href = stringAttribute(mark, 'href');
  const title = mark.attrs?.['title'];
  const target = /[\s()]/.test(href)
    ? `<${href.replace(/</g, '%3C').replace(/>/g, '%3E')}>`
    : href;
  return typeof title === 'string' && title.length > 0
    ? `](${target} "${escapeTitle(title)}")`
    : `](${target})`;
}

// Attribut de texte d'un bloc ou d'une marque ; vide s'il est absent.
export function stringAttribute(
  holder: { attrs?: Record<string, unknown> },
  name: string,
): string {
  const value = holder.attrs?.[name];
  return typeof value === 'string' ? value : '';
}

// Texte placé entre guillemets : titre d'un lien, légende d'une image.
export function escapeTitle(title: string): string {
  return title.replace(/["\\]/g, '\\$&').replace(/&(?=#?\w+;)/g, '\\&');
}

class InlineWriter {
  private out = '';
  private readonly open: ContentMark[] = [];

  constructor(
    private readonly nodes: ContentNode[],
    private readonly report: ReportLoss,
    private readonly allowBreaks: boolean,
  ) {}

  write(): string {
    this.nodes.forEach((node, index) => {
      if (node.type === 'text') {
        this.writeText(node, index);
      } else if (node.type === 'hardBreak') {
        this.writeBreak();
      } else {
        this.report(`élément « ${node.type} » dans un texte`);
      }
    });
    this.closeDownTo(0);
    return this.out.split('\n').map(escapeLineStart).join('\n').trimEnd();
  }

  private writeBreak(): void {
    this.closeDownTo(0);
    if (this.allowBreaks) {
      this.out = `${this.out.trimEnd()}\\\n`;
    } else {
      this.report('retour à la ligne dans un titre ou une cellule de tableau');
      this.out += ' ';
    }
  }

  private writeText(node: ContentNode, index: number): void {
    const text = node.text ?? '';
    const marks = node.marks ?? [];
    if (marks.some((mark) => mark.type === 'code')) {
      if (marks.length > 1) {
        this.report('mise en forme ou lien sur du code en ligne');
      }
      this.closeDownTo(0);
      this.out += codeSpan(text);
      return;
    }
    const wanted = this.expressible(marks);
    this.closeDownTo(this.keptCount(wanted));
    // Un texte fait d'espaces n'ouvre aucune marque : elle serait vide.
    const toOpen =
      text.trim() === ''
        ? []
        : this.inOpeningOrder(
            wanted.filter(
              (mark) => !this.open.some((other) => isSameMark(mark, other)),
            ),
            index,
          );
    // Une marque s'ouvre contre le texte : les espaces qui le précèdent restent dehors.
    const lead = toOpen.length > 0 ? (/^\s*/.exec(text)?.[0] ?? '') : '';
    this.out += lead;
    for (const mark of toOpen) {
      this.out += opener(mark);
      this.open.push(mark);
    }
    this.out += escapeText(text.slice(lead.length));
  }

  private expressible(marks: ContentMark[]): ContentMark[] {
    return marks.filter((mark) => {
      if (mark.type === 'link' || mark.type in DELIMITERS) {
        return true;
      }
      this.report(
        mark.type === 'underline'
          ? 'soulignement'
          : `marque « ${mark.type} » inconnue`,
      );
      return false;
    });
  }

  // Nombre de marques ouvertes, depuis la plus ancienne, que le texte suivant garde.
  private keptCount(wanted: ContentMark[]): number {
    const firstDropped = this.open.findIndex(
      (mark) => !wanted.some((other) => isSameMark(mark, other)),
    );
    return firstDropped < 0 ? this.open.length : firstDropped;
  }

  // Le lien d'abord, puis la marque qui dure le plus longtemps : elle se fermera en dernier.
  private inOpeningOrder(marks: ContentMark[], index: number): ContentMark[] {
    const rank = (mark: ContentMark): number =>
      mark.type === 'link' ? Infinity : this.runLength(mark, index);
    return [...marks].sort((a, b) => rank(b) - rank(a));
  }

  private runLength(mark: ContentMark, index: number): number {
    let length = 0;
    while (
      this.nodes[index + length]?.marks?.some((other) =>
        isSameMark(mark, other),
      )
    ) {
      length += 1;
    }
    return length;
  }

  // Une marque se ferme contre le texte : les espaces qui le suivent passent dehors.
  private closeDownTo(count: number): void {
    if (this.open.length <= count) {
      return;
    }
    const trailing = /\s*$/.exec(this.out)?.[0] ?? '';
    this.out = this.out.slice(0, this.out.length - trailing.length);
    while (this.open.length > count) {
      this.out += closer(this.open.pop() as ContentMark);
    }
    this.out += trailing;
  }
}

// Texte d'un paragraphe, d'un titre ou d'une cellule, avec ses marques.
export function inlineToMarkdown(
  nodes: ContentNode[],
  report: ReportLoss,
  allowBreaks = true,
): string {
  return new InlineWriter(nodes, report, allowBreaks).write();
}

// Texte seul, sans mise en forme.
export function plainText(node: ContentNode): string {
  if (node.type === 'hardBreak') {
    return ' ';
  }
  return (
    node.text ??
    (node.content ?? [])
      .map(plainText)
      .join(node.type === 'paragraph' ? '' : ' ')
  );
}

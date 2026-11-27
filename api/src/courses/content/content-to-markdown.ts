import { ContentNode } from './content-node.js';
import {
  escapeText,
  escapeTitle,
  inlineToMarkdown,
  plainText,
  stringAttribute,
  ReportLoss,
} from './inline-to-markdown.js';
import { tableToMarkdown } from './table-to-markdown.js';

export interface ConvertedContent {
  markdown: string;
  // Ce que le Markdown ne sait pas exprimer et qu'une réécriture du contenu perdrait.
  losses: string[];
}

// Liste qui précède un bloc : deux listes de même type qui se suivent changent de puce,
// sans quoi le Markdown les relirait comme une seule.
interface Preceding {
  type: string;
  alternate: boolean;
}

const LIST_TYPES = ['bulletList', 'orderedList'];

function isEmptyParagraph(block: ContentNode): boolean {
  return block.type === 'paragraph' && (block.content ?? []).length === 0;
}

// Les paragraphes vides de l'éditeur n'ont pas d'écriture en Markdown.
function written(blocks: ContentNode[] | undefined): ContentNode[] {
  return (blocks ?? []).filter((block) => !isEmptyParagraph(block));
}

function quote(lines: string[]): string[] {
  return lines.map((line) => (line === '' ? '>' : `> ${line}`));
}

// Place un marqueur devant la première ligne et aligne les suivantes dessous.
function hang(lines: string[], marker: string): string[] {
  const indent = ' '.repeat(marker.length);
  const [first = '', ...others] = lines;
  return [
    `${marker}${first}`.trimEnd(),
    ...others.map((line) => (line === '' ? '' : `${indent}${line}`)),
  ];
}

class BlockWriter {
  constructor(private readonly report: ReportLoss) {}

  blocks(blocks: ContentNode[] | undefined, before?: Preceding): string[] {
    const lines: string[] = [];
    let preceding = before;
    for (const block of written(blocks)) {
      const alternate =
        LIST_TYPES.includes(block.type) &&
        preceding?.type === block.type &&
        !preceding.alternate;
      if (lines.length > 0) {
        lines.push('');
      }
      lines.push(...this.block(block, alternate));
      preceding = { type: block.type, alternate };
    }
    return lines;
  }

  private block(block: ContentNode, alternate: boolean): string[] {
    switch (block.type) {
      case 'paragraph':
        this.checkAlignment(block);
        return this.inline(block).split('\n');
      case 'heading':
        return [this.heading(block)];
      case 'bulletList':
      case 'orderedList':
        return this.list(block, alternate);
      case 'blockquote':
        return quote(this.blocks(block.content));
      case 'callout':
        return this.marked(
          `[!${stringAttribute(block, 'kind')}]`,
          block.content,
        );
      case 'codeBlock':
        return codeBlock(block);
      case 'table':
        return tableToMarkdown(block, this.report);
      case 'horizontalRule':
        return ['---'];
      case 'figure':
        return [this.figure(block)];
      case 'slideshow':
        return this.slideshow(block);
      case 'quiz':
        return this.quiz(block);
      case 'exercise':
        return this.exercise(block);
      default:
        this.report(`bloc « ${block.type} » inconnu`);
        return this.blocks(block.content);
    }
  }

  private inline(node: ContentNode, allowBreaks = true): string {
    return inlineToMarkdown(node.content ?? [], this.report, allowBreaks);
  }

  private checkAlignment(block: ContentNode): void {
    const align = block.attrs?.['textAlign'] ?? null;
    if (align !== null && align !== 'left') {
      this.report('alignement d’un paragraphe ou d’un titre');
    }
  }

  private heading(block: ContentNode): string {
    this.checkAlignment(block);
    // Des « # » en fin de ligne seraient pris pour la fermeture du titre.
    const text = this.inline(block, false).replace(/(^|\s)(#+)$/, '$1\\$2');
    return `${'#'.repeat(Number(block.attrs?.['level']))} ${text}`.trimEnd();
  }

  private list(list: ContentNode, alternate: boolean): string[] {
    const ordered = list.type === 'orderedList';
    if (ordered && (list.attrs?.['type'] ?? null) !== null) {
      this.report('type de numérotation d’une liste');
    }
    const start = Number(list.attrs?.['start'] ?? 1);
    const items = list.content ?? [];
    const tight = items.every(isSimpleItem);
    return items.flatMap((item, index) => {
      const bullet = alternate ? '*' : '-';
      const marker = ordered
        ? `${start + index}${alternate ? ')' : '.'} `
        : `${bullet} `;
      const lines = hang(this.item(item, tight), marker);
      return index > 0 && !tight ? ['', ...lines] : lines;
    });
  }

  // Dans une liste serrée, la sous-liste suit son paragraphe sans ligne vide.
  private item(item: ContentNode, tight: boolean): string[] {
    return tight
      ? written(item.content).flatMap((block) => this.block(block, false))
      : this.blocks(item.content);
  }

  // Bloc écrit comme une citation dont la première ligne est un marqueur « [!type] ».
  private marked(marker: string, blocks: ContentNode[] | undefined): string[] {
    const body = this.blocks(blocks);
    const [first] = written(blocks);
    // Le texte peut suivre le marqueur ; tout autre bloc demande une ligne vide.
    const separator = first?.type === 'paragraph' ? [] : [''];
    return quote([marker, ...separator, ...body]);
  }

  private titled(marker: string, block: ContentNode, body: string[]): string[] {
    const title = escapeText(stringAttribute(block, 'title'));
    return quote([`[!${marker}] ${title}`.trimEnd(), '', ...body]);
  }

  private figure(figure: ContentNode): string {
    const inline = figure.content ?? [];
    if (inline.some((node) => node.type !== 'text' || node.marks?.length)) {
      this.report('mise en forme dans la légende d’une image');
    }
    const alt = stringAttribute(figure, 'alt').replace(/\s+/g, ' ');
    const caption = inline.map(plainText).join('');
    const title = caption.length > 0 ? ` "${escapeTitle(caption)}"` : '';
    return `![${alt}](${stringAttribute(figure, 'src')}${title})`;
  }

  // Chaque étape : son image, puis son explication.
  private slideshow(slideshow: ContentNode): string[] {
    const blocks = (slideshow.content ?? []).flatMap(
      (slide) => slide.content ?? [],
    );
    return this.titled('diaporama', slideshow, this.blocks(blocks));
  }

  private quiz(quiz: ContentNode): string[] {
    const lines = (quiz.content ?? []).flatMap((question, index) => [
      ...(index > 0 ? [''] : []),
      ...hang(this.question(question), `${index + 1}. `),
    ]);
    return this.titled('qcm', quiz, lines);
  }

  // Une question : son énoncé, la liste de ses choix, puis son explication.
  private question(question: ContentNode): string[] {
    const parts = question.content ?? [];
    const prompt = written(
      parts.find((part) => part.type === 'quizPrompt')?.content,
    );
    const explanation = parts.find((part) => part.type === 'quizExplanation');
    const lastPrompt = prompt.at(-1)?.type;
    const alternate = lastPrompt === 'bulletList';
    const choices = parts
      .filter((part) => part.type === 'quizChoice')
      .map((choice) => this.choice(choice, alternate ? '*' : '-'));
    const after = this.blocks(explanation?.content, {
      type: 'bulletList',
      alternate,
    });
    return [
      ...this.blocks(prompt),
      ...(lastPrompt === 'paragraph' ? [] : ['']),
      ...choices,
      ...(after.length > 0 ? ['', ...after] : []),
    ];
  }

  private choice(choice: ContentNode, bullet: string): string {
    const box = choice.attrs?.['correct'] === true ? '[x]' : '[ ]';
    return `${bullet} ${box} ${this.inline(choice, false)}`.trimEnd();
  }

  // L'énoncé, puis le corrigé dans un encadré imbriqué ; un corrigé vide ne s'écrit pas.
  private exercise(exercise: ContentNode): string[] {
    const parts = exercise.content ?? [];
    const statement = parts.find((part) => part.type === 'exerciseStatement');
    const solution = parts.find((part) => part.type === 'exerciseSolution');
    const lines = this.blocks(statement?.content);
    if (written(solution?.content).length > 0) {
      lines.push('', ...this.marked('[!corrige]', solution?.content));
    }
    return this.titled('exercice', exercise, lines);
  }
}

// Un élément tient en liste serrée s'il n'a qu'un paragraphe, suivi ou non d'une sous-liste.
function isSimpleItem(item: ContentNode): boolean {
  const [first, second, ...others] = written(item.content);
  return (
    others.length === 0 &&
    (first === undefined || first.type === 'paragraph') &&
    (second === undefined || LIST_TYPES.includes(second.type))
  );
}

function codeBlock(block: ContentNode): string[] {
  const text = (block.content ?? []).map((node) => node.text ?? '').join('');
  const runs = text.match(/`+/g) ?? [];
  const fence = '`'.repeat(Math.max(3, ...runs.map((run) => run.length + 1)));
  const language = block.attrs?.['language'];
  return [
    `${fence}${typeof language === 'string' ? language : ''}`,
    ...(text.length > 0 ? text.split('\n') : []),
    fence,
  ];
}

// Écrit un contenu de l'éditeur dans le Markdown du contrat (contracts/README.md) :
// l'inverse de markdownToContent. Une figure garde sa source telle qu'elle est enregistrée.
export function contentToMarkdown(document: ContentNode): ConvertedContent {
  const losses = new Set<string>();
  const lines = new BlockWriter((loss) => losses.add(loss)).blocks(
    document.content,
  );
  return {
    markdown: lines.length > 0 ? `${lines.join('\n')}\n` : '',
    losses: [...losses],
  };
}

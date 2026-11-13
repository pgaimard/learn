import { Extension } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// Renvoi trouvé dans le texte : où il se trouve dans le document, et le rang (parmi tous
// les titres) du titre vers lequel il mène.
export interface SectionReference {
  from: number;
  to: number;
  headingIndex: number;
}

const NUMBER = String.raw`\d+(?:\.\d+)*(?![\p{L}\p{N}])`;
// Un numéro n'est un renvoi que derrière l'un de ces mots : « 3.4 GHz » n'en est pas un.
const KEYWORD = String.raw`(?:sections?|§{1,2}|parties?|chapitres?|voir|cf\.?|r[ée]f\.?)`;
// Le mot peut annoncer plusieurs numéros : « sections 3.4 et 3.5 ».
const REFERENCE = new RegExp(
  String.raw`(?<![\p{L}\p{N}])${KEYWORD}\s*${NUMBER}(?:\s*(?:,|et|ou|à)\s*${NUMBER})*`,
  'giu',
);
const NUMBER_IN_REFERENCE = new RegExp(NUMBER, 'gu');
// Numéro par lequel commence un titre : « 3.4 États » ou « 3. Ordonnancement ».
const HEADING_NUMBER = /^\s*(\d+(?:\.\d+)*)\.?(?:\s|$)/;
// Remplace ce qui n'est pas du texte courant (code, saut de ligne) sans décaler les positions.
const FILLER = '\u0001';

// Numéro de section → rang du premier titre qui le porte.
function numberedHeadings(doc: ProseMirrorNode): Map<string, number> {
  const targets = new Map<string, number>();
  let rank = 0;
  doc.descendants((node) => {
    if (node.type.name !== 'heading') {
      return true;
    }
    const number = HEADING_NUMBER.exec(node.textContent)?.[1];
    if (number !== undefined && !targets.has(number)) {
      targets.set(number, rank);
    }
    rank += 1;
    return false;
  });
  return targets;
}

// Texte d'un bloc, caractère pour position : le code et les sauts de ligne sont neutralisés.
function searchableText(block: ProseMirrorNode): string {
  let text = '';
  block.forEach((child) => {
    const isPlain = child.isText && !child.marks.some((mark) => mark.type.name === 'code');
    text += isPlain ? (child.text ?? '') : FILLER.repeat(child.nodeSize);
  });
  return text;
}

function referencesIn(
  text: string,
  start: number,
  targets: Map<string, number>,
): SectionReference[] {
  const references: SectionReference[] = [];
  for (const match of text.matchAll(REFERENCE)) {
    let isFirst = true;
    for (const number of match[0].matchAll(NUMBER_IN_REFERENCE)) {
      const headingIndex = targets.get(number[0]);
      if (headingIndex !== undefined) {
        // Le premier numéro emporte son mot (« section 3.4 ») ; les suivants sont seuls.
        const from = match.index + (isFirst ? 0 : number.index);
        const to = match.index + number.index + number[0].length;
        references.push({ from: start + from, to: start + to, headingIndex });
      }
      isFirst = false;
    }
  }
  return references;
}

// Renvois du cours vers ses propres sections : « voir section 3.4 » mène au titre qui
// commence par « 3.4 ». Les titres et le code ne sont pas examinés.
export function findSectionReferences(doc: ProseMirrorNode): SectionReference[] {
  const targets = numberedHeadings(doc);
  const references: SectionReference[] = [];
  if (targets.size === 0) {
    return references;
  }
  doc.descendants((node, pos) => {
    if (!node.isTextblock) {
      return true;
    }
    if (node.type.name !== 'heading' && node.type.name !== 'codeBlock') {
      references.push(...referencesIn(searchableText(node), pos + 1, targets));
    }
    return false;
  });
  return references;
}

function decorate(doc: ProseMirrorNode): DecorationSet {
  return DecorationSet.create(
    doc,
    findSectionReferences(doc).map((reference) =>
      Decoration.inline(reference.from, reference.to, {
        class: 'section-ref',
        role: 'link',
        tabindex: '0',
        title: 'Aller à cette section',
        'data-heading': String(reference.headingIndex),
      }),
    ),
  );
}

// En lecture, rend cliquables les renvois vers les sections. Rien n'est enregistré dans le
// contenu : les liens sont recalculés à l'affichage, à partir des titres du moment.
export const SectionReferences = Extension.create({
  name: 'sectionReferences',

  addProseMirrorPlugins() {
    const editor = this.editor;
    const key = new PluginKey<DecorationSet>('sectionReferences');
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_config, state) => decorate(state.doc),
          apply: (transaction, decorations) =>
            transaction.docChanged ? decorate(transaction.doc) : decorations,
        },
        props: {
          decorations: (state) => (editor.isEditable ? DecorationSet.empty : key.getState(state)),
        },
      }),
    ];
  },
});

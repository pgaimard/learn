import { Extension } from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, EditorView } from '@tiptap/pm/view';
import { searchableText } from './section-references';

// Ce qu'il faut connaître d'un terme pour le retrouver dans un texte.
export interface MentionTerm {
  id: number;
  type: 'definition' | 'acronym';
  label: string;
}

// Terme trouvé dans le texte : où il se trouve dans le document, et lequel.
export interface TermMention {
  from: number;
  to: number;
  termId: number;
}

interface Matcher {
  pattern: RegExp;
  // Libellé tel qu'il est comparé → identifiant du terme.
  ids: Map<string, number>;
  normalize: (label: string) => string;
}

interface MentionState {
  terms: MentionTerm[];
  decorations: DecorationSet;
}

function escape(label: string): string {
  return label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Un seul motif pour tous les libellés, les plus longs d'abord : « table des pages » passe
// avant « page ». Un libellé n'est reconnu qu'en mot entier.
function buildMatcher(
  labels: MentionTerm[],
  flags: string,
  normalize: (label: string) => string,
): Matcher | null {
  const ids = new Map<string, number>();
  for (const term of labels) {
    const label = normalize(term.label.trim());
    if (label.length > 1 && !ids.has(label)) {
      ids.set(label, term.id);
    }
  }
  if (ids.size === 0) {
    return null;
  }
  const alternatives = [...ids.keys()].sort((a, b) => b.length - a.length).map(escape);
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${alternatives.join('|')})(?![\\p{L}\\p{N}])`,
    flags,
  );
  return { pattern, ids, normalize };
}

// Un acronyme se reconnaît à ses majuscules exactes (« PCB », pas « pcb ») ; une
// définition, sans tenir compte de la casse (« Processus » comme « processus »).
function buildMatchers(terms: MentionTerm[]): Matcher[] {
  const lower = (label: string): string => label.toLocaleLowerCase('fr');
  return [
    buildMatcher(
      terms.filter((term) => term.type === 'acronym'),
      'gu',
      (label) => label,
    ),
    buildMatcher(
      terms.filter((term) => term.type === 'definition'),
      'giu',
      lower,
    ),
  ].filter((matcher) => matcher !== null);
}

function mentionsIn(text: string, start: number, matchers: Matcher[]): TermMention[] {
  const found: TermMention[] = [];
  for (const matcher of matchers) {
    for (const match of text.matchAll(matcher.pattern)) {
      const termId = matcher.ids.get(matcher.normalize(match[0]));
      if (termId !== undefined) {
        found.push({
          from: start + match.index,
          to: start + match.index + match[0].length,
          termId,
        });
      }
    }
  }
  // Deux termes au même endroit : le premier rencontré, puis le plus long, l'emporte.
  found.sort((a, b) => a.from - b.from || b.to - a.to);
  const kept: TermMention[] = [];
  for (const mention of found) {
    if (kept.length === 0 || mention.from >= kept[kept.length - 1].to) {
      kept.push(mention);
    }
  }
  return kept;
}

// Termes du dictionnaire et du glossaire cités dans le texte du cours. Les titres et le
// code ne sont pas examinés.
export function findTermMentions(doc: ProseMirrorNode, terms: MentionTerm[]): TermMention[] {
  const matchers = buildMatchers(terms);
  const mentions: TermMention[] = [];
  if (matchers.length === 0) {
    return mentions;
  }
  doc.descendants((node, pos) => {
    if (!node.isTextblock) {
      return true;
    }
    if (node.type.name !== 'heading' && node.type.name !== 'codeBlock') {
      mentions.push(...mentionsIn(searchableText(node), pos + 1, matchers));
    }
    return false;
  });
  return mentions;
}

function decorate(doc: ProseMirrorNode, terms: MentionTerm[]): DecorationSet {
  return DecorationSet.create(
    doc,
    findTermMentions(doc, terms).map((mention) =>
      Decoration.inline(mention.from, mention.to, {
        class: 'term-mention',
        role: 'button',
        tabindex: '0',
        title: 'Voir la définition',
        'data-term-id': String(mention.termId),
      }),
    ),
  );
}

const mentionsKey = new PluginKey<MentionState>('termMentions');

// Donne à l'affichage les termes à reconnaître dans le texte.
export function setMentionTerms(view: EditorView, terms: MentionTerm[]): void {
  if (mentionsKey.getState(view.state)?.terms !== terms) {
    view.dispatch(view.state.tr.setMeta(mentionsKey, terms));
  }
}

// En lecture, rend cliquables les termes du dictionnaire et du glossaire cités dans le
// texte. Rien n'est enregistré dans le contenu : les termes sont reconnus à l'affichage.
export const TermMentions = Extension.create({
  name: 'termMentions',

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin<MentionState>({
        key: mentionsKey,
        state: {
          init: () => ({ terms: [], decorations: DecorationSet.empty }),
          apply: (transaction, state) => {
            const terms =
              (transaction.getMeta(mentionsKey) as MentionTerm[] | undefined) ?? state.terms;
            return terms === state.terms && !transaction.docChanged
              ? state
              : { terms, decorations: decorate(transaction.doc, terms) };
          },
        },
        props: {
          decorations: (state) =>
            editor.isEditable ? DecorationSet.empty : mentionsKey.getState(state)?.decorations,
        },
      }),
    ];
  },
});

import { Node as ProseMirrorNode, Schema } from '@tiptap/pm/model';
import { EditorState, Selection, TextSelection, Transaction } from '@tiptap/pm/state';

// Mêmes limites que dans l'API (api/src/courses/content/content-schema.ts).
export const MAX_QUIZ_QUESTIONS = 50;
export const MAX_QUIZ_CHOICES = 10;
export const MIN_QUIZ_CHOICES = 2;

// Une question compte, outre ses choix, son énoncé et son explication.
const FRAME = 2;

function emptyQuestion(schema: Schema): ProseMirrorNode {
  const { nodes } = schema;
  return nodes['quizQuestion'].create(null, [
    nodes['quizPrompt'].create(null, nodes['paragraph'].create()),
    nodes['quizChoice'].create(),
    nodes['quizChoice'].create(),
    nodes['quizExplanation'].create(null, nodes['paragraph'].create()),
  ]);
}

interface Located {
  node: ProseMirrorNode;
  index: number;
  parent: ProseMirrorNode;
  parentPos: number;
}

// Nœud de ce type placé à cette position ; null s'il y a autre chose.
function locate(state: EditorState, pos: number, type: string): Located | null {
  const $pos = state.doc.resolve(pos);
  const node = $pos.nodeAfter;
  if (node?.type.name !== type || $pos.depth === 0) {
    return null;
  }
  return { node, index: $pos.index(), parent: $pos.parent, parentPos: $pos.before() };
}

// Pose un QCM d'une question vide à la place du paragraphe vide du curseur, sinon après
// le bloc de premier niveau qui le contient. Le curseur entre dans l'énoncé.
export function insertQuiz(transaction: Transaction): boolean {
  const { $from } = transaction.selection;
  if ($from.depth === 0) {
    return false;
  }
  const schema = transaction.doc.type.schema;
  const quiz = schema.nodes['quiz'].create(null, emptyQuestion(schema));
  const block = $from.node(1);
  const isEmptyParagraph =
    $from.depth === 1 && block.type.name === 'paragraph' && block.childCount === 0;
  const pos = isEmptyParagraph ? $from.before(1) : $from.after(1);
  if (isEmptyParagraph) {
    transaction.replaceWith(pos, pos + block.nodeSize, quiz);
  } else {
    transaction.insert(pos, quiz);
  }
  // QCM, question, énoncé, paragraphe : quatre balises avant le texte.
  transaction.setSelection(TextSelection.create(transaction.doc, pos + 4));
  return true;
}

// Ajoute une question vide à la fin du QCM placé à cette position.
export function addQuestion(state: EditorState, quizPos: number): Transaction | null {
  const quiz = state.doc.nodeAt(quizPos);
  if (quiz?.type.name !== 'quiz' || quiz.childCount >= MAX_QUIZ_QUESTIONS) {
    return null;
  }
  const pos = quizPos + quiz.nodeSize - 1;
  const transaction = state.tr.insert(pos, emptyQuestion(state.schema));
  return transaction.setSelection(TextSelection.create(transaction.doc, pos + 3));
}

// Échange la question avec sa voisine du dessus (-1) ou du dessous (1). Renvoie null
// aux extrémités du QCM.
export function moveQuestion(
  state: EditorState,
  pos: number,
  direction: -1 | 1,
): Transaction | null {
  const found = locate(state, pos, 'quizQuestion');
  const target = found ? found.index + direction : -1;
  if (!found || target < 0 || target >= found.parent.childCount) {
    return null;
  }
  const neighbour = found.parent.child(target);
  const from = direction === -1 ? pos - neighbour.nodeSize : pos;
  const pair = direction === -1 ? [found.node, neighbour] : [neighbour, found.node];
  return state.tr.replaceWith(from, from + found.node.nodeSize + neighbour.nodeSize, pair);
}

// Supprime la question ; la dernière emporte le QCM, qui ne peut pas rester vide.
export function removeQuestion(state: EditorState, pos: number): Transaction | null {
  const found = locate(state, pos, 'quizQuestion');
  if (!found) {
    return null;
  }
  return found.parent.childCount === 1
    ? state.tr.delete(found.parentPos, found.parentPos + found.parent.nodeSize)
    : state.tr.delete(pos, pos + found.node.nodeSize);
}

// Ajoute un choix vide à cette position, dans la question qui la contient, et y place le
// curseur. Renvoie null quand la question a déjà tous ses choix.
function insertChoice(state: EditorState, pos: number): Transaction | null {
  const question = state.doc.resolve(pos).parent;
  if (question.type.name !== 'quizQuestion' || question.childCount - FRAME >= MAX_QUIZ_CHOICES) {
    return null;
  }
  const transaction = state.tr.insert(pos, state.schema.nodes['quizChoice'].create());
  return transaction.setSelection(TextSelection.create(transaction.doc, pos + 1));
}

// Ajoute un choix à la fin de ceux de la question placée à cette position.
export function addChoice(state: EditorState, questionPos: number): Transaction | null {
  const question = state.doc.nodeAt(questionPos);
  const explanation = question?.lastChild;
  if (question?.type.name !== 'quizQuestion' || !explanation) {
    return null;
  }
  return insertChoice(state, questionPos + question.nodeSize - 1 - explanation.nodeSize);
}

// Ajoute un choix après celui du curseur ; null quand le curseur n'est pas dans un choix.
export function addChoiceAfterSelection(state: EditorState): Transaction | null {
  const { $from } = state.selection;
  return $from.parent.type.name === 'quizChoice' ? insertChoice(state, $from.after()) : null;
}

// Supprime le choix placé à cette position ; une question en garde toujours deux.
export function removeChoice(state: EditorState, pos: number): Transaction | null {
  const found = locate(state, pos, 'quizChoice');
  if (!found || found.parent.childCount - FRAME <= MIN_QUIZ_CHOICES) {
    return null;
  }
  return state.tr.delete(pos, pos + found.node.nodeSize);
}

// Supprime le choix vide où se trouve le curseur, qui remonte à la fin de ce qui précède.
export function removeEmptyChoiceAtSelection(state: EditorState): Transaction | null {
  const { $from, empty } = state.selection;
  if (!empty || $from.parent.type.name !== 'quizChoice' || $from.parent.childCount > 0) {
    return null;
  }
  const pos = $from.before();
  const transaction = removeChoice(state, pos);
  return transaction?.setSelection(Selection.near(transaction.doc.resolve(pos), -1)) ?? null;
}

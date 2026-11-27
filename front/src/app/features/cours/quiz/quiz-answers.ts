// Réponses données à un QCM, en lecture. Elles vivent dans les cases de la page et ne
// touchent pas au contenu du cours.

export interface QuizScore {
  right: number;
  total: number;
}

const RIGHT = 'Bonne réponse';
const WRONG = 'Mauvaise réponse';

function boxOf(choice: HTMLElement): HTMLInputElement | null {
  return choice.querySelector<HTMLInputElement>('.quiz-choice-box');
}

// Corrige une question : elle est juste quand les cases cochées sont exactement les
// bonnes réponses.
function gradeQuestion(question: HTMLElement): boolean {
  let isRight = true;
  for (const choice of question.querySelectorAll<HTMLElement>('.quiz-choice')) {
    const box = boxOf(choice);
    const isExpected = choice.dataset['correct'] === 'true';
    const isChecked = box?.checked ?? false;
    choice.classList.toggle('is-expected', isExpected);
    choice.classList.toggle('is-mistake', isChecked && !isExpected);
    if (box) {
      box.disabled = true;
    }
    isRight &&= isChecked === isExpected;
  }
  question.classList.add(isRight ? 'is-right' : 'is-wrong');
  const verdict = question.querySelector('.quiz-verdict');
  if (verdict) {
    verdict.textContent = isRight ? RIGHT : WRONG;
  }
  return isRight;
}

// Corrige le QCM : marque chaque question et chaque choix, fige les cases et montre les
// explications (par la classe « is-checked »).
export function gradeQuiz(quiz: HTMLElement): QuizScore {
  const questions = Array.from(quiz.querySelectorAll<HTMLElement>('.quiz-question'));
  const right = questions.filter(gradeQuestion).length;
  quiz.classList.add('is-checked');
  return { right, total: questions.length };
}

// Remet le QCM comme avant toute réponse.
export function resetQuiz(quiz: HTMLElement): void {
  quiz.classList.remove('is-checked');
  for (const question of quiz.querySelectorAll('.quiz-question')) {
    question.classList.remove('is-right', 'is-wrong');
    const verdict = question.querySelector('.quiz-verdict');
    if (verdict) {
      verdict.textContent = '';
    }
  }
  for (const choice of quiz.querySelectorAll<HTMLElement>('.quiz-choice')) {
    choice.classList.remove('is-expected', 'is-mistake');
    const box = boxOf(choice);
    if (box) {
      box.checked = false;
      box.disabled = false;
    }
  }
}

export function scoreLabel({ right, total }: QuizScore): string {
  const answers = right > 1 ? 'bonnes réponses' : 'bonne réponse';
  return `${right} ${answers} sur ${total}`;
}

// Cases cochées du QCM : une liste par question, un booléen par choix.
export function readChecked(quiz: HTMLElement): boolean[][] {
  return Array.from(quiz.querySelectorAll<HTMLElement>('.quiz-question')).map((question) =>
    Array.from(question.querySelectorAll<HTMLElement>('.quiz-choice')).map(
      (choice) => boxOf(choice)?.checked ?? false,
    ),
  );
}

// Recoche les cases d'un QCM repris plus tard. Les cases en trop ou en moins (le QCM a pu
// être modifié entre-temps) sont ignorées ; un QCM déjà validé n'est pas touché.
export function applyChecked(quiz: HTMLElement, checked: boolean[][]): void {
  if (quiz.classList.contains('is-checked')) {
    return;
  }
  quiz.querySelectorAll<HTMLElement>('.quiz-question').forEach((question, rank) => {
    question.querySelectorAll<HTMLElement>('.quiz-choice').forEach((choice, index) => {
      const box = boxOf(choice);
      if (box) {
        box.checked = checked[rank]?.[index] === true;
      }
    });
  });
}

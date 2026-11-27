import { extractPlainText } from './extract-plain-text.js';

describe('extractPlainText', () => {
  it('met un bloc par ligne, y compris dans les listes et les tableaux', () => {
    const text = extractPlainText({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '1. Processus' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Un ' },
            { type: 'text', text: 'processus', marks: [{ type: 'bold' }] },
            { type: 'hardBreak' },
            { type: 'text', text: 'en exécution.' },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Prêt' }],
                },
              ],
            },
          ],
        },
        { type: 'codeBlock', content: [{ type: 'text', text: 'fork();' }] },
        { type: 'paragraph' },
      ],
    });

    expect(text).toBe(
      '1. Processus\nUn processus\nen exécution.\nPrêt\nfork();',
    );
  });
  it('reprend le titre d’un QCM et le texte de ses choix', () => {
    const text = extractPlainText({
      type: 'doc',
      content: [
        {
          type: 'quiz',
          attrs: { title: 'Processus' },
          content: [
            {
              type: 'quizQuestion',
              content: [
                {
                  type: 'quizPrompt',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Vrai ?' }],
                    },
                  ],
                },
                {
                  type: 'quizChoice',
                  attrs: { correct: true },
                  content: [{ type: 'text', text: 'oui' }],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(text).toBe('Processus\nVrai ?\noui');
  });
});

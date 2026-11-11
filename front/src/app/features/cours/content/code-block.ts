import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';

export const CODE_LANGUAGES = [
  'bash',
  'c',
  'cpp',
  'css',
  'java',
  'javascript',
  'json',
  'python',
  'sql',
  'typescript',
  'xml',
  'yaml',
] as const;

function createLanguageSelect(): HTMLSelectElement {
  const select = document.createElement('select');
  select.className = 'code-language';
  select.contentEditable = 'false';
  select.setAttribute('aria-label', 'Langage du bloc de code');
  select.append(new Option('Détection automatique', ''));
  for (const language of CODE_LANGUAGES) {
    select.append(new Option(language, language));
  }
  return select;
}

function readLanguage(attrs: Record<string, unknown>): string {
  const language: unknown = attrs['language'];
  return typeof language === 'string' ? language : '';
}

// Bloc de code avec, en édition, le choix du langage posé sur le bloc lui-même.
// Le contenu enregistré est celui du bloc de code standard.
export const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('div');
      dom.className = 'code-block';
      const select = createLanguageSelect();
      select.value = readLanguage(node.attrs);
      select.hidden = !editor.isEditable;
      select.addEventListener('change', () => {
        const pos = getPos();
        if (typeof pos === 'number') {
          editor.view.dispatch(
            editor.state.tr.setNodeAttribute(pos, 'language', select.value || null),
          );
        }
      });
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      pre.append(code);
      dom.append(select, pre);
      return {
        dom,
        contentDOM: code,
        update: (updated) => {
          if (updated.type !== node.type) {
            return false;
          }
          select.value = readLanguage(updated.attrs);
          select.hidden = !editor.isEditable;
          return true;
        },
        // La liste déroulante se manipule sans que l'éditeur s'en mêle.
        stopEvent: (event) => event.target instanceof Node && select.contains(event.target),
        ignoreMutation: (mutation) => select.contains(mutation.target),
      };
    };
  },
});

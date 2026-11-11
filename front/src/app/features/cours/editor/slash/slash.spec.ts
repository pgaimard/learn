import { Editor } from '@tiptap/core';
import { createCourseExtensions } from '../../content/course-extensions';
import { filterSlashCommands } from './slash-commands';
import { SlashMenuState } from './slash-menu-state';

describe('menu « / »', () => {
  let editor: Editor;
  let state: SlashMenuState;
  let imagePicks: number;

  beforeEach(() => {
    imagePicks = 0;
    state = new SlashMenuState(
      () => editor,
      () => imagePicks++,
    );
    editor = new Editor({
      extensions: createCourseExtensions({
        blockHandle: { onOpenMenu: () => undefined },
        tableTools: { onOpenMenu: () => undefined },
        selection: { onChange: () => undefined, onCodeBlock: () => undefined },
        slash: { onChange: (trigger) => state.show(trigger), onKey: (key) => state.handleKey(key) },
      }),
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Avant' }] },
          { type: 'paragraph' },
        ],
      },
    });
    // Curseur dans le second paragraphe, vide.
    editor.commands.setTextSelection(8);
  });

  afterEach(() => editor.destroy());

  function type(text: string): void {
    editor.commands.insertContent(text);
  }

  function press(key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    editor.view.dom.dispatchEvent(event);
    return event;
  }

  function blocks(): string[] {
    const names: string[] = [];
    editor.state.doc.forEach((node) => names.push(`${node.type.name}:${node.textContent}`));
    return names;
  }

  function labels(): string[] {
    return state.commands().map((command) => command.label);
  }

  describe('filtre', () => {
    it('propose tous les blocs pour un « / » seul', () => {
      expect(filterSlashCommands('').length).toBeGreaterThan(10);
    });

    it('cherche dans le nom et les mots-clés, sans accents ni casse', () => {
      expect(filterSlashCommands('TAB').map((command) => command.label)).toEqual(['Tableau']);
      expect(filterSlashCommands('sep').map((command) => command.label)).toEqual(['Séparateur']);
      expect(filterSlashCommands('photo').map((command) => command.label)).toEqual(['Image']);
    });

    it('met en tête les noms qui commencent par la saisie', () => {
      expect(filterSlashCommands('liste').map((command) => command.label)).toEqual([
        'Liste à puces',
        'Liste numérotée',
      ]);
      expect(
        filterSlashCommands('s')
          .map((command) => command.label)
          .slice(0, 4),
      ).toEqual(['Section', 'Sous-section', 'Sous-sous-section', 'Séparateur']);
    });

    it('ne propose rien pour une saisie inconnue', () => {
      expect(filterSlashCommands('zzz')).toEqual([]);
    });
  });

  describe('ouverture', () => {
    it('s’ouvre sur un « / » en début de paragraphe et suit la saisie', () => {
      type('/');
      expect(state.trigger()).toMatchObject({ query: '', from: 8, to: 9 });

      type('tab');
      expect(state.trigger()).toMatchObject({ query: 'tab', from: 8, to: 12 });
      expect(labels()).toEqual(['Tableau']);
    });

    it('s’ouvre après un espace, mais pas au milieu d’un mot ni d’une adresse', () => {
      type('voir /');
      expect(state.trigger()).not.toBeNull();

      editor.commands.setContent({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'et/' }] }],
      });
      editor.commands.setTextSelection(4);
      expect(state.trigger()).toBeNull();
    });

    it('se ferme quand la saisie n’est plus un nom de bloc ou que le curseur s’en va', () => {
      type('/tab');
      type(' ');
      expect(state.trigger()).toBeNull();

      editor.commands.insertContent('/co');
      expect(state.trigger()).not.toBeNull();
      editor.commands.setTextSelection(2);
      expect(state.trigger()).toBeNull();
    });

    it('ne s’ouvre pas dans un bloc de code', () => {
      editor.commands.setCodeBlock();

      type('/');

      expect(state.trigger()).toBeNull();
    });

    it('se ferme avec Échap et ne se rouvre pas pour le même « / »', () => {
      type('/');

      const escape = press('Escape');
      expect(escape.defaultPrevented).toBe(true);
      expect(state.trigger()).toBeNull();

      type('ta');
      expect(state.trigger()).toBeNull();
    });

    it('se ferme quand le curseur quitte l’éditeur', () => {
      type('/');

      editor.view.dom.dispatchEvent(new FocusEvent('blur'));

      expect(state.trigger()).toBeNull();
    });
  });

  describe('invite', () => {
    function hint(): string | null {
      return (
        editor.view.dom.querySelector('.is-empty-paragraph')?.getAttribute('data-placeholder') ??
        null
      );
    }

    it('rappelle le « / » dans le paragraphe vide du curseur', () => {
      expect(hint()).toBe('Tapez / pour insérer un bloc');
      expect(editor.view.dom.querySelectorAll('.is-empty-paragraph')).toHaveLength(1);
    });

    it('disparaît dès qu’on écrit, ou quand le curseur est ailleurs', () => {
      type('a');
      expect(hint()).toBeNull();

      editor.commands.deleteRange({ from: 8, to: 9 });
      expect(hint()).not.toBeNull();
      editor.commands.setTextSelection(2);
      expect(hint()).toBeNull();
    });

    it('ne s’affiche ni dans un titre vide, ni dans une cellule, ni en lecture', () => {
      editor.commands.setHeading({ level: 2 });
      expect(hint()).toBeNull();

      editor.commands.setParagraph();
      editor.commands.insertTable({ rows: 1, cols: 1 });
      expect(hint()).toBeNull();

      editor.commands.setTextSelection(editor.state.doc.content.size - 1);
      expect(hint()).not.toBeNull();
      editor.setEditable(false);
      expect(hint()).toBeNull();
    });

    it('ne fait pas partie du contenu enregistré', () => {
      expect(JSON.stringify(editor.getJSON())).not.toContain('Tapez');
    });
  });

  describe('choix', () => {
    it('se parcourt aux flèches, en bouclant', () => {
      type('/liste');

      press('ArrowDown');
      expect(state.activeIndex()).toBe(1);
      press('ArrowDown');
      expect(state.activeIndex()).toBe(0);
      press('ArrowUp');
      expect(state.activeIndex()).toBe(1);
    });

    it('revient au premier bloc quand la saisie change', () => {
      type('/liste');
      press('ArrowDown');

      type('s');

      expect(state.activeIndex()).toBe(0);
    });

    it('insère le bloc choisi avec Entrée et retire le « /mot »', () => {
      type('/tab');

      const enter = press('Enter');

      expect(enter.defaultPrevented).toBe(true);
      expect(blocks().slice(0, 2)).toEqual(['paragraph:Avant', 'table:']);
      expect(state.trigger()).toBeNull();
    });

    it('transforme le paragraphe en gardant le texte déjà écrit', () => {
      editor.commands.insertContent('Notion de processus /sec');

      press('Enter');

      // L'éditeur garde un paragraphe vide après un titre placé en fin de document.
      expect(blocks().slice(0, 2)).toEqual(['paragraph:Avant', 'heading:Notion de processus ']);
      expect(editor.state.doc.child(1).attrs['level']).toBe(2);
    });

    it('insère le bloc cliqué', () => {
      type('/');

      state.pick(labels().indexOf('Séparateur'));

      expect(blocks()).toContain('horizontalRule:');
    });

    it('ouvre le choix d’un fichier pour une image', () => {
      type('/image');

      press('Enter');

      expect(imagePicks).toBe(1);
      expect(blocks()).toEqual(['paragraph:Avant', 'paragraph:']);
    });

    it('laisse Entrée à l’éditeur quand aucun bloc ne correspond', () => {
      type('/zzz');

      press('Enter');

      expect(blocks()).toEqual(['paragraph:Avant', 'paragraph:/zzz', 'paragraph:']);
    });
  });
});

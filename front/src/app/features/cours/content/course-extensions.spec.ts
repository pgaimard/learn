import { Editor } from '@tiptap/core';
import example from '../../../../../../contracts/course-content.example.json';
import { createCourseExtensions } from './course-extensions';

describe('createCourseExtensions', () => {
  // Le même fichier est validé par la liste blanche de l'API : si l'éditeur produit un bloc
  // ou un attribut de plus, ce test échoue avant que l'API ne refuse un enregistrement.
  it('relit et réécrit à l’identique le cours d’exemple partagé avec l’API', () => {
    const editor = new Editor({ extensions: createCourseExtensions(), content: example });

    expect(editor.getJSON()).toEqual(example);

    editor.destroy();
  });

  it('écarte un bloc inconnu au lieu de l’afficher', () => {
    const editor = new Editor({
      extensions: createCourseExtensions(),
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Texte' }] }],
      },
    });

    editor.commands.setContent('<p>Texte</p><script>alert(1)</script><iframe src="x"></iframe>');

    expect(JSON.stringify(editor.getJSON())).not.toMatch(/script|iframe/);
    editor.destroy();
  });
});

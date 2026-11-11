import { Editor } from '@tiptap/core';
import { DialogService } from '../../../../core/dialog/dialog.service';

// Demande l'adresse du lien de la sélection, puis le pose, le modifie ou le retire.
export async function editLink(editor: Editor, dialog: DialogService): Promise<void> {
  const current: unknown = editor.getAttributes('link')['href'];
  const href = await dialog.prompt({
    title: 'Lien',
    label: 'Adresse du lien',
    initialValue: typeof current === 'string' ? current : 'https://',
    hint: 'Laisser vide pour retirer le lien.',
  });
  if (href === null) {
    return;
  }
  const chain = editor.chain().focus().extendMarkRange('link');
  if (href.trim() === '') {
    chain.unsetLink().run();
  } else {
    chain.setLink({ href: href.trim() }).run();
  }
}

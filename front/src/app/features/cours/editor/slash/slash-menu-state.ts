import { computed, signal } from '@angular/core';
import { Editor } from '@tiptap/core';
import {
  filterSlashCommands,
  IMAGE_COMMAND,
  runSlashCommand,
  SlashCommand,
} from './slash-commands';
import { SlashTrigger } from './slash-watcher';

// État du menu « / » : le « / » en cours de saisie, les blocs qui correspondent et
// celui qui est mis en avant. Le focus reste dans l'éditeur ; les touches lui arrivent.
export class SlashMenuState {
  readonly trigger = signal<SlashTrigger | null>(null);
  readonly activeIndex = signal(0);
  readonly commands = computed(() => filterSlashCommands(this.trigger()?.query ?? ''));

  constructor(
    private readonly editor: () => Editor | null,
    // Ouvre le choix d'un fichier image.
    private readonly pickImage: () => void,
  ) {}

  show(trigger: SlashTrigger | null): void {
    if (trigger?.query !== this.trigger()?.query) {
      this.activeIndex.set(0);
    }
    this.trigger.set(trigger);
  }

  // Renvoie true si la touche a été traitée par le menu.
  handleKey(key: string): boolean {
    const count = this.commands().length;
    if (count === 0) {
      return false;
    }
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      const step = key === 'ArrowDown' ? 1 : -1;
      this.activeIndex.update((index) => (index + step + count) % count);
      return true;
    }
    if (key === 'Enter') {
      this.pick(this.activeIndex());
      return true;
    }
    return false;
  }

  pick(index: number): void {
    const editor = this.editor();
    const trigger = this.trigger();
    const command = this.commands().at(index) as SlashCommand | undefined;
    if (!editor || !trigger || !command) {
      return;
    }
    runSlashCommand(editor, command, trigger);
    if (command === IMAGE_COMMAND) {
      this.pickImage();
    }
  }
}

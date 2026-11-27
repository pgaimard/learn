import { computed, signal } from '@angular/core';
import { Editor } from '@tiptap/core';
import {
  filterSlashCommands,
  IMAGE_COMMAND,
  SLIDESHOW_COMMAND,
  runSlashCommand,
  SlashCommand,
  TABLE_COMMAND,
} from './slash-commands';
import { SlashTrigger } from './slash-watcher';

// État du menu « / » : le « / » en cours de saisie, les blocs qui correspondent et
// celui qui est mis en avant. Le focus reste dans l'éditeur ; les touches lui arrivent.
export class SlashMenuState {
  readonly trigger = signal<SlashTrigger | null>(null);
  readonly activeIndex = signal(0);
  readonly commands = computed(() =>
    filterSlashCommands(this.trigger()?.query ?? '', this.allowExercises()),
  );

  constructor(
    private readonly editor: () => Editor | null,
    // Ouvre le choix d'un fichier image.
    private readonly pickImage: () => void,
    // Ouvre le choix des images d'un diaporama.
    private readonly pickSlideshow: () => void,
    // Ouvre le choix d'un tableau à l'endroit du menu.
    private readonly pickTable: (place: { top: number; left: number }) => void,
    // Vrai dans l'éditeur des exercices d'un cours : le QCM et l'exercice y sont proposés.
    private readonly allowExercises: () => boolean = () => false,
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
    if (command === SLIDESHOW_COMMAND) {
      this.pickSlideshow();
    }
    if (command === TABLE_COMMAND) {
      this.pickTable({ top: trigger.top, left: trigger.left });
    }
  }
}

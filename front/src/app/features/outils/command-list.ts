import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DropdownOption, Dropdown } from '../../core/ui/dropdown';
import { Icon } from '../../core/ui/icon';
import { Segmented, SegmentedOption } from '../../core/ui/segmented';
import { CommandSheet } from './command-sheet';
import { Command, CommandTool } from './command.service';
import { filterCommands, listThemes } from './filter-commands';
import { ToolVariant } from './tool.service';

// Volet « Commandes » d'un outil : la liste, sa recherche et ses filtres ; une commande
// choisie déplie sa fiche.
@Component({
  selector: 'app-command-list',
  imports: [CommandSheet, Dropdown, Icon, RouterLink, Segmented],
  templateUrl: './command-list.html',
  styleUrl: './command-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandList {
  readonly tool = input.required<CommandTool>();
  // Liste posée dans une autre page (onglet d'une UE) : sans barre de recherche ni
  // filtres, la page ne lui donne que les commandes à montrer.
  readonly embedded = input(false);
  readonly commands = input.required<Command[]>();
  // Commande à montrer dépliée à l'arrivée (lien « Aussi dans », retour de l'édition).
  readonly openId = input<number | null>(null);
  // Demande de suppression : la page confirme et supprime.
  readonly removed = output<Command>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly query = signal('');
  protected readonly theme = signal('');
  // Valeurs des listes de filtres : le numéro en texte, vide pour « tous ».
  protected readonly mode = signal('');
  protected readonly variant = signal('');
  protected readonly open = linkedSignal(() => this.openId());

  protected readonly themes = computed(() => listThemes(this.commands()));
  protected readonly modeOptions = computed<DropdownOption[]>(() => [
    { value: '', label: 'Tous les modes' },
    ...this.tool().modes.map((mode) => ({ value: String(mode.id), label: mode.name })),
  ]);
  protected readonly variantOptions = computed<SegmentedOption[]>(() => [
    { value: '', label: 'Toutes' },
    ...this.tool().variants.map((variant) => ({ value: String(variant.id), label: variant.name })),
  ]);
  protected readonly shown = computed(() =>
    filterCommands(this.commands(), {
      query: this.query(),
      theme: this.theme(),
      modeId: this.mode() === '' ? null : Number(this.mode()),
      variantId: this.variant() === '' ? null : Number(this.variant()),
    }),
  );

  constructor() {
    // La commande demandée à l'arrivée est amenée à l'écran.
    effect(() => {
      const id = this.openId();
      if (id !== null && this.commands().some((command) => command.id === id)) {
        afterNextRender(
          () =>
            this.host.nativeElement
              .querySelector(`#commande-${id}`)
              ?.scrollIntoView({ block: 'start' }),
          { injector: this.injector },
        );
      }
    });
  }

  protected typeQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected toggleTheme(theme: string): void {
    this.theme.update((current) => (current === theme ? '' : theme));
  }

  protected toggle(id: number): void {
    this.open.update((current) => (current === id ? null : id));
  }

  protected modeName(command: Command): string {
    return this.tool().modes.find((mode) => mode.id === command.modeId)?.name ?? '';
  }

  protected variants(command: Command): ToolVariant[] {
    return this.tool().variants.filter((variant) => command.variantIds.includes(variant.id));
  }
}

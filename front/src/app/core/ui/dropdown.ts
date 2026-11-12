import {
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  forwardRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Icon } from './icon';

export interface DropdownOption {
  value: string;
  label: string;
  // Code affiché en pastille devant le libellé (code d'une UE).
  code?: string;
  // Rendu du libellé dans la liste : un style de titre s'y montre à sa taille.
  look?: 'large' | 'medium' | 'strong' | 'muted';
}

let nextId = 0;

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

// Liste déroulante de l'application, à la place du <select> du navigateur : un bouton
// qui montre la valeur, et un panneau d'options piloté à la souris ou au clavier.
@Component({
  selector: 'app-dropdown',
  imports: [Icon],
  templateUrl: './dropdown.html',
  styleUrl: './dropdown.css',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => Dropdown), multi: true }],
  host: {
    '[class.is-compact]': 'compact()',
    '(document:click)': 'closeFromOutside($event)',
    '(focusout)': 'closeWhenFocusLeaves($event)',
    '(keydown)': 'onKeydown($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dropdown implements ControlValueAccessor {
  readonly options = input.required<DropdownOption[]>();
  // Valeur posée par le gabarit ou par le formulaire ; seul un choix de l'utilisateur
  // émet valueChange.
  readonly value = input('');
  readonly valueChange = output<string>();
  protected readonly current = linkedSignal(() => this.value());
  // Identifiant du bouton : celui que vise le <label for> du champ.
  readonly fieldId = input<string>();
  // Nom du champ quand aucun <label> ne le porte.
  readonly label = input<string>();
  readonly describedBy = input<string | null>(null);
  // Champ de recherche en tête de liste, pour les listes longues.
  readonly searchable = input(false, { transform: booleanAttribute });
  readonly searchLabel = input('Chercher');
  // Version basse, pour une barre d'outils.
  readonly compact = input(false, { transform: booleanAttribute });
  readonly monospace = input(false, { transform: booleanAttribute });
  // Faux quand le choix rend lui-même le curseur ailleurs (à l'éditeur, par exemple).
  readonly returnFocus = input(true);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly button = viewChild.required<ElementRef<HTMLButtonElement>>('button');
  private readonly searchField = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  protected readonly listId = `dropdown-${nextId++}`;
  protected readonly isOpen = signal(false);
  protected readonly isDisabled = signal(false);
  protected readonly query = signal('');
  protected readonly activeIndex = signal(0);

  protected readonly selected = computed(() =>
    this.options().find((option) => option.value === this.current()),
  );
  protected readonly visible = computed(() => {
    const query = normalize(this.query().trim());
    return query
      ? this.options().filter((option) =>
          normalize(`${option.code ?? ''} ${option.label}`).includes(query),
        )
      : this.options();
  });
  protected readonly activeId = computed(() =>
    this.isOpen() && this.visible().length > 0 ? this.optionId(this.activeIndex()) : null,
  );

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    afterRenderEffect(() => {
      if (!this.isOpen()) {
        return;
      }
      this.searchField()?.nativeElement.focus();
      this.activeIndex();
      const active = this.host.nativeElement.querySelector<HTMLElement>('.is-active');
      // Absent de l'environnement de test, qui ne fait pas de mise en page.
      if (typeof active?.scrollIntoView === 'function') {
        active.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  writeValue(value: string | null): void {
    this.current.set(value ?? '');
  }

  registerOnChange(onChange: (value: string) => void): void {
    this.onChange = onChange;
  }

  registerOnTouched(onTouched: () => void): void {
    this.onTouched = onTouched;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  protected optionId(index: number): string {
    return `${this.listId}-${index}`;
  }

  protected toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  protected search(query: string): void {
    this.query.set(query);
    this.activeIndex.set(0);
  }

  protected choose(option: DropdownOption): void {
    this.close();
    if (this.returnFocus()) {
      this.button().nativeElement.focus();
    }
    if (option.value !== this.current()) {
      this.current.set(option.value);
      this.valueChange.emit(option.value);
      this.onChange(option.value);
    }
  }

  protected closeFromOutside(event: Event): void {
    if (event.target instanceof Node && !this.host.nativeElement.contains(event.target)) {
      this.close();
    }
  }

  protected closeWhenFocusLeaves(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (!(next instanceof Node && this.host.nativeElement.contains(next))) {
      this.close();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen()) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        this.open();
      }
      return;
    }
    const last = this.visible().length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(this.activeIndex() + 1, last),
      ArrowUp: Math.max(this.activeIndex() - 1, 0),
      Home: 0,
      End: last,
    };
    if (event.key in moves && !(this.searchable() && /Home|End/.test(event.key))) {
      event.preventDefault();
      this.activeIndex.set(Math.max(moves[event.key], 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = this.visible().at(this.activeIndex());
      if (option) {
        this.choose(option);
      }
    } else if (event.key === 'Escape') {
      // La liste se ferme seule : la modale qui la contient reste ouverte.
      event.preventDefault();
      event.stopPropagation();
      this.close();
      this.button().nativeElement.focus();
    }
  }

  private open(): void {
    if (this.isDisabled()) {
      return;
    }
    this.query.set('');
    this.activeIndex.set(Math.max(this.options().indexOf(this.selected() ?? this.options()[0]), 0));
    this.isOpen.set(true);
  }

  private close(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
      this.onTouched();
    }
  }
}

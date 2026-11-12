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
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  DEFAULT_HOUR,
  durationChoices,
  formatFullDay,
  formatLabel,
  formatMonth,
  formatTime,
  formatTyped,
  formatValue,
  isSameDay,
  monthDays,
  pad,
  parseTyped,
  parseValue,
  shiftDays,
  shiftMonths,
  shortcuts,
} from './date-field-values';
import { Icon } from './icon';

let nextId = 0;

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const QUARTERS = [0, 15, 30, 45];
const DAY_MOVES: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

// Sélecteur de date de l'application, à la place du champ natif du navigateur : un bouton
// qui montre la date, et un panneau avec des raccourcis, un calendrier, l'heure et une
// saisie au clavier. Sa valeur a le format des champs natifs (« AAAA-MM-JJTHH:MM », ou
// « AAAA-MM-JJ » sans heure) ; chaque choix est appliqué aussitôt.
@Component({
  selector: 'app-date-field',
  imports: [Icon],
  templateUrl: './date-field.html',
  styleUrl: './date-field.css',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateField), multi: true },
  ],
  host: {
    '[class.is-compact]': 'compact()',
    '(document:click)': 'closeFromOutside($event)',
    '(focusout)': 'closeWhenFocusLeaves($event)',
    '(keydown.escape)': 'closeOnEscape($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DateField implements ControlValueAccessor {
  // Identifiant du bouton : celui que vise le <label for> du champ.
  readonly fieldId = input<string>();
  // Nom du champ quand aucun <label> ne le porte.
  readonly label = input<string>();
  readonly describedBy = input<string | null>(null);
  // Faux pour une date seule (fin de répétition).
  readonly withTime = input(true, { transform: booleanAttribute });
  // Faux quand le champ ne peut pas rester vide.
  readonly clearable = input(true, { transform: booleanAttribute });
  // Texte du champ vide.
  readonly placeholder = input('Sans date');
  readonly invalid = input(false);
  // Version basse, pour une barre d'outils.
  readonly compact = input(false, { transform: booleanAttribute });
  // Début dont ce champ est la fin : la fin est alors proposée en durée.
  readonly durationFrom = input('');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly button = viewChild.required<ElementRef<HTMLButtonElement>>('button');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  protected readonly valueId = `date-field-${nextId++}`;
  protected readonly weekdays = WEEKDAYS;
  protected readonly hours = HOURS;

  protected readonly current = signal('');
  protected readonly isOpen = signal(false);
  protected readonly isDisabled = signal(false);
  // Fin proposée en durée, ou calendrier complet.
  protected readonly mode = signal<'durations' | 'full'>('full');
  protected readonly isTypedInvalid = signal(false);
  // Le panneau s'aligne à droite ou s'ouvre vers le haut quand la place manque.
  protected readonly alignsEnd = signal(false);
  protected readonly dropsUp = signal(false);
  private readonly viewMonth = signal(new Date());
  private readonly today = signal(new Date());
  // Après un déplacement aux flèches, le curseur suit le jour choisi.
  private focusesDay = false;

  protected readonly selected = computed(() => parseValue(this.current()));
  private readonly start = computed(() => parseValue(this.durationFrom()));
  protected readonly display = computed(() => {
    const selected = this.selected();
    if (selected === null) {
      return '';
    }
    const start = this.start();
    return start && isSameDay(start, selected)
      ? formatTime(selected)
      : formatLabel(selected, this.withTime());
  });
  protected readonly describedByIds = computed(() =>
    [this.valueId, this.describedBy()].filter(Boolean).join(' '),
  );
  protected readonly canClear = computed(
    () => this.clearable() && this.selected() !== null && !this.isDisabled(),
  );
  protected readonly panelLabel = computed(() =>
    this.withTime() ? 'Choisir une date et une heure' : 'Choisir une date',
  );
  protected readonly monthTitle = computed(() => formatMonth(this.viewMonth()));
  protected readonly shortcuts = computed(() => shortcuts(this.today()));
  protected readonly durations = computed(() => {
    const start = this.start();
    return start ? durationChoices(start) : [];
  });
  protected readonly days = computed(() => {
    const month = this.viewMonth().getMonth();
    const selected = this.selected();
    const today = this.today();
    const days = monthDays(this.viewMonth()).map((date) => ({
      date,
      label: formatFullDay(date),
      isOutside: date.getMonth() !== month,
      isToday: isSameDay(date, today),
      isSelected: selected !== null && isSameDay(date, selected),
    }));
    // Un seul jour reçoit la tabulation : le jour choisi, sinon aujourd'hui, sinon le 1er.
    const focusable =
      days.find((day) => day.isSelected) ??
      days.find((day) => day.isToday) ??
      days.find((day) => !day.isOutside);
    return days.map((day) => ({ ...day, isFocusable: day === focusable }));
  });
  // Les quarts d'heure, et la minute en cours si elle n'en est pas un.
  protected readonly minutes = computed(() => {
    const minute = this.selected()?.getMinutes() ?? 0;
    return QUARTERS.includes(minute) ? QUARTERS : [...QUARTERS, minute].sort((a, b) => a - b);
  });
  protected readonly typedText = computed(() => formatTyped(this.selected(), this.withTime()));
  protected readonly typedHint = computed(() =>
    this.withTime() ? 'JJ/MM/AAAA HH:MM' : 'JJ/MM/AAAA',
  );

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    afterRenderEffect(() => {
      const panel = this.panel()?.nativeElement;
      this.mode();
      this.current();
      if (!panel) {
        return;
      }
      this.place(panel);
      if (this.focusesDay) {
        this.focusesDay = false;
        panel.querySelector<HTMLElement>('.day.is-selected')?.focus();
      }
      for (const chosen of panel.querySelectorAll<HTMLElement>('.times .is-selected')) {
        // Absent de l'environnement de test, qui ne fait pas de mise en page.
        if (typeof chosen.scrollIntoView === 'function') {
          chosen.scrollIntoView({ block: 'center' });
        }
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

  protected pad(value: number): string {
    return pad(value);
  }

  protected toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  protected shiftMonth(months: number): void {
    this.viewMonth.set(shiftMonths(this.viewMonth(), months));
  }

  // Un jour choisi garde l'heure en cours ; une date seule referme le panneau.
  protected pickDay(day: Date): void {
    this.commit(this.withTimeOf(day));
    if (!this.withTime()) {
      this.closeAndFocus();
    }
  }

  protected pickHour(hour: number): void {
    const base = this.selected() ?? this.withTimeOf(this.today());
    this.commit(
      new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, base.getMinutes()),
    );
  }

  protected pickMinute(minute: number): void {
    const base = this.selected() ?? this.withTimeOf(this.today());
    this.commit(
      new Date(base.getFullYear(), base.getMonth(), base.getDate(), base.getHours(), minute),
    );
  }

  protected pickDuration(date: Date): void {
    this.commit(date);
    this.closeAndFocus();
  }

  protected moveDay(event: KeyboardEvent): void {
    const days = DAY_MOVES[event.key];
    if (days === undefined) {
      return;
    }
    event.preventDefault();
    this.focusesDay = true;
    this.commit(this.withTimeOf(shiftDays(this.selected() ?? this.today(), days)));
  }

  protected type(field: HTMLInputElement): void {
    if (field.value.trim() === '' && this.clearable()) {
      this.isTypedInvalid.set(false);
      this.commit(null);
      return;
    }
    const date = parseTyped(field.value, this.selected());
    this.isTypedInvalid.set(date === null);
    if (date !== null) {
      this.commit(date);
    }
  }

  protected clear(): void {
    this.commit(null);
    this.closeAndFocus();
  }

  protected closeAndFocus(): void {
    this.close();
    this.button().nativeElement.focus();
  }

  protected closeFromOutside(event: Event): void {
    // Le chemin de l'événement, pas sa cible : un bouton du panneau peut avoir disparu
    // de la page à la suite de son propre clic.
    if (!event.composedPath().includes(this.host.nativeElement)) {
      this.close();
    }
  }

  protected closeWhenFocusLeaves(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (next instanceof Node && !this.host.nativeElement.contains(next)) {
      this.close();
    }
  }

  protected closeOnEscape(event: Event): void {
    if (this.isOpen()) {
      // Le panneau se ferme seul : la modale qui le contient reste ouverte.
      event.preventDefault();
      event.stopPropagation();
      this.closeAndFocus();
    }
  }

  private open(): void {
    if (this.isDisabled()) {
      return;
    }
    const selected = this.selected();
    const start = this.start();
    this.today.set(new Date());
    this.viewMonth.set(selected ?? start ?? this.today());
    this.mode.set(
      start && (selected === null || isSameDay(start, selected)) ? 'durations' : 'full',
    );
    this.isTypedInvalid.set(false);
    this.alignsEnd.set(false);
    this.dropsUp.set(false);
    this.isOpen.set(true);
  }

  private close(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
      this.onTouched();
    }
  }

  private commit(date: Date | null): void {
    const value = formatValue(date, this.withTime());
    if (date !== null) {
      this.viewMonth.set(date);
    }
    if (value !== this.current()) {
      this.current.set(value);
      this.onChange(value);
    }
  }

  // Le jour donné, à l'heure déjà choisie (9 h par défaut).
  private withTimeOf(day: Date): Date {
    const time = this.selected();
    return new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      time?.getHours() ?? DEFAULT_HOUR,
      time?.getMinutes() ?? 0,
    );
  }

  private place(panel: HTMLElement): void {
    const frame = panel.getBoundingClientRect();
    const margin = 8;
    if (frame.right > window.innerWidth - margin) {
      this.alignsEnd.set(true);
    }
    if (frame.bottom > window.innerHeight - margin && frame.top - frame.height > margin) {
      this.dropsUp.set(true);
    }
  }
}

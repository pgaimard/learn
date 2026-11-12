import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  AgendaItem,
  DAY_END_HOUR,
  DAY_START_HOUR,
  HOUR_PX,
  layoutDay,
  nowOffset,
} from './calendar';
import { formatDay, isSameDay, weekDays } from './week';

const WEEKDAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });

// Vue Semaine : sept colonnes sur une grille horaire, chaque élément à son heure.
@Component({
  selector: 'app-week-grid',
  templateUrl: './week-grid.html',
  styleUrl: './week-grid.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeekGrid {
  readonly weekStart = input.required<Date>();
  readonly items = input.required<AgendaItem[]>();
  // Instant présent : marque le jour et trace la ligne de l'heure.
  readonly now = input.required<Date>();

  // Jour où créer un événement ; la page s'en charge.
  // Élément dont ouvrir le détail : événement ou tâche.
  readonly itemPicked = output<AgendaItem>();
  readonly dayPicked = output<Date>();

  protected readonly hours = Array.from(
    { length: DAY_END_HOUR - DAY_START_HOUR },
    (_, index) => `${String(DAY_START_HOUR + index).padStart(2, '0')}:00`,
  );
  protected readonly gridHeight = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_PX;
  protected readonly days = computed(() =>
    weekDays(this.weekStart()).map((date) => {
      const isToday = isSameDay(date, this.now());
      return {
        date,
        isToday,
        weekday: WEEKDAY.format(date).replace('.', ''),
        label: formatDay(date),
        blocks: layoutDay(date, this.items()),
        now: isToday ? nowOffset(this.now()) : null,
      };
    }),
  );
}

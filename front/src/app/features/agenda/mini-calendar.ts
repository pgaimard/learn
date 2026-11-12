import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Icon } from '../../core/ui/icon';
import { AgendaItem, addMonths, itemsOfDay, monthGrid } from './calendar';
import { addDays, formatDay, isSameDay, startOfWeek } from './week';

const MONTH = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// Petit calendrier du mois : il situe la semaine affichée et mène à un autre jour.
@Component({
  selector: 'app-mini-calendar',
  imports: [Icon],
  templateUrl: './mini-calendar.html',
  styleUrl: './mini-calendar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MiniCalendar {
  // Jour de référence : son mois est affiché, sa semaine peut être mise en avant.
  readonly date = input.required<Date>();
  readonly items = input.required<AgendaItem[]>();
  readonly now = input.required<Date>();
  // Met en avant la semaine du jour de référence (vues Semaine et Liste).
  readonly showWeek = input(false);

  // Jour vers lequel aller ; la page change l'adresse.
  readonly picked = output<Date>();

  protected readonly weekdays = WEEKDAYS;
  protected readonly title = computed(() => MONTH.format(this.date()));
  protected readonly days = computed(() => {
    const weekStart = startOfWeek(this.date());
    const weekEnd = addDays(weekStart, 7);
    return monthGrid(this.date()).map((date) => ({
      date,
      label: formatDay(date),
      isOutside: date.getMonth() !== this.date().getMonth(),
      isToday: isSameDay(date, this.now()),
      isInWeek: this.showWeek() && date >= weekStart && date < weekEnd,
      hasItems: itemsOfDay(this.items(), date).length > 0,
    }));
  });

  protected shiftMonth(months: number): void {
    this.picked.emit(addMonths(this.date(), months));
  }
}

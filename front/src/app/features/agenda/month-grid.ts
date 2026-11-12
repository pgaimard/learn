import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AgendaItem, itemsOfDay, monthGrid } from './calendar';
import { AgendaEvent } from './event.service';
import { formatDay, isSameDay } from './week';

// Éléments montrés dans une case avant « +N autres ».
const SHOWN_PER_DAY = 3;
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// Vue Mois : six semaines, les éléments de chaque jour en pastilles.
@Component({
  selector: 'app-month-grid',
  imports: [RouterLink],
  templateUrl: './month-grid.html',
  styleUrl: './month-grid.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthGrid {
  // N'importe quel jour du mois affiché.
  readonly month = input.required<Date>();
  readonly items = input.required<AgendaItem[]>();
  readonly now = input.required<Date>();

  readonly eventPicked = output<AgendaEvent>();
  // Jour où créer un événement.
  readonly dayPicked = output<Date>();
  // Jour dont on veut tout voir : la page ouvre sa semaine.
  readonly dayOpened = output<Date>();

  protected readonly weekdays = WEEKDAYS;
  protected readonly days = computed(() =>
    monthGrid(this.month()).map((date) => {
      const items = itemsOfDay(this.items(), date);
      return {
        date,
        label: formatDay(date),
        isOutside: date.getMonth() !== this.month().getMonth(),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        isToday: isSameDay(date, this.now()),
        shown: items.slice(0, SHOWN_PER_DAY),
        hidden: Math.max(items.length - SHOWN_PER_DAY, 0),
      };
    }),
  );
}

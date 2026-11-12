import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

// Tracés des pictogrammes, sur une grille de 24 : un seul trait, couleur du texte.
const ICONS = {
  plus: 'M12 5v14M5 12h14',
  search: 'M4 11a7 7 0 1 0 14 0a7 7 0 1 0-14 0M20 20l-3.5-3.5',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  sun: 'M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  pencil: 'M4 20h4L19 9l-4-4L4 16v4z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  check: 'M5 12l5 5L20 7',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  'eye-off':
    'M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6C3.6 8.5 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  logout: 'M9 4H5v16h4M15 8l4 4-4 4M19 12H9',
  'chevron-down': 'M7 10l5 5 5-5',
  close: 'M6 6l12 12M18 6L6 18',
  warning: 'M12 4l9 16H3zM12 10v4M12 17v.5',
} as const;

export type IconName = keyof typeof ICONS;

// Pictogramme décoratif : le libellé est porté par le bouton ou le texte voisin.
@Component({
  selector: 'app-icon',
  template: `
    <svg
      aria-hidden="true"
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path [attr.d]="path()" />
    </svg>
  `,
  styles: ':host { display: inline-flex; flex: none; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(14);

  protected readonly path = computed(() => ICONS[this.name()]);
}

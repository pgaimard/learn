import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

// Tracés des pictogrammes, sur une grille de 24 : un seul trait, couleur du texte.
const ICONS = {
  plus: 'M12 5v14M5 12h14',
  search: 'M4 11a7 7 0 1 0 14 0a7 7 0 1 0-14 0M20 20l-3.5-3.5',
  pencil: 'M4 20h4L19 9l-4-4L4 16v4z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  check: 'M5 12l5 5L20 7',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  'eye-off':
    'M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6C3.6 8.5 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  logout: 'M9 4H5v16h4M15 8l4 4-4 4M19 12H9',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  'chevron-down': 'M7 10l5 5 5-5',
  'chevron-left': 'M14 7l-5 5 5 5',
  'chevron-right': 'M10 7l5 5-5 5',
  close: 'M6 6l12 12M18 6L6 18',
  warning: 'M12 4l9 16H3zM12 10v4M12 17v.5',
  grip: 'M8 6a1 1 0 1 0 2 0a1 1 0 1 0-2 0M14 6a1 1 0 1 0 2 0a1 1 0 1 0-2 0M8 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0M14 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0M8 18a1 1 0 1 0 2 0a1 1 0 1 0-2 0M14 18a1 1 0 1 0 2 0a1 1 0 1 0-2 0',
  upload: 'M12 16V5M7 10l5-5 5 5M5 19h14',
  folder: 'M3 6h6l2 2h10v11H3z',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  move: 'M4 12h14M13 7l5 5-5 5',
  code: 'M8 8l-4 4 4 4M16 8l4 4-4 4',
  link: 'M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1',
  'list-bullets':
    'M9 6h11M9 12h11M9 18h11M3.5 6a1 1 0 1 0 2 0a1 1 0 1 0-2 0M3.5 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0M3.5 18a1 1 0 1 0 2 0a1 1 0 1 0-2 0',
  'list-numbers': 'M10 6h10M10 12h10M10 18h10M4 4.5h1.2V8M3.8 16.5c1.6-1.2 2.6.6 0 2.5h2.4',
  quote: 'M5 6v12M10 8h9M10 12h9M10 16h6',
  'code-block': 'M4 5h16v14H4zM10 10l-2 2 2 2M14 10l2 2-2 2',
  table: 'M4 5h16v14H4zM4 10h16M10 5v14',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M14.3 9a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0',
  rule: 'M4 12h16',
  undo: 'M8 6L4 10l4 4M4 10h10a5 5 0 0 1 0 10h-3',
  redo: 'M16 6l4 4-4 4M20 10H10a5 5 0 0 0 0 10h3',
  dots: 'M4 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0M11 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0M18 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0',
  'arrow-up': 'M12 19V5M6 11l6-6 6 6',
  'arrow-left': 'M19 12H5M11 6l-6 6 6 6',
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  slides: 'M4 5h16v11H4zM9 20h6M12 16v4M10 8.5v4l3.5-2z',
  quiz: 'M4 5h4v4H4zM4 15h4v4H4zM11 7h9M11 17h9M5 16.8l1 1 1.6-2',
  'align-left': 'M4 6h16M4 10h10M4 14h16M4 18h10',
  'align-center': 'M4 6h16M7 10h10M4 14h16M7 18h10',
  'align-right': 'M4 6h16M10 10h10M4 14h16M10 18h10',
  'align-justify': 'M4 6h16M4 10h16M4 14h16M4 18h16',
  'valign-top': 'M4 5h16M12 19V9M8 13l4-4 4 4',
  'valign-middle': 'M4 12h16M12 3v5M9.5 5.5L12 8l2.5-2.5M12 21v-5M9.5 18.5L12 16l2.5 2.5',
  'valign-bottom': 'M4 19h16M12 5v10M8 11l4 4 4-4',
  'arrow-down': 'M12 5v14M6 13l6 6 6-6',
  pin: 'M9 4h6l-1 6 3 3H7l3-3-1-6zM12 13v7',
  book: 'M6 4h12v16H7a2 2 0 0 1 0-4h11M9 8h6',
  info: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18M12 11v6M12 7.5v.5',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3',
  copy: 'M9 9h11v11H9zM5 15V4h11',
  heading: 'M5 5v14M13 5v14M5 12h8M17 10l2-1v10',
  change: 'M4 8h14l-3-3M20 16H6l3 3',
  fold: 'M7 10l5 5 5-5M5 5h14',
  indent: 'M4 6h16M10 12h10M10 18h10M4 10l3 2-3 2',
  outdent: 'M4 6h16M10 12h10M10 18h10M7 10l-3 2 3 2',
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

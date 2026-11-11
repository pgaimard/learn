// Navigation au clavier commune aux menus de l'éditeur.

export function menuItems(menu: HTMLElement): HTMLButtonElement[] {
  return Array.from(menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
}

// Place le focus sur l'entrée suivante (1) ou précédente (-1), en bouclant.
export function focusMenuItem(menu: HTMLElement, step: -1 | 1): void {
  const items = menuItems(menu);
  const current = items.indexOf(document.activeElement as HTMLButtonElement);
  items[(current + step + items.length) % items.length]?.focus();
}

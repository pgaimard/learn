// Clavier d'Apple ou non : les raccourcis affichés suivent l'appareil.
const IS_APPLE = /Mac|iPhone|iPad/.test(navigator.platform);

// Libellé d'un raccourci Alt+Maj+touche : « ⌥⇧↑ » ou « Alt+Maj+↑ ».
export function altShiftShortcut(key: string): string {
  return IS_APPLE ? `⌥⇧${key}` : `Alt+Maj+${key}`;
}

// Libellé d'un raccourci avec la touche de commande de l'appareil : « ⌘S » ou « Ctrl S ».
export function shortcut(key: string): string {
  return IS_APPLE ? `⌘${key}` : `Ctrl ${key}`;
}

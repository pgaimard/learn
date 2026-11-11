const UNITS = ['octets', 'ko', 'Mo', 'Go'];
// Espace insécable : la valeur et son unité ne sont jamais séparées par un retour à la ligne.
const NON_BREAKING_SPACE = String.fromCharCode(0xa0);

// Taille lisible, à la française : « 512 octets », « 1,5 Mo ».
export function formatSize(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  const text = value.toFixed(digits).replace('.', ',').replace(/,0$/, '');
  return `${text}${NON_BREAKING_SPACE}${UNITS[unit]}`;
}

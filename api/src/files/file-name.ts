import { isEntryName } from './entry-name.js';

const MAX_LENGTH = 255;
const FALLBACK_NAME = 'fichier';

function splitExtension(name: string): [string, string] {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
}

// Nom à enregistrer pour un fichier reçu. Le nom fourni par le navigateur est traité
// comme hostile : on n'en garde que la dernière partie, sans caractère de contrôle.
export function cleanUploadName(received: string): string {
  const lastPart = received.split(/[/\\]/).pop() ?? '';
  const visible = Array.from(lastPart)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('')
    .trim();
  const [base, extension] = splitExtension(visible);
  const name = base.slice(0, MAX_LENGTH - extension.length) + extension;
  return isEntryName(name) ? name : FALLBACK_NAME;
}

// Premier nom libre : « rapport.pdf », puis « rapport - 2.pdf », « rapport - 3.pdf »…
// Les noms pris sont comparés sans tenir compte de la casse.
export function nextFreeName(name: string, takenNames: string[]): string {
  const taken = new Set(takenNames.map((taken) => taken.toLowerCase()));
  if (!taken.has(name.toLowerCase())) {
    return name;
  }
  const [base, extension] = splitExtension(name);
  for (let number = 2; ; number++) {
    const suffix = ` - ${number}${extension}`;
    const candidate = base.slice(0, MAX_LENGTH - suffix.length) + suffix;
    if (!taken.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
}

// En-tête Content-Disposition d'un téléchargement : un nom de repli en ASCII et le nom
// exact encodé selon la RFC 5987.
export function attachmentDisposition(name: string): string {
  const fallback = name.replace(/[^\x20-\x7e]|["\\]/g, '_');
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

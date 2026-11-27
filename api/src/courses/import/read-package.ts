import { BadRequestException } from '@nestjs/common';
import { Readable } from 'node:stream';
import yauzl, { Entry, ZipFile } from 'yauzl';
import { isEntryName } from '../../files/entry-name.js';
import { IMAGE_PATH } from './markdown-to-content.js';

export interface PackageFiles {
  markdown: string;
  images: Map<string, Buffer>;
  // Contenu de fiche.md, la fiche de révision ; null quand le paquet n'en a pas.
  sheet: string | null;
  // Contenu de exercices.md, les exercices du chapitre ; null quand le paquet n'en a pas.
  exercises: string | null;
  terms: string | null;
  // Contenu de commandes.json ; null quand le paquet n'en a pas.
  commands: string | null;
  // Documents du dossier sources/, par nom : ils sont rangés dans le dossier du cours.
  sources: Map<string, Buffer>;
}

export const MAX_PACKAGE_SIZE = 50 * 1024 * 1024;
const MAX_ENTRIES = 500;
// Un document source est directement dans sources/, sans sous-dossier.
const SOURCE_PATH = /^sources\/([^/]+)$/;
const IGNORED = /(^|\/)(__MACOSX\/|\.DS_Store$)|\/$/;

function invalid(message: string): BadRequestException {
  return new BadRequestException(message);
}

function open(zip: Buffer): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(zip, { lazyEntries: true }, (error, zipFile) => {
      if (error) {
        reject(invalid('Ce fichier n’est pas une archive .zip lisible.'));
      } else {
        resolve(zipFile);
      }
    });
  });
}

// Liste les entrées sans rien extraire. yauzl refuse de lui-même les chemins absolus
// ou contenant « .. ».
function listEntries(zipFile: ZipFile): Promise<Entry[]> {
  return new Promise((resolve, reject) => {
    const entries: Entry[] = [];
    zipFile.on('entry', (entry: Entry) => {
      entries.push(entry);
      if (entries.length > MAX_ENTRIES) {
        reject(invalid('Le paquet contient trop de fichiers.'));
      } else {
        zipFile.readEntry();
      }
    });
    zipFile.on('end', () => resolve(entries));
    zipFile.on('error', () =>
      reject(invalid('Ce fichier n’est pas une archive .zip lisible.')),
    );
    zipFile.readEntry();
  });
}

function extract(zipFile: ZipFile, entry: Entry): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream: Readable) => {
      if (error) {
        reject(
          invalid(`Impossible de lire « ${entry.fileName} » dans le paquet.`),
        );
        return;
      }
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', () =>
        reject(
          invalid(`Impossible de lire « ${entry.fileName} » dans le paquet.`),
        ),
      );
    });
  });
}

// Un paquet créé en compressant un dossier contient ce dossier en racine : on l'ignore.
function commonRoot(names: string[]): string {
  const nested = names.find((name) => /^[^/]+\/cours\.md$/.test(name));
  if (names.includes('cours.md') || !nested) {
    return '';
  }
  const root = nested.slice(0, nested.indexOf('/') + 1);
  return names.every((name) => name.startsWith(root)) ? root : '';
}

function checkSize(entries: Entry[]): void {
  const total = entries.reduce((sum, entry) => sum + entry.uncompressedSize, 0);
  if (total > MAX_PACKAGE_SIZE) {
    throw invalid('Le contenu du paquet dépasse 50 Mo une fois décompressé.');
  }
}

// Nom d'un document de sources/ : celui du fichier, refusé s'il ne peut pas être un nom
// de fichier de l'application.
function sourceName(path: string): string {
  const name = path.slice('sources/'.length).trim();
  if (!isEntryName(name)) {
    throw invalid(`Nom de document refusé dans le paquet : « ${path} ».`);
  }
  return name;
}

export async function readPackage(zip: Buffer): Promise<PackageFiles> {
  const zipFile = await open(zip);
  try {
    const entries = (await listEntries(zipFile)).filter(
      (entry) => !IGNORED.test(entry.fileName),
    );
    checkSize(entries);
    const root = commonRoot(entries.map((entry) => entry.fileName));
    const files: PackageFiles = {
      markdown: '',
      images: new Map(),
      sheet: null,
      exercises: null,
      terms: null,
      commands: null,
      sources: new Map(),
    };
    let hasMarkdown = false;
    for (const entry of entries) {
      const name = entry.fileName.slice(root.length);
      if (name === 'cours.md') {
        files.markdown = (await extract(zipFile, entry)).toString('utf8');
        hasMarkdown = true;
      } else if (name === 'fiche.md') {
        files.sheet = (await extract(zipFile, entry)).toString('utf8');
      } else if (name === 'exercices.md') {
        files.exercises = (await extract(zipFile, entry)).toString('utf8');
      } else if (name === 'termes.json') {
        files.terms = (await extract(zipFile, entry)).toString('utf8');
      } else if (name === 'commandes.json') {
        files.commands = (await extract(zipFile, entry)).toString('utf8');
      } else if (IMAGE_PATH.test(name)) {
        files.images.set(name, await extract(zipFile, entry));
      } else if (SOURCE_PATH.test(name)) {
        files.sources.set(sourceName(name), await extract(zipFile, entry));
      } else {
        throw invalid(`Fichier inattendu dans le paquet : « ${name} ».`);
      }
    }
    if (!hasMarkdown) {
      throw invalid('Le paquet ne contient pas de fichier cours.md.');
    }
    return files;
  } finally {
    zipFile.close();
  }
}

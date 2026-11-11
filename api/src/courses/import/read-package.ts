import { BadRequestException } from '@nestjs/common';
import { Readable } from 'node:stream';
import yauzl, { Entry, ZipFile } from 'yauzl';
import { IMAGE_PATH } from './markdown-to-content.js';

export interface PackageFiles {
  markdown: string;
  images: Map<string, Buffer>;
  terms: string | null;
}

export const MAX_PACKAGE_SIZE = 50 * 1024 * 1024;
const MAX_ENTRIES = 500;
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
      terms: null,
    };
    let hasMarkdown = false;
    for (const entry of entries) {
      const name = entry.fileName.slice(root.length);
      if (name === 'cours.md') {
        files.markdown = (await extract(zipFile, entry)).toString('utf8');
        hasMarkdown = true;
      } else if (name === 'termes.json') {
        files.terms = (await extract(zipFile, entry)).toString('utf8');
      } else if (IMAGE_PATH.test(name)) {
        files.images.set(name, await extract(zipFile, entry));
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

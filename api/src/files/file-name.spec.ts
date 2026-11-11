import {
  attachmentDisposition,
  cleanUploadName,
  nextFreeName,
} from './file-name.js';

describe('cleanUploadName', () => {
  it('garde un nom ordinaire, accents compris', () => {
    expect(cleanUploadName(' Corrigé TD3.pdf ')).toBe('Corrigé TD3.pdf');
  });

  it.each([
    ['../../etc/passwd', 'passwd'],
    ['C:\\Users\\pierre\\notes.txt', 'notes.txt'],
    ['a\u0000b\n.pdf', 'ab.pdf'],
  ])('ne garde de « %s » que « %s »', (received, expected) => {
    expect(cleanUploadName(received)).toBe(expected);
  });

  it.each(['', '   ', '..', 'dossier/'])(
    'donne un nom par défaut à « %s »',
    (received) => {
      expect(cleanUploadName(received)).toBe('fichier');
    },
  );

  it('raccourcit un nom trop long en gardant l’extension', () => {
    const name = cleanUploadName(`${'a'.repeat(300)}.pdf`);

    expect(name).toHaveLength(255);
    expect(name.endsWith('.pdf')).toBe(true);
  });
});

describe('nextFreeName', () => {
  it('garde un nom libre', () => {
    expect(nextFreeName('rapport.pdf', ['notes.pdf'])).toBe('rapport.pdf');
  });

  it('numérote avant l’extension à partir de 2', () => {
    expect(nextFreeName('rapport.pdf', ['rapport.pdf'])).toBe(
      'rapport - 2.pdf',
    );
    expect(
      nextFreeName('rapport.pdf', ['rapport.pdf', 'rapport - 2.pdf']),
    ).toBe('rapport - 3.pdf');
  });

  it('prend le premier numéro libre', () => {
    expect(
      nextFreeName('rapport.pdf', ['rapport.pdf', 'rapport - 3.pdf']),
    ).toBe('rapport - 2.pdf');
  });

  it('compare sans tenir compte de la casse', () => {
    expect(
      nextFreeName('Rapport.PDF', ['rapport.pdf', 'RAPPORT - 2.pdf']),
    ).toBe('Rapport - 3.PDF');
  });

  it('gère les noms sans extension et les fichiers cachés', () => {
    expect(nextFreeName('Makefile', ['Makefile'])).toBe('Makefile - 2');
    expect(nextFreeName('.env', ['.env'])).toBe('.env - 2');
    expect(nextFreeName('archive.tar.gz', ['archive.tar.gz'])).toBe(
      'archive.tar - 2.gz',
    );
  });

  it('reste dans la longueur maximale', () => {
    const name = `${'a'.repeat(251)}.pdf`;

    const free = nextFreeName(name, [name]);

    expect(free).toHaveLength(255);
    expect(free.endsWith(' - 2.pdf')).toBe(true);
  });
});

describe('attachmentDisposition', () => {
  it('donne un nom de repli en ASCII et le nom exact encodé', () => {
    expect(attachmentDisposition('Corrigé "TD3".pdf')).toBe(
      'attachment; filename="Corrig_ _TD3_.pdf"; filename*=UTF-8\'\'Corrig%C3%A9%20%22TD3%22.pdf',
    );
  });

  it('encode ce qui pourrait fermer l’en-tête', () => {
    const header = attachmentDisposition("a'(b)*.txt");

    expect(header).toContain("filename*=UTF-8''a%27%28b%29%2A.txt");
  });
});

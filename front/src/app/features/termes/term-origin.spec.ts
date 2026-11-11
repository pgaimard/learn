import { originFromUrl } from './term-origin';

describe('originFromUrl', () => {
  it('reconnaît la page d’une UE, onglet compris', () => {
    expect(originFromUrl('/ue/utc502?onglet=termes')).toEqual({
      ueCode: 'UTC502',
      label: 'l’UE UTC502',
    });
  });

  it('reconnaît un cours, en lecture comme en édition', () => {
    const origin = { ueCode: 'UTC502', courseId: 12, label: 'ce cours (UTC502)' };

    expect(originFromUrl('/ue/UTC502/cours/12')).toEqual(origin);
    expect(originFromUrl('/ue/UTC502/cours/12/edition')).toEqual(origin);
  });

  it.each(['/', '/dictionnaire/3', '/import'])('ne propose rien sur %s', (url) => {
    expect(originFromUrl(url)).toBeNull();
  });
});

import { sanitizeSvg } from './sanitize-svg.js';

describe('sanitizeSvg', () => {
  it('conserve un schéma inoffensif', () => {
    const clean = sanitizeSvg(
      '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">' +
        '<rect x="1" y="1" width="8" height="8" fill="#1d4ed8"/><text x="2" y="6">État</text></svg>',
    );

    expect(clean).toContain('<rect');
    expect(clean).toContain('viewBox="0 0 10 10"');
    expect(clean).toContain('État');
    expect(clean).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it.each([
    [
      'une balise script',
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect/></svg>',
    ],
    [
      'un gestionnaire d’événement',
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect onclick="alert(2)"/></svg>',
    ],
    [
      'un lien javascript',
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect/></a></svg>',
    ],
    [
      'un contenu HTML embarqué',
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><iframe src="https://evil.example"></iframe></foreignObject></svg>',
    ],
  ])('neutralise %s', (_label, svg) => {
    const clean = sanitizeSvg(svg) ?? '';

    expect(clean).toMatch(/^<svg/);
    expect(clean).not.toMatch(
      /script|onload|onclick|javascript:|iframe|foreignObject/i,
    );
  });

  it('ajoute l’espace de noms manquant', () => {
    expect(sanitizeSvg('<svg viewBox="0 0 1 1"><rect/></svg>')).toContain(
      'xmlns="http://www.w3.org/2000/svg"',
    );
  });

  it('renvoie null quand il ne reste pas de SVG', () => {
    expect(sanitizeSvg('<script>alert(1)</script>')).toBeNull();
  });
});

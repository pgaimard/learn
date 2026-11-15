import { CommandToken, highlightCommand } from './highlight-command';

// Morceaux utiles au test : sans les espaces.
function parts(tokens: CommandToken[]): string[] {
  return tokens
    .filter((token) => token.text.trim() !== '')
    .map((token) => `${token.kind}:${token.text}`);
}

describe('highlightCommand', () => {
  it('distingue le nom, les options, les valeurs à fournir et les arguments', () => {
    expect(parts(highlightCommand('ping [-c <nombre>] --ttl=64 <hôte> 8.8.8.8'))).toEqual([
      'name:ping',
      'punctuation:[',
      'option:-c',
      'placeholder:<nombre>',
      'punctuation:]',
      'option:--ttl=64',
      'placeholder:<hôte>',
      'text:8.8.8.8',
    ]);
  });

  it('ne perd aucun caractère de la ligne', () => {
    const line = 'grep -r  "deux mots" ./src | wc -l > total.txt';

    expect(
      highlightCommand(line)
        .map((token) => token.text)
        .join(''),
    ).toBe(line);
  });

  it('colore comme un nom la commande qui suit un enchaînement', () => {
    expect(parts(highlightCommand("cat notes.txt | grep 'a b' && echo fini"))).toEqual([
      'name:cat',
      'text:notes.txt',
      'punctuation:|',
      'name:grep',
      "string:'a b'",
      'punctuation:&&',
      'name:echo',
      'text:fini',
    ]);
  });

  it('prend une barre entre crochets pour un choix, pas pour un enchaînement', () => {
    expect(parts(highlightCommand('switchport mode {access | trunk}'))).toEqual([
      'name:switchport',
      'text:mode',
      'punctuation:{',
      'text:access',
      'punctuation:|',
      'text:trunk',
      'punctuation:}',
    ]);
  });

  it('colore en entier un nom en plusieurs mots', () => {
    expect(parts(highlightCommand('Show IP route <réseau>', { name: 'show ip route' }))).toEqual([
      'name:Show IP route',
      'placeholder:<réseau>',
    ]);
    expect(parts(highlightCommand('show ipv6 route', { name: 'show ip' }))[0]).toBe('name:show');
  });

  it('ne cherche pas de nom dans un morceau de commande', () => {
    expect(parts(highlightCommand('-c <nombre>', { isFragment: true }))).toEqual([
      'option:-c',
      'placeholder:<nombre>',
    ]);
    expect(parts(highlightCommand('brief', { isFragment: true }))).toEqual(['text:brief']);
  });

  it('laisse tel quel un tiret seul et un guillemet non fermé', () => {
    expect(parts(highlightCommand('cd - "ouvert'))).toEqual(['name:cd', 'text:-', 'text:"ouvert']);
  });
});

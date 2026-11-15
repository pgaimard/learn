import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCommands } from './parse-commands.js';

const EXAMPLE = readFileSync(
  join(import.meta.dirname, '../../../../contracts/commandes.example.json'),
  'utf8',
);

function errorsOf(tools: unknown): string[] {
  return parseCommands(JSON.stringify(tools)).errors;
}

describe('parseCommands', () => {
  it('ne trouve rien dans un paquet sans commandes.json', () => {
    expect(parseCommands(null)).toEqual({ tools: [], errors: [] });
  });

  it('lit l’exemple du contrat', () => {
    const { tools, errors } = parseCommands(EXAMPLE);

    expect(errors).toEqual([]);
    expect(tools.map((tool) => tool.name)).toEqual(['Cisco IOS', 'Shell Unix']);
    const [ios, shell] = tools;
    expect(ios.summary).toBe('Terminal des routeurs et commutateurs Cisco.');
    expect(ios.content.content?.[0]).toMatchObject({ type: 'heading' });
    expect(ios.modes[1]).toEqual({
      name: 'Privilégié',
      prompt: 'Router#',
      entry: 'enable',
    });
    expect(ios.variants).toEqual(['IOS', 'IOS-XE']);
    expect(ios.commands[0]).toMatchObject({
      name: 'ping',
      mode: 'Privilégié',
      themes: ['réseau', 'diagnostic'],
      variants: [],
    });
    expect(ios.commands[0].options[1].variants).toEqual(['IOS-XE']);
    expect(ios.commands[0].examples[0].output).toContain('!!!!!');
    expect(shell.commands[1]).toMatchObject({
      name: 'setopt',
      mode: null,
      variants: ['zsh'],
      options: [],
      examples: [],
    });
  });

  it('refuse ce qui n’est pas une liste au format JSON', () => {
    expect(parseCommands('{').errors).toHaveLength(1);
    expect(parseCommands('{"outil": "git"}').errors[0]).toContain(
      'doit contenir une liste',
    );
  });

  it('dit où se trouve chaque erreur', () => {
    const errors = errorsOf([
      {
        outil: 'git',
        couleur: 'rouge',
        commandes: [
          { description: 'Sans nom.' },
          { nom: 'commit', options: [{ description: 'Sans texte.' }] },
          { nom: 'log', exemples: [{ ligne: ' ' }] },
        ],
      },
    ]);

    expect(errors).toEqual([
      'commandes.json, outil 1 : clé « couleur » non reconnue.',
      'commandes.json, outil 1, commande 1 : « nom » est requis.',
      'commandes.json, outil 1, commande 2, option 1 : « texte » est requis.',
      'commandes.json, outil 1, commande 3, exemple 1 : « ligne » est requis.',
    ]);
  });

  it('refuse un mode ou une déclinaison que l’outil ne déclare pas', () => {
    const errors = errorsOf([
      {
        outil: 'Shell Unix',
        declinaisons: ['bash'],
        commandes: [
          {
            nom: 'setopt',
            mode: 'Privilégié',
            declinaisons: ['zsh'],
            options: [{ texte: '-o', declinaisons: ['fish'] }],
          },
        ],
      },
    ]);

    expect(errors).toEqual([
      'commandes.json, outil 1, commande 1 : le mode « Privilégié » n’est pas déclaré dans l’outil.',
      'commandes.json, outil 1, commande 1 : la déclinaison « zsh » n’est pas déclarée dans l’outil.',
      'commandes.json, outil 1, commande 1, option 1 : la déclinaison « fish » n’est pas déclarée dans l’outil.',
    ]);
  });

  it('refuse les doublons, sans tenir compte de la casse', () => {
    const errors = errorsOf([
      { outil: 'git', commandes: [{ nom: 'log' }, { nom: 'LOG' }] },
      { outil: 'Git' },
    ]);

    expect(errors).toEqual([
      'commandes.json, outil 1, commande 2 : « LOG » figure deux fois dans l’outil.',
      'commandes.json, outil 2 : l’outil « Git » figure deux fois.',
    ]);
  });

  it('refuse une image et un texte trop long dans la fiche d’un outil', () => {
    const image = errorsOf([
      { outil: 'git', fonctionnement: '![Schéma](images/fig-01.svg)' },
    ]);
    const long = errorsOf([{ outil: 'git', presentation: 'x'.repeat(301) }]);

    expect(image.join(' ')).toContain('ne peut pas encore contenir d’image');
    expect(long).toEqual([
      'commandes.json, outil 1 : « presentation » doit être un texte de 300 caractères au plus.',
    ]);
  });

  it('garde l’indentation de la sortie d’un exemple', () => {
    const { tools } = parseCommands(
      JSON.stringify([
        {
          outil: 'git',
          commandes: [
            {
              nom: 'log',
              exemples: [{ ligne: 'git log', sortie: '  a1b2\n' }],
            },
          ],
        },
      ]),
    );

    expect(tools[0].commands[0].examples[0].output).toBe('  a1b2');
  });
});

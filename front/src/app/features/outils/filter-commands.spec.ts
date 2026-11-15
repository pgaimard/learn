import { Command } from './command.service';
import { CommandFilter, filterCommands, listThemes } from './filter-commands';

function command(id: number, name: string, changes: Partial<Command> = {}): Command {
  return {
    id,
    name,
    summary: '',
    syntax: '',
    modeId: null,
    variantIds: [],
    notes: '',
    themes: [],
    options: [],
    examples: [],
    alsoIn: [],
    ...changes,
  };
}

const COMMANDS = [
  command(1, 'ping', { summary: 'Teste si une machine répond.', themes: ['réseau'] }),
  command(2, 'setopt', { variantIds: [22], themes: ['configuration'] }),
  command(3, 'shopt', { variantIds: [21], themes: ['configuration'] }),
  command(4, 'show ip route', { modeId: 12, themes: ['réseau', 'routage'] }),
];

const ALL: CommandFilter = { query: '', theme: '', modeId: null, variantId: null };

function names(filter: Partial<CommandFilter>): string[] {
  return filterCommands(COMMANDS, { ...ALL, ...filter }).map(({ name }) => name);
}

describe('filterCommands', () => {
  it('garde tout sans critère', () => {
    expect(names({})).toHaveLength(4);
  });

  it('cherche dans le nom et la description, sans casse ni accent', () => {
    expect(names({ query: ' SHO ' })).toEqual(['shopt', 'show ip route']);
    expect(names({ query: 'repond' })).toEqual(['ping']);
  });

  it('filtre par thème et par mode', () => {
    expect(names({ theme: 'réseau' })).toEqual(['ping', 'show ip route']);
    expect(names({ modeId: 12 })).toEqual(['show ip route']);
  });

  it('garde pour une déclinaison ses commandes et celles qui valent pour toutes', () => {
    expect(names({ variantId: 22 })).toEqual(['ping', 'setopt', 'show ip route']);
  });

  it('cumule les critères', () => {
    expect(names({ theme: 'configuration', variantId: 21 })).toEqual(['shopt']);
  });
});

describe('listThemes', () => {
  it('liste chaque thème une fois, par ordre alphabétique', () => {
    expect(listThemes(COMMANDS)).toEqual(['configuration', 'réseau', 'routage']);
  });
});

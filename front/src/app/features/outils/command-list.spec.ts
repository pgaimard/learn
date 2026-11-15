import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CommandList } from './command-list';
import { Command } from './command.service';
import { Tool } from './tool.service';

const TOOL: Tool = {
  id: 3,
  name: 'Cisco IOS',
  summary: '',
  content: { type: 'doc', content: [] },
  modes: [{ id: 12, name: 'Privilégié', prompt: 'Router#', entry: 'enable' }],
  variants: [
    { id: 21, name: 'IOS' },
    { id: 22, name: 'IOS-XE' },
  ],
  ues: [],
};

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
    ueCodes: [],
    courses: [],
    options: [],
    examples: [],
    alsoIn: [],
    ...changes,
  };
}

const PING = command(1, 'ping', {
  summary: 'Teste si une machine répond.',
  syntax: 'ping <adresse>',
  modeId: 12,
  themes: ['réseau'],
  options: [{ id: 5, text: 'source <interface>', description: 'Départ.', variantIds: [22] }],
  examples: [{ id: 7, line: 'ping 10.0.0.1', explanation: 'Vers la passerelle.', output: '!!!!!' }],
  alsoIn: [{ commandId: 40, toolId: 9, toolName: 'Shell Unix' }],
});
const COMMANDS = [PING, command(2, 'switchport mode', { variantIds: [21], themes: ['VLAN'] })];

describe('CommandList', () => {
  let fixture: ComponentFixture<CommandList>;

  function setup(commands: Command[], openId: number | null = null): void {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(CommandList);
    fixture.componentRef.setInput('tool', TOOL);
    fixture.componentRef.setInput('commands', commands);
    fixture.componentRef.setInput('openId', openId);
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function names(): string[] {
    return Array.from(element().querySelectorAll('.row .name')).map(
      (name) => name.textContent ?? '',
    );
  }

  function button(label: string): HTMLButtonElement | undefined {
    return Array.from(element().querySelectorAll('button')).find(
      (candidate) => (candidate.textContent ?? '').trim() === label,
    );
  }

  it('liste les commandes avec leur mode et leurs déclinaisons', () => {
    setup(COMMANDS);

    expect(names()).toEqual(['ping', 'switchport mode']);
    const marks = Array.from(element().querySelectorAll('.marks')).map((mark) =>
      (mark.textContent ?? '').trim(),
    );
    expect(marks).toEqual(['Privilégié', 'IOS']);
    expect(element().querySelector('app-command-sheet')).toBeNull();
  });

  it('filtre par la recherche, par thème et par déclinaison', () => {
    setup(COMMANDS);
    const search = element().querySelector<HTMLInputElement>('input[type="search"]');

    search!.value = 'repond';
    search!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(names()).toEqual(['ping']);

    search!.value = '';
    search!.dispatchEvent(new Event('input'));
    button('VLAN')?.click();
    fixture.detectChanges();
    expect(names()).toEqual(['switchport mode']);
    expect(button('VLAN')?.getAttribute('aria-pressed')).toBe('true');

    button('IOS-XE')?.click();
    fixture.detectChanges();
    expect(names()).toEqual([]);
    expect(element().textContent).toContain('Aucune commande ne correspond.');
  });

  it('déplie la fiche de la commande choisie : syntaxe colorée, options, exemples, renvois', () => {
    setup(COMMANDS);

    element().querySelector<HTMLButtonElement>('.row')?.click();
    fixture.detectChanges();

    const sheet = element().querySelector('app-command-sheet');
    expect(sheet?.querySelector('.syntax .token-name')?.textContent).toBe('ping');
    expect(sheet?.querySelector('.syntax .token-placeholder')?.textContent).toBe('<adresse>');
    expect(sheet?.querySelector('.option .variant')?.textContent).toBe('IOS-XE');
    expect(sheet?.querySelector('.line .prompt')?.textContent).toBe('Router#');
    expect(sheet?.querySelector('.output')?.textContent).toBe('!!!!!');
    expect(sheet?.querySelector('.also a')?.getAttribute('href')).toBe(
      '/outils/9?volet=commandes&commande=40',
    );
  });

  it('montre dépliée la commande demandée à l’arrivée, et la replie au clic', () => {
    setup(COMMANDS, 1);

    expect(element().querySelector('li.is-open .name')?.textContent).toBe('ping');

    element().querySelector<HTMLButtonElement>('.row')?.click();
    fixture.detectChanges();
    expect(element().querySelector('app-command-sheet')).toBeNull();
  });

  it('copie la ligne d’un exemple', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    setup(COMMANDS, 1);

    element().querySelector<HTMLButtonElement>('.copy')?.click();
    await fixture.whenStable();

    expect(writeText).toHaveBeenCalledWith('ping 10.0.0.1');
    vi.unstubAllGlobals();
  });

  it('transmet la demande de suppression', () => {
    setup(COMMANDS, 1);
    const removed = vi.fn<(command: Command) => void>();
    fixture.componentInstance.removed.subscribe(removed);

    element().querySelector<HTMLButtonElement>('button[aria-label="Supprimer ping"]')?.click();

    expect(removed).toHaveBeenCalledWith(PING);
  });

  it('invite à saisir la première commande', () => {
    setup([]);

    expect(element().textContent).toContain('Aucune commande pour l’instant.');
    expect(element().querySelector('a.add')?.getAttribute('href')).toBe(
      '/outils/3/commandes/nouvelle',
    );
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DialogService } from '../../core/dialog/dialog.service';
import { Command, CommandService } from './command.service';
import { ToolReadPage } from './tool-read-page';
import { Tool, ToolService } from './tool.service';

const TOOL: Tool = {
  id: 3,
  name: 'Cisco IOS',
  summary: 'Terminal des routeurs.',
  content: { type: 'doc', content: [{ type: 'paragraph' }] },
  modes: [{ id: 12, name: 'Privilégié', prompt: 'Router#', entry: 'enable' }],
  variants: [],
  ues: [],
};

const PING: Command = {
  id: 8,
  name: 'ping',
  summary: '',
  syntax: 'ping <adresse>',
  modeId: null,
  variantIds: [],
  notes: '',
  themes: [],
  ueCodes: [],
  courses: [],
  options: [],
  examples: [],
  alsoIn: [],
};

describe('ToolReadPage', () => {
  let fixture: ComponentFixture<ToolReadPage>;
  const commands = {
    list: vi.fn<CommandService['list']>(),
    remove: vi.fn<CommandService['remove']>(),
  };
  const confirmDeletion = vi.fn<DialogService['confirmDeletion']>();

  async function setup(volet?: string, commande?: string): Promise<void> {
    commands.list.mockReset().mockReturnValue(of([PING]));
    commands.remove.mockReset().mockReturnValue(of(undefined));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: DialogService, useValue: { confirmDeletion } },
        { provide: ToolService, useValue: { get: () => of(TOOL) } },
        { provide: CommandService, useValue: commands },
      ],
    });
    fixture = TestBed.createComponent(ToolReadPage);
    fixture.componentRef.setInput('id', '3');
    fixture.componentRef.setInput('volet', volet);
    fixture.componentRef.setInput('commande', commande);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('montre d’abord le fonctionnement, et le nombre de commandes dans l’onglet', async () => {
    await setup();

    expect(element().querySelector('.tabs [aria-current="page"]')?.textContent).toContain(
      'Fonctionnement',
    );
    expect(element().querySelector('.tabs a:last-child')?.textContent).toContain('1');
    expect(element().querySelector('.modes')).not.toBeNull();
    expect(element().querySelector('app-command-list')).toBeNull();
  });

  it('montre les commandes sur ?volet=commandes, et déplie celle de ?commande=n', async () => {
    await setup('commandes', '8');

    expect(element().querySelector('.modes')).toBeNull();
    expect(element().querySelector('li.is-open .name')?.textContent).toBe('ping');
  });

  it('supprime une commande après confirmation, puis recharge la liste', async () => {
    await setup('commandes', '8');
    confirmDeletion.mockReset().mockResolvedValue(true);
    commands.list.mockReturnValue(of([]));

    element().querySelector<HTMLButtonElement>('button[aria-label="Supprimer ping"]')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(commands.remove).toHaveBeenCalledWith(3, 8);
    expect(element().textContent).toContain('Aucune commande pour l’instant.');
  });
});

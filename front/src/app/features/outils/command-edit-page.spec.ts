import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CourseService } from '../cours/course.service';
import { UeService } from '../ue/ue.service';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { CommandEditPage } from './command-edit-page';
import { Command, CommandService } from './command.service';
import { Tool, ToolService } from './tool.service';

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

const PING: Command = {
  id: 8,
  name: 'ping',
  summary: 'Teste si une machine répond.',
  syntax: 'ping <adresse>',
  modeId: 12,
  variantIds: [21],
  notes: 'Ctrl+Maj+6 pour arrêter.',
  themes: ['réseau', 'diagnostic'],
  ueCodes: ['UTC505'],
  courses: [{ id: 7, title: 'Processus', ueCode: 'UTC502' }],
  options: [
    { id: 5, text: 'repeat <nombre>', description: 'Nombre de paquets.', variantIds: [] },
    { id: 6, text: 'source <interface>', description: '', variantIds: [22] },
  ],
  examples: [{ id: 7, line: 'ping 10.0.0.1', explanation: 'Passerelle.', output: '!!!!!' }],
  alsoIn: [],
};

describe('CommandEditPage', () => {
  let fixture: ComponentFixture<CommandEditPage>;
  let navigate: ReturnType<typeof vi.spyOn>;
  const service = {
    list: vi.fn<CommandService['list']>(),
    create: vi.fn<CommandService['create']>(),
    update: vi.fn<CommandService['update']>(),
  };
  const confirm = vi.fn<DialogService['confirm']>();

  async function setup(commandId?: string): Promise<void> {
    service.list.mockReset().mockReturnValue(of([PING]));
    service.create.mockReset().mockReturnValue(of({ ...PING, id: 9 }));
    service.update.mockReset().mockReturnValue(of(PING));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: DialogService, useValue: { confirm } },
        { provide: ToolService, useValue: { get: () => of(TOOL) } },
        { provide: CommandService, useValue: service },
        {
          provide: UeService,
          useValue: {
            list: () =>
              of([
                { id: 1, code: 'UTC502', title: 'Systèmes', description: '', position: 1 },
                { id: 2, code: 'UTC505', title: 'Réseaux', description: '', position: 2 },
              ]),
          },
        },
        {
          provide: CourseService,
          useValue: {
            list: (code: string) =>
              of(
                code === 'UTC502'
                  ? [{ id: 7, title: 'Processus', position: 1, updatedAt: '', sectionCount: 0 }]
                  : [],
              ),
          },
        },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(CommandEditPage);
    fixture.componentRef.setInput('id', '3');
    fixture.componentRef.setInput('commandId', commandId);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function type(selector: string, value: string): void {
    const field = element().querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
    field!.value = value;
    field!.dispatchEvent(new Event('input'));
  }

  function button(label: string): HTMLButtonElement | undefined {
    return Array.from(element().querySelectorAll('button')).find(
      (candidate) =>
        (candidate.textContent ?? '').trim().startsWith(label) ||
        candidate.getAttribute('aria-label') === label,
    );
  }

  function submit(): void {
    element().querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('crée une commande avec ses thèmes, une option et un exemple, puis la montre', async () => {
    await setup();

    type('#command-name', ' show vlan ');
    type('#command-syntax', 'show vlan [brief]');
    type('#command-themes', 'VLAN,  diagnostic ,');
    const places = element().querySelectorAll<HTMLInputElement>('.ue-choice input');
    // Cases dans l'ordre : UTC502, son cours « Processus », UTC505.
    places[1].click();
    places[2].click();
    button('Ajouter une option')?.click();
    fixture.detectChanges();
    type('.option input', 'brief');
    element().querySelectorAll<HTMLInputElement>('.option input[type="checkbox"]')[1].click();
    button('Ajouter un exemple')?.click();
    fixture.detectChanges();
    type('.example input', 'show vlan brief');
    type('.example textarea', '  1 default\n');
    fixture.detectChanges();
    submit();

    expect(service.create).toHaveBeenCalledWith(3, {
      name: 'show vlan',
      summary: '',
      syntax: 'show vlan [brief]',
      modeId: null,
      variantIds: [],
      notes: '',
      themes: ['VLAN', 'diagnostic'],
      ueCodes: ['UTC505'],
      courseIds: [7],
      options: [{ text: 'brief', description: '', variantIds: [22] }],
      examples: [{ line: 'show vlan brief', explanation: '', output: '  1 default' }],
    });
    expect(navigate).toHaveBeenCalledWith(['/outils', 3], {
      queryParams: { volet: 'commandes', commande: 9 },
    });
  });

  it('colore la syntaxe au fil de la frappe', async () => {
    await setup();

    type('#command-name', 'show vlan');
    type('#command-syntax', 'show vlan [brief]');
    fixture.detectChanges();

    expect(element().querySelector('.preview .token-name')?.textContent).toBe('show vlan');
  });

  it('reprend une commande existante et enregistre ses changements', async () => {
    await setup('8');

    expect(element().querySelector('h1')?.textContent).toBe('Modifier la commande');
    expect(element().querySelector<HTMLInputElement>('#command-themes')?.value).toBe(
      'réseau, diagnostic',
    );
    expect(element().querySelectorAll('.option')).toHaveLength(2);
    expect(fixture.componentInstance.canLeave()).toBe(true);

    button('Descendre l’option 1')?.click();
    button('Retirer l’exemple 1')?.click();
    fixture.detectChanges();
    submit();

    const [toolId, id, input] = service.update.mock.calls[0];
    expect([toolId, id]).toEqual([3, 8]);
    expect(input).toMatchObject({
      modeId: 12,
      variantIds: [21],
      ueCodes: ['UTC505'],
      courseIds: [7],
      examples: [],
    });
    expect(input.options.map((option) => option.text)).toEqual([
      'source <interface>',
      'repeat <nombre>',
    ]);
  });

  it('n’enregistre pas sans nom, ni avec une option vide', async () => {
    await setup();

    submit();
    expect(element().querySelector('#command-name-error')).not.toBeNull();

    type('#command-name', 'ping');
    button('Ajouter une option')?.click();
    fixture.detectChanges();
    submit();

    expect(service.create).not.toHaveBeenCalled();
  });

  it('affiche le refus de l’API et garde la saisie', async () => {
    await setup();
    service.create.mockReturnValue(
      throwError(() => new ApiError(409, ['La commande « ping » existe déjà dans cet outil.'])),
    );

    type('#command-name', 'ping');
    submit();

    expect(element().querySelector('.form-error')?.textContent).toContain('existe déjà');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('demande confirmation avant de quitter une saisie en cours', async () => {
    await setup();
    confirm.mockReset().mockResolvedValue(false);

    button('Ajouter une option')?.click();

    await expect(fixture.componentInstance.canLeave()).resolves.toBe(false);
  });

  it('signale une commande inconnue', async () => {
    await setup('99');

    expect(element().querySelector('.form-error')?.textContent).toContain(
      'Cette commande n’existe pas.',
    );
    expect(element().querySelector('form')).toBeNull();
  });
});

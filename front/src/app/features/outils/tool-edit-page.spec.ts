import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DialogService } from '../../core/dialog/dialog.service';
import { UeService } from '../ue/ue.service';
import { ToolEditPage } from './tool-edit-page';
import { Tool, ToolService } from './tool.service';

const CONTENT = {
  type: 'doc',
  content: [
    { type: 'paragraph', attrs: { pinned: false }, content: [{ type: 'text', text: 'Fiche.' }] },
  ],
};

const TOOL: Tool = {
  id: 3,
  name: 'Cisco IOS',
  summary: 'Terminal des routeurs.',
  content: CONTENT,
  modes: [
    { id: 11, name: 'Utilisateur', prompt: 'Router>', entry: '' },
    { id: 12, name: 'Privilégié', prompt: 'Router#', entry: 'enable' },
  ],
  variants: [{ id: 21, name: 'IOS' }],
  ues: [{ code: 'UTC505', title: 'Réseaux' }],
};

describe('ToolEditPage', () => {
  let fixture: ComponentFixture<ToolEditPage>;
  const service = {
    get: vi.fn<ToolService['get']>(),
    update: vi.fn<ToolService['update']>(),
    remove: vi.fn<ToolService['remove']>(),
  };

  beforeEach(async () => {
    service.get.mockReset().mockReturnValue(of(TOOL));
    service.update.mockReset().mockImplementation(() => of(TOOL));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: DialogService, useValue: { confirm: vi.fn(), confirmDeletion: vi.fn() } },
        { provide: ToolService, useValue: service },
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
      ],
    });
    fixture = TestBed.createComponent(ToolEditPage);
    fixture.componentRef.setInput('id', '3');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function click(label: string): void {
    const buttons = Array.from(element().querySelectorAll('button'));
    const button = buttons.find(
      (candidate) =>
        (candidate.textContent ?? '').trim().startsWith(label) ||
        candidate.getAttribute('aria-label') === label,
    );
    button?.click();
    fixture.detectChanges();
  }

  function type(label: string, value: string): void {
    const field = element().querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
    if (field) {
      field.value = value;
      field.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
  }

  it('affiche l’outil avec ses modes, ses déclinaisons et ses UE', () => {
    const value = (selector: string): string | undefined =>
      element().querySelector<HTMLInputElement>(selector)?.value;

    expect(value('#tool-name')).toBe('Cisco IOS');
    expect(value('input[aria-label="Invite du mode 2"]')).toBe('Router#');
    expect(value('input[aria-label="Nom de la déclinaison 1"]')).toBe('IOS');
    const checked = Array.from(
      element().querySelectorAll<HTMLInputElement>('.choice input:checked'),
    ).map((box) => box.parentElement?.textContent.trim());
    expect(checked).toEqual(['UTC505']);
  });

  it('enregistre l’ordre des modes, les ajouts et les retraits en gardant les numéros', () => {
    click('Monter le mode 2');
    click('Ajouter un mode');
    type('Nom du mode 3', ' Configuration ');
    type('Invite du mode 3', 'Router(config)#');
    click('Retirer la déclinaison 1');
    click('Ajouter');
    type('Nom de la déclinaison 1', 'IOS-XE');
    element().querySelector<HTMLInputElement>('.choice input:not(:checked)')?.click();
    fixture.detectChanges();

    click('Enregistrer');

    expect(service.update).toHaveBeenCalledWith(3, {
      name: 'Cisco IOS',
      summary: 'Terminal des routeurs.',
      content: CONTENT,
      ueCodes: ['UTC505', 'UTC502'],
      variants: [{ name: 'IOS-XE' }],
      modes: [
        { id: 12, name: 'Privilégié', prompt: 'Router#', entry: 'enable' },
        { id: 11, name: 'Utilisateur', prompt: 'Router>', entry: '' },
        { name: 'Configuration', prompt: 'Router(config)#', entry: '' },
      ],
    });
  });

  it('n’enregistre pas un mode sans nom', () => {
    click('Ajouter un mode');

    click('Enregistrer');

    expect(service.update).not.toHaveBeenCalled();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { DialogService } from '../../core/dialog/dialog.service';
import { CommandImportPreview, CommandImportService } from './command-import.service';
import { ToolListPage } from './tool-list-page';
import { Tool, ToolService } from './tool.service';

describe('ToolListPage', () => {
  let fixture: ComponentFixture<ToolListPage>;
  const prompt = vi.fn<DialogService['prompt']>();
  const create = vi.fn<ToolService['create']>();
  const list = vi.fn<ToolService['list']>();
  const importService = {
    preview: vi.fn<CommandImportService['preview']>(),
    import: vi.fn<CommandImportService['import']>(),
  };
  const FOUND: CommandImportPreview = {
    newTools: ['git'],
    existingTools: ['bash'],
    newCommands: [{ tool: 'git', name: 'log' }],
    duplicateCommands: [{ tool: 'bash', name: 'ls' }],
  };

  beforeEach(() => {
    prompt.mockReset();
    create.mockReset().mockReturnValue(of({ id: 8 } as Tool));
    list
      .mockReset()
      .mockReturnValue(of([{ id: 3, name: 'bash', summary: 'Shell.', ueCodes: ['UTC502'] }]));
    importService.preview.mockReset().mockReturnValue(of(FOUND));
    importService.import.mockReset().mockReturnValue(of(FOUND));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: DialogService, useValue: { prompt } },
        {
          provide: ToolService,
          useValue: {
            create,
            list,
          },
        },
        { provide: CommandImportService, useValue: importService },
      ],
    });
    fixture = TestBed.createComponent(ToolListPage);
    fixture.detectChanges();
  });

  async function createTool(): Promise<void> {
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.button-primary')
      ?.click();
    await new Promise((resolve) => setTimeout(resolve));
  }

  it('liste les outils avec leur lien et leurs UE', () => {
    const card = (fixture.nativeElement as HTMLElement).querySelector('a.tool-card');

    expect(card?.getAttribute('href')).toBe('/outils/3');
    expect(card?.textContent).toContain('bash');
    expect(card?.textContent).toContain('UTC502');
  });

  it('crée un outil par son nom et ouvre son édition', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    prompt.mockResolvedValue('  git ');

    await createTool();

    expect(create).toHaveBeenCalledWith({ name: 'git' });
    expect(navigate).toHaveBeenCalledWith(['/outils', 8, 'edition']);
  });

  it('ne crée rien si la saisie est annulée ou vide', async () => {
    prompt.mockResolvedValue(null);
    await createTool();
    prompt.mockResolvedValue('   ');
    await createTool();

    expect(create).not.toHaveBeenCalled();
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function click(label: string): void {
    Array.from(element().querySelectorAll('button'))
      .find((button) => (button.textContent ?? '').trim() === label)
      ?.click();
    fixture.detectChanges();
  }

  async function pickFile(content: string): Promise<void> {
    const field = element().querySelector<HTMLInputElement>('input[type="file"]');
    const file = { text: () => Promise.resolve(content) };
    Object.defineProperty(field, 'files', { value: { item: () => file }, configurable: true });
    field?.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('importe un fichier de commandes après en avoir montré l’aperçu, puis recharge la liste', async () => {
    click('Importer');
    await pickFile('[{"outil": "git"}]');

    expect(importService.preview).toHaveBeenCalledWith('[{"outil": "git"}]');
    const summary = element().querySelector('app-command-import-summary')?.textContent ?? '';
    expect(summary).toContain('1 outil à créer : git');
    expect(summary).toContain('1 commande déjà en place : ls (bash)');

    element().querySelector<HTMLInputElement>('app-modal input[type="checkbox"]')?.click();
    element().querySelector<HTMLButtonElement>('app-modal .button-primary')?.click();
    fixture.detectChanges();

    expect(importService.import).toHaveBeenCalledWith('[{"outil": "git"}]', true);
    expect(list).toHaveBeenCalledTimes(2);
    expect(element().querySelector('app-modal')).toBeNull();
  });

  it('montre pourquoi un fichier est refusé, sans fermer la fenêtre', async () => {
    importService.preview.mockReturnValue(
      throwError(() => new ApiError(400, ['commandes.json, outil 1 : « outil » est requis.'])),
    );

    click('Importer');
    await pickFile('[{}]');

    expect(element().querySelector('app-modal .form-error')?.textContent).toContain(
      '« outil » est requis',
    );
    expect(element().querySelector('app-command-import-summary')).toBeNull();
  });
});

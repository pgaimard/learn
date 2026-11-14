import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { DialogService } from '../../core/dialog/dialog.service';
import { ToolListPage } from './tool-list-page';
import { Tool, ToolService } from './tool.service';

describe('ToolListPage', () => {
  let fixture: ComponentFixture<ToolListPage>;
  const prompt = vi.fn<DialogService['prompt']>();
  const create = vi.fn<ToolService['create']>();

  beforeEach(() => {
    prompt.mockReset();
    create.mockReset().mockReturnValue(of({ id: 8 } as Tool));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: DialogService, useValue: { prompt } },
        {
          provide: ToolService,
          useValue: {
            create,
            list: () => of([{ id: 3, name: 'bash', summary: 'Shell.', ueCodes: ['UTC502'] }]),
          },
        },
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
});

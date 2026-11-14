import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { Icon } from '../../core/ui/icon';
import { MenuButton } from '../../core/ui/menu-button';
import { shortcut } from '../../core/ui/platform';
import { ContentEditor } from '../cours/editor/content-editor';
import { Ue, UeService } from '../ue/ue.service';
import { Tool, ToolInput, ToolMode, ToolService, ToolVariant } from './tool.service';

// Ligne du formulaire pour un mode ; id vaut null tant que le mode n'est pas enregistré.
type ModeGroup = FormGroup<{
  id: FormControl<number | null>;
  name: FormControl<string>;
  prompt: FormControl<string>;
  entry: FormControl<string>;
}>;

type VariantGroup = FormGroup<{
  id: FormControl<number | null>;
  name: FormControl<string>;
}>;

const required = [Validators.required, Validators.pattern(/\S/)];

@Component({
  selector: 'app-tool-edit-page',
  imports: [Icon, MenuButton, ContentEditor, DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './tool-edit-page.html',
  styleUrl: './tool-edit-page.css',
  host: {
    '(document:keydown.control.s)': 'saveFromKeyboard($event)',
    '(document:keydown.meta.s)': 'saveFromKeyboard($event)',
    '(window:beforeunload)': 'warnBeforeUnload($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolEditPage {
  // Paramètre de la route /outils/:id/edition.
  readonly id = input.required<string>();

  private readonly toolService = inject(ToolService);
  private readonly ueService = inject(UeService);
  private readonly dialog = inject(DialogService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly editor = viewChild(ContentEditor);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly tool = signal<Tool | null>(null);
  protected readonly ues = signal<Ue[]>([]);
  // Codes des UE où l'outil sert.
  protected readonly ueCodes = signal<string[]>([]);
  protected readonly errors = signal<string[]>([]);
  protected readonly saveKey = shortcut('S');
  protected readonly isSaving = signal(false);
  protected readonly isDirty = signal(false);
  protected readonly savedAt = signal<Date | null>(null);

  protected readonly form = this.formBuilder.group({
    name: ['', [...required, Validators.maxLength(100)]],
    summary: ['', Validators.maxLength(300)],
    variants: this.formBuilder.array<VariantGroup>([]),
    modes: this.formBuilder.array<ModeGroup>([]),
  });

  constructor() {
    effect(() => this.load(Number(this.id())));
    this.ueService.list().subscribe({
      next: (ues) => this.ues.set(ues),
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }

  // Appelé par la garde de sortie de la route.
  canLeave(): boolean | Promise<boolean> {
    return (
      !this.isDirty() ||
      this.dialog.confirm({
        title: 'Modifications non enregistrées',
        message: 'Quitter cette page fera perdre les modifications en cours.',
        confirmLabel: 'Quitter sans enregistrer',
        isDestructive: true,
      })
    );
  }

  protected markDirty(): void {
    this.isDirty.set(true);
  }

  protected toggleUe(code: string, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.ueCodes.update((codes) =>
      isChecked ? [...codes, code] : codes.filter((other) => other !== code),
    );
    this.markDirty();
  }

  protected addVariant(): void {
    this.form.controls.variants.push(this.variantGroup());
    this.markDirty();
    this.focusLast('.variant');
  }

  protected addMode(): void {
    this.form.controls.modes.push(this.modeGroup());
    this.markDirty();
    this.focusLast('.mode');
  }

  protected removeAt(list: FormArray, index: number): void {
    list.removeAt(index);
    this.markDirty();
  }

  // Monte (-1) ou descend (+1) un mode : leur ordre est celui de la lecture.
  protected moveMode(index: number, offset: -1 | 1): void {
    const modes = this.form.controls.modes;
    const mode = modes.at(index);
    modes.removeAt(index);
    modes.insert(index + offset, mode);
    this.markDirty();
  }

  protected save(): void {
    const tool = this.tool();
    const content = this.editor()?.getContent();
    if (!tool || !content || this.isSaving() || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, summary, variants, modes } = this.form.getRawValue();
    const changes: ToolInput = {
      name: name.trim(),
      summary: summary.trim(),
      content,
      ueCodes: this.ueCodes(),
      variants: variants.map(({ id, name: variantName }) => ({
        ...(id === null ? {} : { id }),
        name: variantName.trim(),
      })),
      modes: modes.map(({ id, name: modeName, prompt, entry }) => ({
        ...(id === null ? {} : { id }),
        name: modeName.trim(),
        prompt: prompt.trim(),
        entry: entry.trim(),
      })),
    };
    this.isSaving.set(true);
    this.errors.set([]);
    this.toolService.update(tool.id, changes).subscribe({
      next: (saved) => {
        this.isSaving.set(false);
        this.savedAt.set(new Date());
        // Les nouveaux modes et déclinaisons ont maintenant un numéro.
        this.fill(saved);
      },
      error: (error: ApiError) => {
        this.isSaving.set(false);
        this.errors.set(error.messages);
      },
    });
  }

  protected refuseImage(): void {
    this.errors.set(['La fiche d’un outil ne peut pas encore contenir d’image.']);
  }

  protected async remove(): Promise<void> {
    const tool = this.tool();
    if (
      !tool ||
      !(await this.dialog.confirmDeletion(
        'Supprimer l’outil',
        `« ${tool.name} », ses modes et ses déclinaisons seront supprimés définitivement.`,
      ))
    ) {
      return;
    }
    this.toolService.remove(tool.id).subscribe({
      next: () => {
        this.isDirty.set(false);
        void this.router.navigateByUrl('/outils');
      },
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }

  protected saveFromKeyboard(event: Event): void {
    event.preventDefault();
    this.save();
  }

  protected warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isDirty()) {
      event.preventDefault();
    }
  }

  // Le curseur va dans la ligne qui vient d'être ajoutée : on la remplit aussitôt.
  private focusLast(selector: string): void {
    afterNextRender(
      () => {
        const rows = this.host.nativeElement.querySelectorAll<HTMLElement>(selector);
        rows
          .item(rows.length - 1)
          ?.querySelector('input')
          ?.focus();
      },
      { injector: this.injector },
    );
  }

  private variantGroup(variant?: ToolVariant): VariantGroup {
    return this.formBuilder.group({
      id: this.formBuilder.control<number | null>(variant?.id ?? null),
      name: [variant?.name ?? '', [...required, Validators.maxLength(50)]],
    });
  }

  private modeGroup(mode?: ToolMode): ModeGroup {
    return this.formBuilder.group({
      id: this.formBuilder.control<number | null>(mode?.id ?? null),
      name: [mode?.name ?? '', [...required, Validators.maxLength(100)]],
      prompt: [mode?.prompt ?? '', Validators.maxLength(100)],
      entry: [mode?.entry ?? '', Validators.maxLength(500)],
    });
  }

  // Remplit le formulaire depuis l'outil enregistré. La fiche, elle, reste celle de
  // l'éditeur : la recharger déplacerait le curseur.
  private fill(tool: Tool): void {
    this.form.controls.name.setValue(tool.name);
    this.form.controls.summary.setValue(tool.summary);
    this.form.setControl(
      'variants',
      this.formBuilder.array(tool.variants.map((variant) => this.variantGroup(variant))),
    );
    this.form.setControl(
      'modes',
      this.formBuilder.array(tool.modes.map((mode) => this.modeGroup(mode))),
    );
    this.ueCodes.set(tool.ues.map((ue) => ue.code));
    this.isDirty.set(false);
    this.title.setTitle(`Édition – ${tool.name}`);
  }

  private load(id: number): void {
    this.toolService.get(id).subscribe({
      next: (tool) => {
        this.tool.set(tool);
        this.fill(tool);
      },
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }
}

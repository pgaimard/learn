import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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
import { forkJoin } from 'rxjs';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { Dropdown, DropdownOption } from '../../core/ui/dropdown';
import { Icon } from '../../core/ui/icon';
import { shortcut } from '../../core/ui/platform';
import { CommandLine } from './command-line';
import {
  Command,
  CommandExample,
  CommandInput,
  CommandOption,
  CommandService,
} from './command.service';
import { listThemes } from './filter-commands';
import { Tool, ToolService } from './tool.service';

type OptionGroup = FormGroup<{
  text: FormControl<string>;
  description: FormControl<string>;
  variantIds: FormControl<number[]>;
}>;

type ExampleGroup = FormGroup<{
  line: FormControl<string>;
  explanation: FormControl<string>;
  output: FormControl<string>;
}>;

const required = [Validators.required, Validators.pattern(/\S/)];

// Formulaire d'une commande, nouvelle ou existante : syntaxe, mode, déclinaisons,
// thèmes, options et exemples ligne par ligne, notes.
@Component({
  selector: 'app-command-edit-page',
  imports: [CommandLine, Dropdown, Icon, ReactiveFormsModule, RouterLink],
  templateUrl: './command-edit-page.html',
  styleUrl: './command-edit-page.css',
  host: {
    '(document:keydown.control.s)': 'saveFromKeyboard($event)',
    '(document:keydown.meta.s)': 'saveFromKeyboard($event)',
    '(window:beforeunload)': 'warnBeforeUnload($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandEditPage {
  // Paramètres des routes /outils/:id/commandes/nouvelle et
  // /outils/:id/commandes/:commandId/edition.
  readonly id = input.required<string>();
  readonly commandId = input<string>();

  private readonly toolService = inject(ToolService);
  private readonly commandService = inject(CommandService);
  private readonly dialog = inject(DialogService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly tool = signal<Tool | null>(null);
  // Commande modifiée ; null pour une nouvelle.
  protected readonly command = signal<Command | null>(null);
  // Thèmes déjà portés par les commandes de l'outil, rappelés sous le champ.
  protected readonly knownThemes = signal<string[]>([]);
  protected readonly errors = signal<string[]>([]);
  protected readonly isSaving = signal(false);
  protected readonly saveKey = shortcut('S');

  protected readonly form = this.formBuilder.group({
    name: ['', [...required, Validators.maxLength(100)]],
    summary: ['', Validators.maxLength(300)],
    syntax: ['', Validators.maxLength(500)],
    // Numéro du mode en texte ; vide : aucun.
    modeId: [''],
    variantIds: this.formBuilder.control<number[]>([]),
    // Thèmes séparés par des virgules.
    themes: [''],
    notes: ['', Validators.maxLength(5000)],
    options: this.formBuilder.array<OptionGroup>([]),
    examples: this.formBuilder.array<ExampleGroup>([]),
  });

  // Aperçu coloré de la syntaxe, au fil de la frappe.
  protected readonly typedName = toSignal(this.form.controls.name.valueChanges, {
    initialValue: '',
  });
  protected readonly typedSyntax = toSignal(this.form.controls.syntax.valueChanges, {
    initialValue: '',
  });

  protected readonly modeOptions = computed<DropdownOption[]>(() => [
    { value: '', label: 'Aucun' },
    ...(this.tool()?.modes ?? []).map((mode) => ({ value: String(mode.id), label: mode.name })),
  ]);

  constructor() {
    effect(() => this.load(Number(this.id()), this.commandId()));
  }

  // Appelé par la garde de sortie de la route.
  canLeave(): boolean | Promise<boolean> {
    return (
      !this.form.dirty ||
      this.dialog.confirm({
        title: 'Modifications non enregistrées',
        message: 'Quitter cette page fera perdre les modifications en cours.',
        confirmLabel: 'Quitter sans enregistrer',
        isDestructive: true,
      })
    );
  }

  // Coche ou décoche une déclinaison, pour la commande ou pour une de ses options.
  protected toggleVariant(control: FormControl<number[]>, id: number, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    control.setValue(
      isChecked ? [...control.value, id] : control.value.filter((other) => other !== id),
    );
    control.markAsDirty();
  }

  protected addOption(): void {
    this.form.controls.options.push(this.optionGroup());
    this.form.markAsDirty();
    this.focusLast('.option');
  }

  protected addExample(): void {
    this.form.controls.examples.push(this.exampleGroup());
    this.form.markAsDirty();
    this.focusLast('.example');
  }

  protected removeAt(list: FormArray, index: number): void {
    list.removeAt(index);
    this.form.markAsDirty();
  }

  // Monte (-1) ou descend (+1) une ligne : l'ordre est celui de la fiche.
  protected move(list: FormArray, index: number, offset: -1 | 1): void {
    const row = list.at(index);
    list.removeAt(index);
    list.insert(index + offset, row);
    this.form.markAsDirty();
  }

  protected save(): void {
    const tool = this.tool();
    if (!tool || this.isSaving() || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const input = this.readInput();
    const command = this.command();
    const request = command
      ? this.commandService.update(tool.id, command.id, input)
      : this.commandService.create(tool.id, input);
    this.isSaving.set(true);
    this.errors.set([]);
    request.subscribe({
      next: (saved) => {
        this.form.markAsPristine();
        void this.router.navigate(['/outils', tool.id], {
          queryParams: { volet: 'commandes', commande: saved.id },
        });
      },
      error: (error: ApiError) => {
        this.isSaving.set(false);
        this.errors.set(error.messages);
      },
    });
  }

  protected saveFromKeyboard(event: Event): void {
    event.preventDefault();
    this.save();
  }

  protected warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.form.dirty) {
      event.preventDefault();
    }
  }

  private readInput(): CommandInput {
    const value = this.form.getRawValue();
    return {
      name: value.name.trim(),
      summary: value.summary.trim(),
      syntax: value.syntax.trim(),
      modeId: value.modeId === '' ? null : Number(value.modeId),
      variantIds: value.variantIds,
      notes: value.notes.trim(),
      themes: value.themes
        .split(',')
        .map((theme) => theme.trim())
        .filter((theme) => theme !== ''),
      options: value.options.map((option) => ({
        text: option.text.trim(),
        description: option.description.trim(),
        variantIds: option.variantIds,
      })),
      examples: value.examples.map((example) => ({
        line: example.line.trim(),
        explanation: example.explanation.trim(),
        output: example.output.trimEnd(),
      })),
    };
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

  private optionGroup(option?: CommandOption): OptionGroup {
    return this.formBuilder.group({
      text: [option?.text ?? '', [...required, Validators.maxLength(200)]],
      description: [option?.description ?? '', Validators.maxLength(1000)],
      variantIds: this.formBuilder.control<number[]>(option?.variantIds ?? []),
    });
  }

  private exampleGroup(example?: CommandExample): ExampleGroup {
    return this.formBuilder.group({
      line: [example?.line ?? '', [...required, Validators.maxLength(1000)]],
      explanation: [example?.explanation ?? '', Validators.maxLength(1000)],
      output: [example?.output ?? '', Validators.maxLength(10000)],
    });
  }

  private fill(command: Command): void {
    this.form.patchValue({
      name: command.name,
      summary: command.summary,
      syntax: command.syntax,
      modeId: command.modeId === null ? '' : String(command.modeId),
      variantIds: command.variantIds,
      themes: command.themes.join(', '),
      notes: command.notes,
    });
    this.form.setControl(
      'options',
      this.formBuilder.array(command.options.map((option) => this.optionGroup(option))),
    );
    this.form.setControl(
      'examples',
      this.formBuilder.array(command.examples.map((example) => this.exampleGroup(example))),
    );
    this.form.markAsPristine();
  }

  private load(toolId: number, commandId: string | undefined): void {
    forkJoin([this.toolService.get(toolId), this.commandService.list(toolId)]).subscribe({
      next: ([tool, commands]) => {
        const command = commands.find((candidate) => candidate.id === Number(commandId)) ?? null;
        if (commandId !== undefined && !command) {
          this.errors.set(['Cette commande n’existe pas.']);
          return;
        }
        this.knownThemes.set(listThemes(commands));
        this.command.set(command);
        if (command) {
          this.fill(command);
        }
        this.tool.set(tool);
        this.title.setTitle(
          command ? `Édition – ${command.name}` : `Nouvelle commande – ${tool.name}`,
        );
      },
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }
}

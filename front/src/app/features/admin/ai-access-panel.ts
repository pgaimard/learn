import { DatePipe, DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogService } from '../../core/dialog/dialog.service';
import { ApiError } from '../../core/http/api-error';
import { Icon } from '../../core/ui/icon';
import { AiAccess, AiAccessService } from './ai-access.service';

// Accès de l'IA : le jeton que le connecteur de Claude envoie au serveur MCP.
@Component({
  selector: 'app-ai-access-panel',
  imports: [DatePipe, Icon, ReactiveFormsModule],
  templateUrl: './ai-access-panel.html',
  styleUrl: './ai-access-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiAccessPanel {
  private readonly aiAccess = inject(AiAccessService);
  private readonly dialog = inject(DialogService);
  private readonly document = inject(DOCUMENT);

  // Adresse à donner au connecteur : celle de cette application.
  protected readonly serverUrl = `${this.document.location.origin}/api/mcp`;
  protected readonly form = inject(NonNullableFormBuilder).group({
    password: ['', Validators.required],
  });
  protected readonly isLoaded = signal(false);
  protected readonly access = signal<AiAccess | null>(null);
  // Jeton qui vient d'être créé : affiché une fois, perdu dès qu'on quitte la page.
  protected readonly token = signal<string | null>(null);
  protected readonly copied = signal<string | null>(null);
  protected readonly isSubmitting = signal(false);
  protected readonly errors = signal<string[]>([]);

  constructor() {
    this.aiAccess.status().subscribe({
      next: (access) => {
        this.access.set(access);
        this.isLoaded.set(true);
      },
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }

  protected generate(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    this.errors.set([]);
    this.aiAccess.generate(this.form.getRawValue().password).subscribe({
      next: ({ token, ...access }) => {
        this.access.set(access);
        this.token.set(token);
        this.copied.set(null);
        this.isSubmitting.set(false);
        this.form.reset();
      },
      error: (error: ApiError) => {
        this.errors.set(error.messages);
        this.isSubmitting.set(false);
        this.form.reset();
      },
    });
  }

  protected async revoke(): Promise<void> {
    const isConfirmed = await this.dialog.confirm({
      title: 'Révoquer l’accès de l’IA',
      message:
        'Le jeton cessera aussitôt de fonctionner : Claude ne pourra plus lire les données tant qu’un nouveau jeton n’aura pas été créé et donné au connecteur.',
      confirmLabel: 'Révoquer',
      isDestructive: true,
    });
    if (!isConfirmed) {
      return;
    }
    this.errors.set([]);
    this.aiAccess.revoke().subscribe({
      next: () => {
        this.access.set(null);
        this.token.set(null);
      },
      error: (error: ApiError) => this.errors.set(error.messages),
    });
  }

  protected async copy(value: string): Promise<void> {
    await this.document.defaultView?.navigator.clipboard.writeText(value);
    this.copied.set(value);
  }
}

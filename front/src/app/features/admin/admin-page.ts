import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError } from '../../core/http/api-error';
import { Icon } from '../../core/ui/icon';
import { ExportService } from './export.service';

@Component({
  selector: 'app-admin-page',
  imports: [Icon, ReactiveFormsModule],
  templateUrl: './admin-page.html',
  styleUrl: './admin-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPage {
  private readonly exportService = inject(ExportService);

  protected readonly form = inject(NonNullableFormBuilder).group({
    password: ['', Validators.required],
  });
  protected readonly isSubmitting = signal(false);
  protected readonly hasStarted = signal(false);
  protected readonly errors = signal<string[]>([]);

  protected exportAll(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    this.hasStarted.set(false);
    this.errors.set([]);
    this.exportService.authorize(this.form.getRawValue().password).subscribe({
      next: () => {
        this.exportService.download();
        this.hasStarted.set(true);
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
}

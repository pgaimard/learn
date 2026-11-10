import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { SessionService } from '../core/auth/session.service';
import { LOGIN_URL } from '../core/http/api-error.interceptor';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  protected readonly user = this.session.user;
  protected readonly isLoggingOut = signal(false);

  protected logout(): void {
    if (this.isLoggingOut()) {
      return;
    }
    this.isLoggingOut.set(true);
    this.session.logout().subscribe({
      next: () => void this.router.navigateByUrl(LOGIN_URL),
      error: () => this.isLoggingOut.set(false),
    });
  }
}

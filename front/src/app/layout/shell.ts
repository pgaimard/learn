import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from '../core/auth/session.service';
import { TermQuickCreate } from '../features/termes/term-quick-create';
import { LOGIN_URL } from '../core/http/api-error.interceptor';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TermQuickCreate],
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

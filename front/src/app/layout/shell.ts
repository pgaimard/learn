import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from '../core/auth/session.service';
import { LOGIN_URL } from '../core/http/api-error.interceptor';
import { ThemeService } from '../core/theme/theme.service';
import { Icon } from '../core/ui/icon';
import { SearchBox } from '../features/recherche/search-box';
import { TaskReminderBadge } from '../features/taches/task-reminder-badge';
import { TermQuickCreate } from '../features/termes/term-quick-create';

@Component({
  selector: 'app-shell',
  imports: [
    Icon,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    SearchBox,
    TaskReminderBadge,
    TermQuickCreate,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
  host: {
    '(document:click)': 'closeAccountFromOutside($event)',
    '(document:keydown.escape)': 'closeAccount()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);
  private readonly accountButton = viewChild<ElementRef<HTMLButtonElement>>('accountButton');

  protected readonly user = this.session.user;
  protected readonly initials = computed(() => (this.user()?.username ?? '').slice(0, 2));
  protected readonly isDark = computed(() => this.themeService.theme() === 'dark');
  protected readonly isAccountOpen = signal(false);
  protected readonly isLoggingOut = signal(false);

  protected toggleTheme(): void {
    this.themeService.toggle();
  }

  protected closeAccountFromOutside(event: Event): void {
    const button = this.accountButton()?.nativeElement;
    if (event.target instanceof Node && button?.parentElement?.contains(event.target)) {
      return;
    }
    this.isAccountOpen.set(false);
  }

  // Échap rend le curseur au bouton qui avait ouvert le menu.
  protected closeAccount(): void {
    if (this.isAccountOpen()) {
      this.isAccountOpen.set(false);
      this.accountButton()?.nativeElement.focus();
    }
  }

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

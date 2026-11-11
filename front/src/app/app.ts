import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DialogHost } from './core/dialog/dialog-host';

@Component({
  selector: 'app-root',
  imports: [DialogHost, RouterOutlet],
  template: '<router-outlet /><app-dialog-host />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}

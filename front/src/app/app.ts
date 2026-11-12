import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DialogHost } from './core/dialog/dialog-host';
import { ImageViewer } from './core/ui/image-viewer';

@Component({
  selector: 'app-root',
  imports: [DialogHost, ImageViewer, RouterOutlet],
  template: '<router-outlet /><app-dialog-host /><app-image-viewer />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}

import { ChangeDetectionStrategy, Component } from '@angular/core';

// Illustration de fond de l'écran de connexion : un circuit imprimé, purement décoratif.
@Component({
  selector: 'app-login-background',
  templateUrl: './login-background.html',
  styles: `
    :host {
      --login-ground: light-dark(#e4eeec, #0b1f1e);
      --login-line: light-dark(#c3d8d4, #17403c);
      --login-mark: light-dark(#8fb8b1, #2c6a63);
      position: absolute;
      inset: 0;
    }

    svg {
      width: 100%;
      height: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginBackground {}

import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-ue-list-page',
  template: `
    <main>
      <h1>Mes UE</h1>
      <p>Aucune UE pour l’instant.</p>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UeListPage {}

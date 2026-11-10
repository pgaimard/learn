import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-ue-list-page',
  template: `
    <h1>Mes UE</h1>
    <p>Aucune UE pour l’instant.</p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UeListPage {}

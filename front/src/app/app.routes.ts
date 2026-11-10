import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadChildren: () => import('./features/ue/ue.routes').then((module) => module.ueRoutes),
  },
  { path: '**', redirectTo: '' },
];

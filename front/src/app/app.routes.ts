import { Routes } from '@angular/router';
import { anonymousGuard, authenticatedGuard } from './core/auth/auth.guards';
import { Shell } from './layout/shell';

export const routes: Routes = [
  {
    path: 'connexion',
    canActivate: [anonymousGuard],
    loadChildren: () => import('./features/auth/auth.routes').then((module) => module.authRoutes),
  },
  {
    path: '',
    component: Shell,
    canActivate: [authenticatedGuard],
    children: [
      {
        path: 'ue/:code/cours',
        loadChildren: () =>
          import('./features/cours/cours.routes').then((module) => module.coursRoutes),
      },
      {
        path: '',
        loadChildren: () => import('./features/ue/ue.routes').then((module) => module.ueRoutes),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

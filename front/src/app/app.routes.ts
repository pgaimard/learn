import { Routes } from '@angular/router';
import { anonymousGuard, authenticatedGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  {
    path: 'connexion',
    canActivate: [anonymousGuard],
    loadChildren: () => import('./features/auth/auth.routes').then((module) => module.authRoutes),
  },
  {
    path: '',
    pathMatch: 'full',
    canActivate: [authenticatedGuard],
    loadChildren: () => import('./features/ue/ue.routes').then((module) => module.ueRoutes),
  },
  { path: '**', redirectTo: '' },
];

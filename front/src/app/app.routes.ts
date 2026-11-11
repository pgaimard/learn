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
        path: 'import',
        title: 'Importer un cours',
        loadComponent: () =>
          import('./features/cours/import/course-import-page').then(
            (module) => module.CourseImportPage,
          ),
      },
      {
        path: 'recherche',
        title: 'Recherche',
        loadComponent: () =>
          import('./features/recherche/search-page').then((module) => module.SearchPage),
      },
      {
        path: 'agenda',
        title: 'Agenda',
        loadComponent: () =>
          import('./features/agenda/agenda-page').then((module) => module.AgendaPage),
      },
      {
        path: 'taches',
        title: 'Tâches',
        loadComponent: () =>
          import('./features/taches/tasks-page').then((module) => module.TasksPage),
      },
      {
        path: 'dictionnaire',
        title: 'Dictionnaire',
        data: { type: 'definition' },
        loadChildren: () =>
          import('./features/termes/termes.routes').then((module) => module.termesRoutes),
      },
      {
        path: 'glossaire',
        title: 'Glossaire',
        data: { type: 'acronym' },
        loadChildren: () =>
          import('./features/termes/termes.routes').then((module) => module.termesRoutes),
      },
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

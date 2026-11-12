import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '../cours/unsaved-changes.guard';
import { TermEditPage } from './term-edit-page';
import { TermListPage } from './term-list-page';
import { TermReadPage } from './term-read-page';

const editRoute = {
  path: ':id/edition',
  component: TermEditPage,
  canDeactivate: [unsavedChangesGuard],
};

// Le type de terme vient de la route parente.

// Dictionnaire : la liste et la définition choisie sont sur le même écran.
export const dictionnaireRoutes: Routes = [
  { path: '', pathMatch: 'full', component: TermListPage },
  { path: ':id', component: TermListPage },
  editRoute,
];

// Glossaire : la liste, puis une page par acronyme.
export const glossaireRoutes: Routes = [
  { path: '', pathMatch: 'full', component: TermListPage },
  { path: ':id', component: TermReadPage },
  editRoute,
];

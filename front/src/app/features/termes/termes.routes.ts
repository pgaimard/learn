import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '../cours/unsaved-changes.guard';
import { TermEditPage } from './term-edit-page';
import { TermListPage } from './term-list-page';
import { TermReadPage } from './term-read-page';

// Routes communes au dictionnaire et au glossaire : le type vient de la route parente.
export const termesRoutes: Routes = [
  { path: '', pathMatch: 'full', component: TermListPage },
  { path: ':id', component: TermReadPage },
  { path: ':id/edition', component: TermEditPage, canDeactivate: [unsavedChangesGuard] },
];

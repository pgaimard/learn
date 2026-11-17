import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '../cours/unsaved-changes.guard';
import { TermEditPage } from './term-edit-page';
import { TermReadPage } from './term-read-page';

// Sous /ue/:code/termes : un terme appartient à son UE.
export const termesRoutes: Routes = [
  { path: ':id', component: TermReadPage },
  { path: ':id/edition', component: TermEditPage, canDeactivate: [unsavedChangesGuard] },
];

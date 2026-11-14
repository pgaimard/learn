import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '../cours/unsaved-changes.guard';
import { ToolEditPage } from './tool-edit-page';
import { ToolListPage } from './tool-list-page';
import { ToolReadPage } from './tool-read-page';

export const outilsRoutes: Routes = [
  { path: '', pathMatch: 'full', component: ToolListPage },
  { path: ':id', component: ToolReadPage },
  { path: ':id/edition', component: ToolEditPage, canDeactivate: [unsavedChangesGuard] },
];

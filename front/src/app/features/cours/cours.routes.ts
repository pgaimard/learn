import { Routes } from '@angular/router';
import { CourseEditPage } from './course-edit-page';
import { CourseReadPage } from './course-read-page';
import { SheetEditPage } from './sheet-edit-page';
import { unsavedChangesGuard } from './unsaved-changes.guard';

export const coursRoutes: Routes = [
  { path: ':id', component: CourseReadPage },
  {
    path: ':id/versions',
    loadComponent: () =>
      import('./versions/course-versions-page').then((module) => module.CourseVersionsPage),
  },
  { path: ':id/edition', component: CourseEditPage, canDeactivate: [unsavedChangesGuard] },
  {
    path: ':id/fiche/edition',
    component: SheetEditPage,
    canDeactivate: [unsavedChangesGuard],
  },
  // Les exercices du cours s'éditent comme sa fiche : un document à part.
  {
    path: ':id/exercices/edition',
    component: SheetEditPage,
    data: { document: 'exercises' },
    canDeactivate: [unsavedChangesGuard],
  },
];

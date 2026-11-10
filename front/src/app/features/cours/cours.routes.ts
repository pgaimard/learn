import { Routes } from '@angular/router';
import { CourseEditPage } from './course-edit-page';
import { CourseReadPage } from './course-read-page';
import { unsavedChangesGuard } from './unsaved-changes.guard';

export const coursRoutes: Routes = [
  { path: ':id', component: CourseReadPage },
  { path: ':id/edition', component: CourseEditPage, canDeactivate: [unsavedChangesGuard] },
];

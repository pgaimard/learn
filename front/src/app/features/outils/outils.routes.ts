import { Routes } from '@angular/router';
import { ToolListPage } from './tool-list-page';
import { ToolReadPage } from './tool-read-page';

export const outilsRoutes: Routes = [
  { path: '', pathMatch: 'full', component: ToolListPage },
  { path: ':id', component: ToolReadPage },
];

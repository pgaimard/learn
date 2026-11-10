import { Routes } from '@angular/router';
import { UeListPage } from './ue-list-page';
import { UePage } from './ue-page';

export const ueRoutes: Routes = [
  { path: '', pathMatch: 'full', component: UeListPage, title: 'Mes UE' },
  { path: 'ue/:code', component: UePage },
];

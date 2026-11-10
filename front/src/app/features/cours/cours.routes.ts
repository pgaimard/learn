import { Routes } from '@angular/router';
import { CourseReadPage } from './course-read-page';

export const coursRoutes: Routes = [{ path: ':id', component: CourseReadPage }];

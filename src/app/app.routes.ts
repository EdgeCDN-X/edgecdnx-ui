import { Routes } from '@angular/router';
import { AppLayoutComponent } from './shared/layout/app-layout/app-layout.component';

import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: AppLayoutComponent,
  },
  {
    path: 'logout',
    loadComponent: () =>
      import('./auth/logout/logout').then((m) => m.Logout),
  },
  {
    path: '**',
    redirectTo: '',
  },
];

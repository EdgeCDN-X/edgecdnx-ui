import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [authGuard],
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

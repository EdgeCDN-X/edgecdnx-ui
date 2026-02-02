import { Routes } from '@angular/router';
import { AppLayoutComponent } from './shared/layout/app-layout/app-layout.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: AppLayoutComponent,
    children: [
      {
        path: 'dashboard',
        pathMatch: 'full',
        component: DashboardComponent,
        title: 'Dashboard',
        canActivate: [authGuard],
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./pages/projects/projects').then(
            (m) => m.Projects
          ),
        title: 'Projects',
        canActivate: [authGuard],
      },
      {
        path: 'projects/:name',
        loadComponent: () =>
          import('./pages/projects/details/details').then(
            (m) => m.ProjectDetails
          ),
        title: 'Project Details',
      }
    ],
  },
  {
    path: 'logout',
    loadComponent: () =>
      import('./auth/logout/logout').then((m) => m.Logout),
  },
  {
    path: 'callback',
    redirectTo: '',
  }
];

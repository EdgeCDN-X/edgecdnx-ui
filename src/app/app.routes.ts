import { Routes } from '@angular/router';
import { AppLayoutComponent } from './shared/layout/app-layout/app-layout.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { authGuard } from './auth/auth.guard';
import { SignInComponent } from './auth/sign-in/sign-in.component';

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
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./pages/projects/projects').then(
            (m) => m.Projects
          ),
        title: 'Projects',
      },
      {
        path: 'projects/:name',
        loadComponent: () =>
          import('./pages/projects/details/details').then(
            (m) => m.ProjectDetails
          ),
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () =>
              import('./pages/projects/details/overview/overview').then(
                (m) => m.Overview
              ),
            title: 'Overview',
          },
          {
            path: 'services',
            loadComponent: () =>
              import('./pages/projects/details/services/services').then(
                (m) => m.Services
              ),
            title: 'Services',
          },
          {
            path: 'service/:serviceName',
            loadComponent: () =>
              import('./pages/projects/details/service-details/service-details').then(
                (m) => m.ServiceDetails
              ),
            title: 'Service Details',
          }
        ],
        title: 'Project Details',
      }
    ],
    canActivate: [authGuard],
  },
  {
    path: 'signin',
    component: SignInComponent,
    title: 'Angular Sign In Dashboard | TailAdmin - Angular Admin Dashboard Template'
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

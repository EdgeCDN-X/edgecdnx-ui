import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { AuthStore } from '../../auth/auth.store';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [PageBreadcrumbComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  authStore = inject(AuthStore);
  userInfo = this.authStore.userInfo;

  constructor(private router: Router) { }

  logout(): void {
    this.authStore.logout();
    this.router.navigate(['/logout']);
  }
}

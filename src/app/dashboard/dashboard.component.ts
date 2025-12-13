import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OAuthService } from 'angular-oauth2-oidc';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Tenant } from './tenant.model';
import { TenantService } from './tenant.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
    MatChipsModule,
    MatToolbarModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  userInfo: any = null;
  tenants: Tenant[] = [];
  filteredTenants: Tenant[] = [];
  searchTerm: string = '';

  constructor(
    private oauthService: OAuthService,
    private router: Router,
    private tenantService: TenantService
  ) {}

  ngOnInit(): void {
    this.userInfo = this.oauthService.getIdentityClaims();
    this.loadTenants();
  }

  loadTenants(): void {
    this.tenants = this.tenantService.getTenants();
    this.filteredTenants = this.tenants;
  }

  onSearchChange(): void {
    this.filteredTenants = this.tenantService.filterTenants(this.searchTerm);
  }

  getUserDisplayName(): string {
    if (!this.userInfo) return 'User';
    return this.userInfo.name || this.userInfo.preferred_username || this.userInfo.email || 'User';
  }

  navigateToProfile(): void {
    this.router.navigate(['/profile']);
  }

  navigateToSettings(): void {
    this.router.navigate(['/settings']);
  }

  logout(): void {
    this.oauthService.logOut();
    this.router.navigate(['/logout']);
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'active':
        return 'primary';
      case 'inactive':
        return 'warn';
      case 'pending':
        return 'accent';
      default:
        return '';
    }
  }
}

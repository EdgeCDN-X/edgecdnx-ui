import { Injectable } from '@angular/core';
import { Tenant } from './tenant.model';

@Injectable({
  providedIn: 'root',
})
export class TenantService {
  private mockTenants: Tenant[] = [
    {
      id: '1',
      name: 'Project Alpha',
      description: 'Main development project for core features and infrastructure.',
      memberCount: 12,
      status: 'active',
    },
    {
      id: '2',
      name: 'Project Beta',
      description: 'Secondary project focused on experimental features and research.',
      memberCount: 8,
      status: 'active',
    },
    {
      id: '3',
      name: 'Project Gamma',
      description: 'Legacy project maintained for backward compatibility.',
      memberCount: 5,
      status: 'inactive',
    },
    {
      id: '4',
      name: 'Project Delta',
      description: 'New project in planning phase for upcoming initiatives.',
      memberCount: 3,
      status: 'pending',
    },
    {
      id: '5',
      name: 'Project Epsilon',
      description: 'Client-specific project with custom requirements and integrations.',
      memberCount: 15,
      status: 'active',
    },
    {
      id: '6',
      name: 'Project Zeta',
      description: 'Internal tooling project for development and deployment automation.',
      memberCount: 6,
      status: 'active',
    },
  ];

  getTenants(): Tenant[] {
    return this.mockTenants;
  }

  filterTenants(searchTerm: string): Tenant[] {
    if (!searchTerm || searchTerm.trim() === '') {
      return this.mockTenants;
    }
    const term = searchTerm.toLowerCase().trim();
    return this.mockTenants.filter(
      (tenant) =>
        tenant.name.toLowerCase().includes(term) || tenant.description.toLowerCase().includes(term)
    );
  }
}

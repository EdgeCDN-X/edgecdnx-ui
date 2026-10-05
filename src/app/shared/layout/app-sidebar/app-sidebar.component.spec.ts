import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthStore } from '../../../auth/auth.store';
import { ProjectsStore } from '../../../pages/projects/store/projects.store';
import { AppSidebarComponent } from './app-sidebar.component';

@Component({ template: '' })
class TestPage {}

describe('Locations sidebar submenu', () => {
  const projectId = signal<string | null>('project-a');

  beforeEach(() => {
    projectId.set('project-a');
    TestBed.configureTestingModule({
      imports: [AppSidebarComponent],
      providers: [
        provideRouter([{ path: 'projects/:name/locations', component: TestPage }, { path: 'projects/:name/locations/healthcheckprofiles', component: TestPage }]),
        { provide: ProjectsStore, useValue: { selectedProjectId: projectId } },
        { provide: AuthStore, useValue: { isAdmin: signal(true) } },
      ],
    });
  });

  it('renders project locations and profiles beneath Locations, without changing admin navigation', async () => {
    await TestBed.inject(Router).navigateByUrl('/projects/project-a/locations/healthcheckprofiles');
    const fixture = TestBed.createComponent(AppSidebarComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const sidebar = fixture.componentInstance;
    const locations = sidebar.projectNavItems().find((item) => item.name === 'Locations');
    expect(locations?.subItems).toEqual([
      { name: 'Locations', path: '/projects/project-a/locations' },
      { name: 'Health Check Profiles', path: '/projects/project-a/locations/healthcheckprofiles' },
    ]);
    expect(sidebar.openSubmenu).toBe('Project-2');
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('a[href="/projects/project-a/locations/healthcheckprofiles"]')?.textContent).toContain('Health Check Profiles');
    expect(element.querySelector('a[href="/admin/locations"]')).not.toBeNull();
    expect(element.querySelector('#Project-2')).not.toBeNull();
    sidebar.toggleSubmenu('Project', 2);
    expect(sidebar.openSubmenu).toBeNull();
    projectId.set('project-b');
    fixture.detectChanges();
    expect(sidebar.projectNavItems().find((item) => item.name === 'Locations')?.subItems?.[1].path).toBe('/projects/project-b/locations/healthcheckprofiles');
  });

  it('opens the active submenu after the project arrives on a direct link', async () => {
    projectId.set(null);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/projects/project-a/locations/healthcheckprofiles');
    const fixture = TestBed.createComponent(AppSidebarComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.openSubmenu).toBeNull();
    projectId.set('project-a');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.openSubmenu).toBe('Project-2');
    await router.navigateByUrl('/projects/project-a/locations');
    fixture.detectChanges();
    expect(fixture.componentInstance.openSubmenu).toBe('Project-2');
  });
});

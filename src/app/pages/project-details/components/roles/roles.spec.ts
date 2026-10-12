import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { of } from 'rxjs';
import { RolesStore } from '../../../projects/store/roles.store';
import { ProjectRole } from '../../../projects/store/roles.types';
import { Roles } from './roles';

describe('Roles', () => {
  let fixture: ComponentFixture<Roles>;
  let component: Roles;
  let store: {
    roles: WritableSignal<ProjectRole[]>;
    resourceTypes: WritableSignal<string[]>;
    loading: WritableSignal<boolean>;
    loadingResourceTypes: WritableSignal<boolean>;
    saving: WritableSignal<boolean>;
    deleting: WritableSignal<boolean>;
    error: WritableSignal<string | null>;
    resourceTypesError: WritableSignal<string | null>;
    loadResourceTypes: jasmine.Spy;
    load: jasmine.Spy;
  };

  beforeEach(() => {
    store = {
      roles: signal<ProjectRole[]>([]),
      resourceTypes: signal(['*', 'location', 'project', 'service', 'zone']),
      loading: signal(false),
      loadingResourceTypes: signal(false),
      saving: signal(false),
      deleting: signal(false),
      error: signal<string | null>(null),
      resourceTypesError: signal<string | null>(null),
      loadResourceTypes: jasmine.createSpy().and.returnValue(of([])),
      load: jasmine.createSpy().and.returnValue(of([])),
    };
    TestBed.configureTestingModule({ imports: [Roles] });
    TestBed.overrideComponent(Roles, {
      set: { providers: [{ provide: RolesStore, useValue: store }] },
    });
    fixture = TestBed.createComponent(Roles);
    fixture.componentRef.setInput('projectId', 'demo');
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('preselects read for each resource when creating and locks project read', () => {
    component.openEditor();

    const rows = component.form.controls.permissions.controls;
    expect(rows.map((row) => row.controls.resource.value)).toEqual(['*', 'location', 'project', 'service', 'zone']);
    expect(rows.every((row) => row.controls.read.value)).toBeTrue();
    const projectRead = rows.find((row) => row.controls.resource.value === 'project')?.controls.read;
    expect(projectRead?.disabled).toBeTrue();
  });

  it('keeps project read selected while editing existing permissions', () => {
    const role: ProjectRole = {
      name: 'viewer',
      permissions: [{ resource: 'service', action: 'read' }],
    };

    component.openEditor(role);

    const rows = component.form.controls.permissions.controls;
    const project = rows.find((row) => row.controls.resource.value === 'project');
    const service = rows.find((row) => row.controls.resource.value === 'service');
    expect(project?.controls.read.value).toBeTrue();
    expect(project?.controls.read.disabled).toBeTrue();
    expect(service?.controls.read.value).toBeTrue();
    expect(rows.find((row) => row.controls.resource.value === 'zone')?.controls.read.value).toBeFalse();
  });
});

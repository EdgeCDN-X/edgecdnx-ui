import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { ApiKeyStore } from '../../projects/store/apikey.store';
import { ApiKey, CreatedApiKey } from '../../projects/store/apikey.types';
import { RolesStore } from '../../projects/store/roles.store';
import { ProjectRole } from '../../projects/store/roles.types';
import { ApiKeys, toLocalDateTimeInput } from './apikeys';

describe('ApiKeys', () => {
  let fixture: ComponentFixture<ApiKeys>;
  let component: ApiKeys;
  const key: ApiKey = {
    id: 'ak-abc123',
    name: 'ak_abc123',
    displayName: 'CI',
    project: 'demo',
    roles: ['viewer'],
    expiresAt: '2099-01-01T00:00:00Z',
    createdAt: '2025-01-01T00:00:00Z',
  };
  let store: {
    apiKeys: WritableSignal<ApiKey[]>;
    loading: WritableSignal<boolean>;
    saving: WritableSignal<boolean>;
    deleting: WritableSignal<boolean>;
    error: WritableSignal<string | null>;
    load: jasmine.Spy;
    create: jasmine.Spy;
    update: jasmine.Spy;
    delete: jasmine.Spy;
  };

  beforeEach(() => {
    store = {
      apiKeys: signal<ApiKey[]>([key]),
      loading: signal(false),
      saving: signal(false),
      deleting: signal(false),
      error: signal<string | null>(null),
      load: jasmine.createSpy().and.returnValue(of([key])),
      create: jasmine.createSpy(),
      update: jasmine.createSpy().and.returnValue(of(key)),
      delete: jasmine.createSpy().and.returnValue(of(undefined)),
    };
    const rolesStore = {
      roles: signal<ProjectRole[]>([
        { name: 'viewer', permissions: [] },
        { name: 'admin', permissions: [] },
      ]),
      loading: signal(false),
      error: signal<string | null>(null),
      load: jasmine.createSpy().and.returnValue(of([])),
    };
    TestBed.configureTestingModule({
      imports: [ApiKeys],
      providers: [
        { provide: ActivatedRoute, useValue: { parent: { paramMap: of(convertToParamMap({ name: 'demo' })) } } },
      ],
    });
    TestBed.overrideComponent(ApiKeys, {
      set: {
        providers: [
          { provide: ApiKeyStore, useValue: store },
          { provide: RolesStore, useValue: rolesStore },
        ],
      },
    });
    fixture = TestBed.createComponent(ApiKeys);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('lists keys with their roles', () => {
    expect(store.load).toHaveBeenCalledWith('demo');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('CI');
    expect(text).toContain('ak_abc123');
    expect(text).toContain('viewer');
  });

  it('shows the token once after creation and hides it on dismiss', () => {
    const created: CreatedApiKey = { ...key, id: 'ak-new', name: 'ak_new', displayName: 'Deploy', token: 'ak_new_secret' };
    store.create.and.returnValue(of(created));
    component.openEditor();
    component.form.controls.displayName.setValue('Deploy');
    component.toggleRole('viewer', true);
    component.save();
    fixture.detectChanges();

    const [, dto] = store.create.calls.mostRecent().args;
    expect(dto.displayName).toBe('Deploy');
    expect(dto.roles).toEqual(['viewer']);
    expect(new Date(dto.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(fixture.nativeElement.textContent).toContain('ak_new_secret');

    component.dismissToken();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('ak_new_secret');
  });

  it('updates only expiry and roles of an existing key', () => {
    component.openEditor(key);
    const expires = new Date('2098-06-01T12:00:00');
    component.form.controls.expiresAt.setValue(toLocalDateTimeInput(expires));
    component.toggleRole('viewer', false);
    component.toggleRole('admin', true);
    component.save();

    expect(store.update).toHaveBeenCalledWith('demo', 'ak-abc123', {
      expiresAt: expires.toISOString(),
      roles: ['admin'],
    });
  });

  it('creates a key that never expires', () => {
    store.create.and.returnValue(of({ ...key, expiresAt: null, token: 'ak_x_secret' }));
    component.openEditor();
    component.form.controls.displayName.setValue('Forever');
    component.form.controls.neverExpires.setValue(true);
    expect(component.form.controls.expiresAt.disabled).toBeTrue();
    component.save();

    expect(store.create.calls.mostRecent().args[1].expiresAt).toBeNull();
  });

  it('clears the expiry of an existing key and shows Never for keys without expiry', () => {
    component.openEditor(key);
    expect(component.form.controls.neverExpires.value).toBeFalse();
    component.form.controls.neverExpires.setValue(true);
    component.save();
    expect(store.update).toHaveBeenCalledWith('demo', 'ak-abc123', { expiresAt: null, roles: ['viewer'] });

    store.apiKeys.set([{ ...key, expiresAt: null }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Never');
    component.openEditor({ ...key, expiresAt: null });
    expect(component.form.controls.neverExpires.value).toBeTrue();
  });

  it('rejects an expiry in the past', () => {
    component.openEditor(key);
    component.form.controls.expiresAt.setValue(toLocalDateTimeInput(new Date(Date.now() - 60_000)));
    component.save();
    expect(store.update).not.toHaveBeenCalled();
    expect(component.validationError()).toContain('future');
  });
});

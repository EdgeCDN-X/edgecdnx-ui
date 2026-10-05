import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';
import { BehaviorSubject } from 'rxjs';
import { ConfigService } from '../../../config/config.store';
import { HealthCheckProfileForm } from './healthcheckprofile-form';
import { HealthCheckProfiles } from './healthcheckprofiles';

describe('HealthCheckProfiles page', () => {
  const collection = 'https://api.example/project/project-a/healthcheckprofiles';
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let http: HttpTestingController;

  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({ name: 'project-a' }));
    TestBed.configureTestingModule({
      imports: [HealthCheckProfiles],
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { parent: { paramMap: params } } },
        { provide: ConfigService, useValue: { environment: () => ({ apiUrl: 'https://api.example' }) } },
        { provide: OAuthService, useValue: { getAccessToken: () => 'test-token' } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('creates, edits, and deletes through the rendered page', () => {
    const fixture = TestBed.createComponent(HealthCheckProfiles);
    fixture.detectChanges();
    http.expectOne(collection).flush([]);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('No health check profiles found.');
    element.querySelector<HTMLButtonElement>('#new-profile')!.click();
    fixture.detectChanges();
    const editor: HealthCheckProfileForm = fixture.debugElement.query(By.directive(HealthCheckProfileForm)).componentInstance;
    editor.form.controls.name.setValue('web');
    editor.form.controls.probes.at(0).controls.name.setValue('tcp');
    editor.submit();
    const create = http.expectOne(collection);
    expect(create.request.method).toBe('POST');
    const profile = { metadata: { name: 'web' }, spec: { probes: create.request.body.probes } };
    create.flush(profile);
    fixture.detectChanges();
    expect(element.textContent).toContain('Health check profile created.');
    expect(element.querySelector('tbody')?.textContent).toContain('tcp (TCP)');
    element.querySelector<HTMLButtonElement>('[aria-label="Edit web"]')!.click();
    fixture.detectChanges();
    const edit: HealthCheckProfileForm = fixture.debugElement.query(By.directive(HealthCheckProfileForm)).componentInstance;
    edit.form.controls.probes.at(0).controls.port.setValue(443);
    edit.submit();
    const update = http.expectOne(collection + '/web');
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body.probes[0].tcp.port).toBe(443);
    expect(update.request.body.name).toBeUndefined();
    update.flush({ ...profile, spec: { probes: update.request.body.probes } });
    fixture.detectChanges();
    expect(element.textContent).toContain('Health check profile updated.');
    element.querySelector<HTMLButtonElement>('[aria-label="Delete web"]')!.click();
    fixture.detectChanges();
    expect(element.textContent).toContain('Locations and nodes referencing this profile');
    fixture.componentInstance.cancelDelete();
    fixture.detectChanges();
    expect(element.querySelector('#profile-delete-heading')).toBeNull();
    element.querySelector<HTMLButtonElement>('[aria-label="Delete web"]')!.click();
    fixture.detectChanges();
    fixture.componentInstance.deleteProfile();
    const deletion = http.expectOne(collection + '/web');
    expect(deletion.request.method).toBe('DELETE');
    deletion.flush(null);
    fixture.detectChanges();
    expect(element.textContent).toContain('Health check profile deleted.');
    expect(element.querySelector('tbody')).toBeNull();
  });

  it('shows load errors and resets the editor when the project changes', () => {
    const fixture = TestBed.createComponent(HealthCheckProfiles);
    fixture.detectChanges();
    http.expectOne(collection).flush({ error: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Forbidden');
    fixture.componentInstance.openEditor();
    fixture.detectChanges();
    params.next(convertToParamMap({ name: 'project-b' }));
    fixture.detectChanges();
    http.expectOne('https://api.example/project/project-b/healthcheckprofiles').flush([]);
    fixture.detectChanges();
    expect(fixture.componentInstance.editorOpen()).toBeFalse();
    expect(fixture.componentInstance.store.profiles()).toEqual([]);
    expect(fixture.nativeElement.querySelector('app-healthcheckprofile-form')).toBeNull();
  });
});

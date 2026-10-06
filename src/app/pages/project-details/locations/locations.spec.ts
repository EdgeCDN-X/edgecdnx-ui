import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';
import { BehaviorSubject, of } from 'rxjs';
import { ConfigService } from '../../../config/config.store';
import { Locations } from './locations';

describe('Locations', () => {
  it('displays labels for each location alongside existing list information', () => {
    TestBed.configureTestingModule({
      imports: [Locations],
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: ConfigService, useValue: { environment: () => ({ apiUrl: 'https://api.example' }) } },
        { provide: OAuthService, useValue: { getAccessToken: () => 'token' } },
        { provide: ActivatedRoute, useValue: {
          queryParamMap: of(convertToParamMap({})),
          parent: { paramMap: of(convertToParamMap({ name: 'project-a' })) },
        } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Locations);
    fixture.detectChanges();
    http.expectOne('https://api.example/project/project-a/locations').flush([
      { metadata: { name: 'fra1', labels: { region: 'eu-central', 'edgecdnx.com/tenant': 'project-a' } } },
      { metadata: { name: 'ams1' } },
    ]);
    http.expectOne('https://api.example/project/project-a/healthcheckprofiles').flush([]);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const rows = element.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(element.querySelector('thead')?.textContent).toContain('Labels');
    expect(rows[0].querySelector('app-location-labels')?.textContent).toContain('region=eu-central');
    expect(rows[0].textContent).toContain('edgecdnx.com/tenant=project-a');
    expect(rows[1].querySelector('app-location-labels')?.textContent).toContain('No labels');
    expect(rows[0].querySelector('a')?.getAttribute('href')).toBe('/projects/project-a/locations/fra1');
    expect(rows[0].textContent).toContain('Edit');
    const headers = element.querySelectorAll('thead th');
    for (const index of [4, 5]) {
      expect(headers[index].classList.contains('hidden')).toBeTrue();
      expect(headers[index].classList.contains('md:table-cell')).toBeTrue();
      expect(rows[0].children[index].classList.contains('hidden')).toBeTrue();
      expect(rows[0].children[index].classList.contains('md:table-cell')).toBeTrue();
    }
    expect(getComputedStyle(rows[0].children[0]).whiteSpace).toBe('nowrap');
    expect(getComputedStyle(rows[0].querySelector('app-location-labels ul')!).flexWrap).toBe('nowrap');
    fixture.destroy();
    http.verify();
  });

  it('restores multiple URL filters with AND matching and reacts to navigation changes', () => {
    const params = new BehaviorSubject(convertToParamMap({ label: ['region=eu', 'tier=edge', 'region=eu'] }));
    TestBed.configureTestingModule({
      imports: [Locations],
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: ConfigService, useValue: { environment: () => ({ apiUrl: 'https://api.example' }) } },
        { provide: OAuthService, useValue: { getAccessToken: () => 'token' } },
        { provide: ActivatedRoute, useValue: {
          queryParamMap: params,
          parent: { paramMap: of(convertToParamMap({ name: 'project-a' })) },
        } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Locations);
    fixture.detectChanges();
    http.expectOne('https://api.example/project/project-a/locations').flush([
      { metadata: { name: 'both', labels: { region: 'eu', tier: 'edge', empty: '' } } },
      { metadata: { name: 'region-only', labels: { region: 'eu', tier: 'origin' } } },
      { metadata: { name: 'tier-only', labels: { region: 'us', tier: 'edge' } } },
      { metadata: { name: 'unlabelled' } },
    ]);
    http.expectOne('https://api.example/project/project-a/healthcheckprofiles').flush([]);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(fixture.componentInstance.selectedLabels()).toEqual(['region=eu', 'tier=edge']);
    expect(element.querySelectorAll('tbody tr').length).toBe(1);
    expect(element.querySelector('tbody tr th')?.textContent).toContain('both');
    expect(element.querySelector('[aria-label="Active label filters"]')?.textContent).toContain('Matching all labels');
    expect(element.querySelector('[aria-label="Remove label filter region=eu"]')?.getAttribute('href')).toContain('label=tier%3Dedge');
    expect(fixture.componentInstance.withoutLabel('region=eu')).toEqual(['tier=edge']);
    params.next(convertToParamMap({ label: 'region=eu' }));
    fixture.detectChanges();
    expect(element.querySelectorAll('tbody tr').length).toBe(2);
    params.next(convertToParamMap({ label: 'empty=' }));
    fixture.detectChanges();
    expect(element.querySelectorAll('tbody tr').length).toBe(1);
    params.next(convertToParamMap({ label: 'missing=value' }));
    fixture.detectChanges();
    expect(element.querySelectorAll('tbody tr').length).toBe(0);
    expect(element.textContent).toContain('No locations match the selected labels.');
    params.next(convertToParamMap({}));
    fixture.detectChanges();
    expect(element.querySelectorAll('tbody tr').length).toBe(4);
    expect(element.querySelector('[aria-label="Active label filters"]')).toBeNull();
    fixture.destroy();
    http.verify();
  });
});

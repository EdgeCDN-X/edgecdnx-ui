import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { LocationLabels } from './location-labels';

@Component({ template: '' })
class FilterDestination {}

describe('LocationLabels', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [LocationLabels],
    providers: [provideRouter([{ path: 'projects/:name/locations', component: FilterDestination }])],
  }));

  it('shows sorted key/value badges including tenant and empty values', () => {
    TestBed.configureTestingModule({ imports: [LocationLabels] });
    const fixture = TestBed.createComponent(LocationLabels);
    fixture.componentRef.setInput('projectId', 'project-a');
    fixture.componentRef.setInput('labels', {
      region: 'eu-central', 'edgecdnx.com/tenant': 'project-a', empty: '',
    });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(Array.from(element.querySelectorAll('li'), (item) => item.textContent?.trim())).toEqual([
      'edgecdnx.com/tenant=project-a', 'empty=', 'region=eu-central',
    ]);
    fixture.componentRef.setInput('labels', { region: 'eu-west' });
    fixture.detectChanges();
    expect(element.querySelectorAll('li').length).toBe(1);
    expect(element.textContent).toContain('region=eu-west');
    fixture.destroy();
  });

  it('shows No labels for absent or empty labels', () => {
    TestBed.configureTestingModule({ imports: [LocationLabels] });
    const fixture = TestBed.createComponent(LocationLabels);
    fixture.componentRef.setInput('projectId', 'project-a');
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('No labels');
    fixture.componentRef.setInput('labels', {});
    fixture.detectChanges();
    expect(element.textContent).toContain('No labels');
    fixture.destroy();
  });

  it('toggles compact labels into a vertical list without changing their filter links', () => {
    const fixture = TestBed.createComponent(LocationLabels);
    fixture.componentRef.setInput('projectId', 'project-a');
    fixture.componentRef.setInput('compact', true);
    fixture.componentRef.setInput('labels', { region: 'eu', tier: 'edge' });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const button = element.querySelector<HTMLButtonElement>('button')!;
    const list = element.querySelector('ul')!;
    expect(button.textContent?.trim()).toBe('...');
    expect(button.classList.contains('md:hidden')).toBeTrue();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(list.classList.contains('hidden')).toBeTrue();
    expect(list.classList.contains('md:flex')).toBeTrue();
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(list.classList.contains('hidden')).toBeFalse();
    expect(list.classList.contains('flex-col')).toBeTrue();
    expect(list.classList.contains('md:flex-row')).toBeTrue();
    expect(list.querySelector('a')?.getAttribute('href')).toBe('/projects/project-a/locations?label=region%3Deu');
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(list.classList.contains('hidden')).toBeTrue();
    fixture.destroy();
  });

  it('links labels to the filtered list and toggles individual selections without dropping others', () => {
    const fixture = TestBed.createComponent(LocationLabels);
    fixture.componentRef.setInput('projectId', 'project-a');
    fixture.componentRef.setInput('labels', { region: 'eu', tier: 'edge' });
    fixture.componentRef.setInput('selectedLabels', ['region=eu', 'empty=']);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const region = element.querySelector('[aria-label="Filter locations by region=eu"]');
    const tier = element.querySelector('[aria-label="Filter locations by tier=edge"]');
    expect(region?.getAttribute('aria-current')).toBe('true');
    expect(region?.getAttribute('href')).toBe('/projects/project-a/locations?label=empty%3D');
    expect(tier?.getAttribute('href')).toBe('/projects/project-a/locations?label=region%3Deu&label=empty%3D&label=tier%3Dedge');
    fixture.componentRef.setInput('selectedLabels', ['region=eu']);
    fixture.detectChanges();
    expect(region?.getAttribute('href')).toBe('/projects/project-a/locations');
    fixture.destroy();
  });

  it('activates the URL filter when clicked while preserving unrelated query parameters', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/projects/project-a/locations?label=region%3Deu&view=table');
    const fixture = TestBed.createComponent(LocationLabels);
    fixture.componentRef.setInput('projectId', 'project-a');
    fixture.componentRef.setInput('labels', { tier: 'edge' });
    fixture.componentRef.setInput('selectedLabels', ['region=eu']);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector<HTMLAnchorElement>('a')!.click();
    await fixture.whenStable();
    const query = router.parseUrl(router.url).queryParams;
    expect(query['label']).toEqual(['region=eu', 'tier=edge']);
    expect(query['view']).toBe('table');
    fixture.destroy();
  });
});

import { TestBed } from '@angular/core/testing';
import { HealthCheckProfile } from '../../projects/store/healthcheckprofile.types';
import { LocationForm } from './location-form';

describe('NodeGroup health check profile dropdown', () => {
  const profiles: HealthCheckProfile[] = [
    { metadata: { name: 'web', labels: { 'project': 'project-a' } } },
    { metadata: { name: 'tcp', labels: { 'project': 'project-a' } } },
    { metadata: { name: 'foreign', labels: { 'project': 'project-b' } } },
    { metadata: { name: 'global', labels: { 'project': 'global' } } },
    { metadata: { name: 'unowned' } },
  ];

  function editor(healthCheck = '') {
    const fixture = TestBed.createComponent(LocationForm);
    fixture.componentRef.setInput('projectId', 'project-a');
    fixture.componentRef.setInput('availableProfiles', profiles);
    fixture.componentRef.setInput('location', {
      metadata: { name: 'fra1' },
      spec: { nodeGroups: [{ name: 'nginx', flavor: '', ...(healthCheck ? { healthCheck: { name: healthCheck } } : {}) }] },
    });
    fixture.detectChanges();
    return fixture;
  }

  it('shows only current-project profiles and saves the selected NodeGroup reference', () => {
    const fixture = editor('web');
    const element: HTMLElement = fixture.nativeElement;
    const select = element.querySelector<HTMLSelectElement>('#group-health-0')!;
    expect(select.tagName).toBe('SELECT');
    expect(select.closest('details')).toBeNull();
    expect(select.getBoundingClientRect().height).toBeGreaterThan(0);
    expect(Array.from(select.options).map((option) => option.value)).toEqual(['', 'tcp', 'web']);
    expect(select.value).toBe('web');
    const submitted = jasmine.createSpy('submitted');
    fixture.componentInstance.submitted.subscribe(submitted);
    select.value = 'tcp';
    select.dispatchEvent(new Event('change'));
    fixture.componentInstance.submit();
    expect(submitted.calls.mostRecent().args[0].nodeGroups[0].healthCheck).toEqual({ name: 'tcp' });
    select.value = '';
    select.dispatchEvent(new Event('change'));
    fixture.componentInstance.submit();
    expect(submitted.calls.mostRecent().args[0].nodeGroups[0].healthCheck).toBeUndefined();
  });

  it('rejects missing or foreign references, including on newly added groups', () => {
    const fixture = editor('foreign');
    const component = fixture.componentInstance;
    const submitted = jasmine.createSpy('submitted');
    component.submitted.subscribe(submitted);
    component.submit();
    expect(submitted).not.toHaveBeenCalled();
    expect(component.form.controls.nodeGroups.at(0).controls.healthCheck.hasError('unavailable')).toBeTrue();
    component.form.controls.nodeGroups.at(0).controls.healthCheck.setValue('');
    component.addGroup();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    const addedSelect = fixture.nativeElement.querySelector('#group-health-1') as HTMLSelectElement;
    expect(addedSelect.closest('details')).toBeNull();
    expect(addedSelect.getBoundingClientRect().height).toBeGreaterThan(0);
    const group = component.form.controls.nodeGroups.at(1);
    group.controls.name.setValue('new-group');
    group.controls.healthCheck.setValue('missing');
    component.submit();
    expect(submitted).not.toHaveBeenCalled();
    group.controls.healthCheck.setValue('web');
    component.submit();
    expect(submitted).toHaveBeenCalledTimes(1);
  });

  it('updates choices and validation when project profiles change', () => {
    const fixture = editor('web');
    fixture.componentRef.setInput('availableProfiles', []);
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.nodeGroups.at(0).controls.healthCheck.hasError('unavailable')).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('No health check profiles are available in this project.');
    fixture.componentRef.setInput('availableProfiles', profiles);
    fixture.componentRef.setInput('projectId', 'project-b');
    fixture.detectChanges();
    expect(fixture.componentInstance.profileOptions()).toEqual(['foreign']);
    expect(fixture.componentInstance.form.controls.nodeGroups.at(0).controls.healthCheck.invalid).toBeTrue();
  });
});

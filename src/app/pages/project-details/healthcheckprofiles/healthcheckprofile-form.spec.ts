import { TestBed } from '@angular/core/testing';
import { HealthCheckProfileForm } from './healthcheckprofile-form';

describe('HealthCheckProfileForm', () => {
  it('shows validation, emits a create DTO, and disables controls while saving', () => {
    const fixture = TestBed.createComponent(HealthCheckProfileForm);
    fixture.componentRef.setInput('projectId', 'project-a');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-location-kv-builder')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('edgecdnx.com/tenant=project-a');
    const component = fixture.componentInstance;
    const stack = fixture.nativeElement.querySelector('#probe-stack-0') as HTMLSelectElement;
    expect(stack.value).toBe('Dual');
    expect(Array.from(stack.options).map((option) => option.value)).toEqual(['Dual', 'IPv4', 'IPv6']);
    const submitted = jasmine.createSpy('submitted');
    component.submitted.subscribe(submitted);
    component.submit();
    fixture.detectChanges();
    expect(submitted).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    component.form.controls.name.setValue('web');
    component.form.controls.probes.at(0).controls.name.setValue('tcp');
    component.submit();
    expect(submitted).toHaveBeenCalledWith({
      name: 'web', probes: [{ name: 'tcp', type: 'TCP', tcp: { port: 80, target: '', stack: 'Dual' } }],
    });
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    expect(component.form.disabled).toBeTrue();
    component.submit();
    expect(submitted).toHaveBeenCalledTimes(1);
  });

  it('locks the name when editing and displays protocol-specific fields', () => {
    const fixture = TestBed.createComponent(HealthCheckProfileForm);
    fixture.componentRef.setInput('projectId', 'project-a');
    fixture.componentRef.setInput('profile', {
      metadata: { name: 'web' },
      spec: { probes: [{ name: 'https', type: 'HTTP', http: { protocol: 'https', path: '/health' } }] },
    });
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.name.disabled).toBeTrue();
    expect(fixture.nativeElement.querySelector('#probe-protocol-0')).not.toBeNull();
    fixture.componentInstance.form.controls.probes.at(0).controls.type.setValue('ASSUME');
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#probe-protocol-0')).toBeNull();
    expect(fixture.nativeElement.querySelector('#probe-status-0')).not.toBeNull();
  });
});

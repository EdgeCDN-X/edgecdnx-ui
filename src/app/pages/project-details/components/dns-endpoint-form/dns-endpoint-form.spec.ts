import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DNSEndpointForm } from './dns-endpoint-form';
import { DNSEndpointStore } from '../../../projects/store/dns-endpoint.store';
import { LocationStore } from '../../../projects/store/location.store';
import { ProjectLocation } from '../../../projects/store/location.types';
import { DNSEndpoint, DNSEndpointActionError } from '../../../projects/store/dns-endpoint.types';
import { keyValueForm, tenantLabelKey } from '../../locations/location-form.model';

describe('DNSEndpointForm routing', () => {
  const endpoint: DNSEndpoint = {
    kind: 'DNSEndpoint',
    apiVersion: 'infrastructure.edgecdnx.com/v1alpha1',
    metadata: { name: 'www-a', namespace: 'edgecdnx' },
    spec: {
      dnsName: 'www.example.com',
      routingPolicy: 'Simple',
      recordType: 'A',
      recordTTL: 300,
      targets: ['192.0.2.1'],
    },
  };

  function setup(existing: DNSEndpoint | null = null, loadError = false) {
    const store = {
      saving: signal(false),
      error: signal<DNSEndpointActionError | null>(null),
      clearError: jasmine.createSpy('clearError'),
      create: jasmine.createSpy('create').and.returnValue(of(endpoint)),
      update: jasmine.createSpy('update').and.returnValue(of(endpoint)),
    };
    const locationStore = {
      locations: signal<ProjectLocation[]>([
        { metadata: { name: 'fra1', labels: { [tenantLabelKey]: 'project-a' } } },
        { metadata: { name: 'ams1', labels: { [tenantLabelKey]: 'project-a' } } },
        { metadata: { name: 'foreign', labels: { [tenantLabelKey]: 'project-b' } } },
        { metadata: { name: 'global', labels: { [tenantLabelKey]: 'global' } } },
      ]),
      loading: signal(false),
      error: signal<string | null>(loadError ? 'Unable to load locations.' : null),
      load: jasmine.createSpy('load').and.returnValue(loadError
        ? throwError(() => new Error('Unable to load locations.'))
        : of([])),
    };
    TestBed.configureTestingModule({ providers: [
      { provide: DNSEndpointStore, useValue: store },
      { provide: LocationStore, useValue: locationStore },
    ] });
    const fixture = TestBed.createComponent(DNSEndpointForm);
    fixture.componentRef.setInput('projectId', 'project-a');
    fixture.componentRef.setInput('zoneName', 'example.com');
    fixture.componentRef.setInput('dnsEndpoint', existing);
    fixture.detectChanges();
    return { fixture, form: fixture.componentInstance, store, locationStore };
  }

  it('offers every CRD policy with Simple as the default', () => {
    const { fixture, form } = setup();
    const select = fixture.nativeElement.querySelector('#routing-policy') as HTMLSelectElement;
    expect(form.form.controls.routingPolicy.value).toBe('Simple');
    expect(Array.from(select.options).map((option) => option.value))
      .toEqual(['Simple', 'RoundRobin', 'Weighted', 'Geolocation', 'Failover']);
    expect(select.options[2].textContent).toBe('Weighted Round Robin');
    expect(fixture.nativeElement.querySelector('app-location-kv-builder')).toBeNull();
  });

  for (const policy of ['RoundRobin', 'Weighted', 'Geolocation'] as const) {
    it(`creates ${policy} records using a locked tenant and matchLabels without targets`, () => {
      const { fixture, form, store } = setup();
      form.form.controls.routingPolicy.setValue(policy);
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      const tenantKey = fixture.nativeElement.querySelector('#route-selector-locked-key-0') as HTMLInputElement;
      const tenantValue = fixture.nativeElement.querySelector('#route-selector-locked-value-0') as HTMLInputElement;
      expect(tenantKey.value).toBe(tenantLabelKey);
      expect(tenantValue.value).toBe('project-a');
      expect(tenantKey.disabled).toBeTrue();
      expect(tenantValue.disabled).toBeTrue();
      expect(fixture.nativeElement.querySelector('#record-targets')).toBeNull();
      form.form.controls.routeLabels.push(keyValueForm('region', 'eu'));
      const saved = jasmine.createSpy('saved');
      form.saved.subscribe(saved);
      form.submit();
      expect(store.create).toHaveBeenCalledOnceWith('project-a', 'example.com', {
        dnsName: 'example.com',
        routingPolicy: policy,
        recordTTL: 300,
        recordType: 'A',
        targets: [],
        routeSelector: { matchLabels: { region: 'eu', [tenantLabelKey]: 'project-a' } },
      });
      expect(saved).toHaveBeenCalledTimes(1);
    });
  }

  it('permits selecting all locations in the project using only the managed tenant', () => {
    const { form, store } = setup();
    form.form.controls.routingPolicy.setValue('RoundRobin');
    form.submit();
    expect(store.create.calls.mostRecent().args[2].routeSelector)
      .toEqual({ matchLabels: { [tenantLabelKey]: 'project-a' } });
  });

  for (const policy of ['Simple'] as const) {
    it(`requires and submits explicit targets for ${policy}`, () => {
      const { form, store } = setup();
      form.form.controls.routingPolicy.setValue(policy);
      form.submit();
      expect(store.create).not.toHaveBeenCalled();
      form.form.controls.targets.setValue('192.0.2.1\n192.0.2.2');
      form.submit();
      expect(store.create.calls.mostRecent().args[2]).toEqual({
        dnsName: 'example.com', routingPolicy: policy, recordTTL: 300, recordType: 'A',
        targets: ['192.0.2.1', '192.0.2.2'], routeSelector: null,
      });
    });
  }

  it('offers sorted project locations and submits the selected primary location for Failover', () => {
    const { fixture, form, store, locationStore } = setup();
    form.form.controls.routingPolicy.setValue('Failover');
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(locationStore.load).toHaveBeenCalledOnceWith('project-a');
    const select = fixture.nativeElement.querySelector('#failover-location') as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.value)).toEqual(['', 'ams1', 'fra1']);
    expect(fixture.nativeElement.querySelector('#record-targets')).toBeNull();
    form.submit();
    expect(store.create).not.toHaveBeenCalled();
    select.value = 'fra1';
    select.dispatchEvent(new Event('change'));
    form.submit();
    expect(store.create.calls.mostRecent().args[2]).toEqual({
      dnsName: 'example.com', routingPolicy: 'Failover', recordTTL: 300, recordType: 'A',
      targets: ['fra1'], routeSelector: null,
    });
  });

  it('pre-selects and preserves an existing Failover primary location', () => {
    const { fixture, form, store } = setup({
      ...endpoint, spec: { ...endpoint.spec, routingPolicy: 'Failover', targets: ['ams1'] },
    });
    expect((fixture.nativeElement.querySelector('#failover-location') as HTMLSelectElement).value).toBe('ams1');
    form.submit();
    expect(store.update.calls.mostRecent().args[3].targets).toEqual(['ams1']);
  });

  it('blocks missing, foreign, and removed locations', () => {
    const { fixture, form, store, locationStore } = setup();
    form.form.controls.routingPolicy.setValue('Failover');
    for (const location of ['', 'foreign', 'global', 'deleted']) {
      form.form.controls.failoverLocation.setValue(location);
      form.submit();
      expect(store.create).not.toHaveBeenCalled();
    }
    form.form.controls.failoverLocation.setValue('fra1');
    locationStore.locations.set([]);
    fixture.detectChanges();
    form.submit();
    expect(store.create).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('No locations are available');
  });

  it('blocks Failover submission while locations load and resumes after loading', () => {
    const { fixture, form, store, locationStore } = setup();
    locationStore.loading.set(true);
    form.form.controls.routingPolicy.setValue('Failover');
    form.form.controls.failoverLocation.setValue('fra1');
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading locations...');
    form.submit();
    expect(store.create).not.toHaveBeenCalled();
    locationStore.loading.set(false);
    fixture.detectChanges();
    form.submit();
    expect(store.create).toHaveBeenCalled();
  });

  it('surfaces location load errors and blocks Failover without blocking Simple', () => {
    const { fixture, form, store } = setup(null, true);
    form.form.controls.routingPolicy.setValue('Failover');
    form.form.controls.failoverLocation.setValue('fra1');
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Unable to load locations.');
    form.submit();
    expect(store.create).not.toHaveBeenCalled();
    form.form.controls.routingPolicy.setValue('Simple');
    form.form.controls.targets.setValue('192.0.2.1');
    form.submit();
    expect(store.create).toHaveBeenCalled();
  });

  it('does not serialize a Failover location as an MX, TXT, or SRV value', () => {
    const { fixture, form, store } = setup();
    form.form.controls.routingPolicy.setValue('Failover');
    form.form.controls.failoverLocation.setValue('ams1');
    const select = fixture.nativeElement.querySelector('#record-type') as HTMLSelectElement;
    for (const recordType of ['MX', 'TXT', 'SRV']) {
      select.value = recordType;
      select.dispatchEvent(new Event('change'));
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('#record-priority')).toBeNull();
      expect(fixture.nativeElement.querySelector('#srv-target-0')).toBeNull();
      form.submit();
      expect(store.create.calls.mostRecent().args[2].targets).toEqual(['ams1']);
    }
  });

  for (const rows of [
    [keyValueForm('', 'eu')],
    [keyValueForm('region', 'eu'), keyValueForm('region', 'us')],
    [keyValueForm(tenantLabelKey, 'project-b')],
    [keyValueForm('bad/key/name', 'eu')],
    [keyValueForm('region', 'bad value')],
  ]) {
    it('blocks invalid, duplicate, or reserved selector labels', () => {
      const { form, store } = setup();
      form.form.controls.routingPolicy.setValue('Weighted');
      rows.forEach((row) => form.form.controls.routeLabels.push(row));
      form.submit();
      expect(store.create).not.toHaveBeenCalled();
      expect(form.form.controls.routeLabels.invalid).toBeTrue();
    });
  }

  it('loads and preserves an existing selector and policy while editing', () => {
    const { form, store } = setup({
      ...endpoint,
      spec: { ...endpoint.spec, targets: [], routingPolicy: 'Geolocation',
        routeSelector: { matchLabels: { region: 'eu', [tenantLabelKey]: 'project-a' } } },
    });
    expect(form.form.controls.routeLabels.getRawValue()).toEqual([{ key: 'region', value: 'eu' }]);
    expect(form.form.controls.recordType.disabled).toBeTrue();
    form.submit();
    expect(store.update.calls.mostRecent().args[3]).toEqual({
      dnsName: 'www.example.com', recordTTL: 300, recordType: 'A', routingPolicy: 'Geolocation',
      targets: [], routeSelector: { matchLabels: { region: 'eu', [tenantLabelKey]: 'project-a' } },
    });
  });

  it('does not silently drop existing match expressions', () => {
    const { fixture, form, store } = setup({
      ...endpoint,
      spec: { ...endpoint.spec, routingPolicy: 'RoundRobin',
        routeSelector: { matchExpressions: [{ key: 'region', operator: 'Exists' }] } },
    });
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('match expressions');
    form.submit();
    expect(store.update).not.toHaveBeenCalled();
  });

  it('clears selectors when switching to static routing and ignores hidden label errors', () => {
    const { form, store } = setup();
    form.form.controls.routingPolicy.setValue('RoundRobin');
    form.form.controls.routeLabels.push(keyValueForm('bad/key/name', 'eu'));
    form.form.controls.routingPolicy.setValue('Simple');
    form.form.controls.targets.setValue('192.0.2.1');
    form.submit();
    expect(store.create.calls.mostRecent().args[2].routeSelector).toBeNull();
  });

  it('does not validate hidden SRV fields for selector routing', () => {
    const { fixture, form, store } = setup();
    form.form.controls.routingPolicy.setValue('Weighted');
    const select = fixture.nativeElement.querySelector('#record-type') as HTMLSelectElement;
    select.value = 'SRV';
    select.dispatchEvent(new Event('change'));
    form.submit();
    expect(store.create).toHaveBeenCalled();
    form.form.controls.routingPolicy.setValue('Simple');
    expect(form.srvRecords.invalid).toBeTrue();
  });

  it('preserves MX and TXT target serialization', () => {
    const { form, store } = setup();
    form.form.controls.recordType.setValue('MX');
    form.form.controls.targets.setValue('mail.example.net.');
    form.submit();
    expect(store.create.calls.mostRecent().args[2].targets).toEqual(['10 mail.example.net.']);
    form.form.controls.recordType.setValue('TXT');
    form.form.controls.targets.setValue('text value');
    form.submit();
    expect(store.create.calls.mostRecent().args[2].targets).toEqual(['"text value"']);
  });

  it('does not submit again while saving', () => {
    const { form, store } = setup();
    form.form.controls.routingPolicy.setValue('RoundRobin');
    store.saving.set(true);
    form.submit();
    expect(store.create).not.toHaveBeenCalled();
  });
});

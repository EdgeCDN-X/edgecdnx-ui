import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConfigService, DNSNameserver } from '../../../../config/config.store';
import { ZoneResolve } from './zone-resolve';

describe('ZoneResolve', () => {
  const servers: DNSNameserver[] = [
    { ns: 'ns1.example.com', routeResolver: 'https://router1.example.com/route' },
    { ns: 'ns2.example.com', routeResolver: 'https://router2.example.com/route' },
  ];

  function setup(nameservers = servers) {
    const environment = signal({ apiUrl: 'https://api.example.com/', dnsNameservers: nameservers });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigService, useValue: { environment } },
      ],
    });
    const fixture = TestBed.createComponent(ZoneResolve);
    fixture.componentRef.setInput('domain', 'app.example.com');
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      http: TestBed.inject(HttpTestingController),
      element: fixture.nativeElement as HTMLElement,
    };
  }

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('queries all nameservers separately, forwards source IP, and keeps partial successes', () => {
    const { component, http, fixture, element } = setup();
    fixture.componentRef.setInput('routingPolicy', 'Geolocation');
    component.sourceIP = ' 85.216.128.10 ';
    component.resolve();
    const requests = http.match('https://api.example.com/utils/resolve');
    expect(requests.length).toBe(2);
    requests.forEach((request, i) => {
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({
        ns: servers[i].routeResolver,
        domain: 'app.example.com',
        record_type: 'A',
        source_ip: '85.216.128.10',
      });
    });
    requests[0].flush({
      domain: 'app.example.com.', source_ip: '85.216.128.10',
      response: {
        rcode: 'NOERROR',
        answer: [{ name: 'app.example.com.', type: 'A', class: 'IN', ttl: 5, data: '192.0.2.1' }],
        authority: [{ name: 'example.com.', type: 'NS', class: 'IN', ttl: 30, data: 'ns1.example.com.' }],
        additional: [{ name: 'ns1.example.com.', type: 'AAAA', class: 'IN', ttl: 60, data: '2001:db8::1' }],
      },
    });
    expect(component.loading()).toBeTrue();
    requests[1].flush({ error: 'failed to query DNS' }, { status: 502, statusText: 'Bad Gateway' });
    fixture.detectChanges();
    expect(component.loading()).toBeFalse();
    expect(element.textContent).toContain('192.0.2.1');
    expect(element.textContent).toContain('HTTP 502: failed to query DNS');
    expect(element.textContent).toContain('ns1.example.com');
    expect(element.textContent).toContain('ns2.example.com');
    const rows = element.querySelectorAll('table tbody tr');
    expect(rows.length).toBe(3);
    expect(Array.from(rows[0].querySelectorAll('td'), cell => cell.textContent?.trim()))
      .toEqual(['Answer', 'app.example.com.', 'A', 'IN', '5', '192.0.2.1']);
    expect(rows[1].textContent).toContain('Authority');
    expect(rows[2].textContent).toContain('Additional');
    expect(element.querySelector('dl')?.textContent).toContain('NOERROR');
  });

  it('queries a selected nameserver and omits an empty source IP', () => {
    const { component, http, fixture, element } = setup();
    component.selectedNS = 'ns2.example.com';
    component.sourceIP = '85.216.128.10';
    expect(element.querySelector('#resolve-source-ip')).toBeNull();
    component.resolve();
    const request = http.expectOne('https://api.example.com/utils/resolve');
    expect(request.request.body).toEqual({
      ns: servers[1].routeResolver, domain: 'app.example.com', record_type: 'A',
    });
    request.flush({ response: { rcode: 'NXDOMAIN', answer: [] } });
    expect(component.results()[0].error).toBeUndefined();
    expect(component.loading()).toBeFalse();
    fixture.detectChanges();
    expect(element.querySelector('table tbody')?.textContent).toContain('No DNS records returned (NXDOMAIN)');
  });

  it('requires a valid source IP for Geolocation and accepts IPv6', () => {
    const { component, http, fixture, element } = setup();
    fixture.componentRef.setInput('routingPolicy', 'Geolocation');
    fixture.detectChanges();
    expect(element.querySelector('#resolve-source-ip')).not.toBeNull();
    component.selectedNS = 'ns1.example.com';
    for (const value of ['', 'invalid', '256.1.1.1', '1.2.3.4/32', '1.2.3.4:80']) {
      component.sourceIP = value;
      component.resolve();
      expect(component.error()).toContain('valid source IPv4 or IPv6');
      http.expectNone('https://api.example.com/utils/resolve');
    }
    component.sourceIP = '2001:db8::1';
    component.resolve();
    const request = http.expectOne('https://api.example.com/utils/resolve');
    expect(request.request.body.source_ip).toBe('2001:db8::1');
    expect(request.request.body.record_type).toBe('A');
    request.flush({ response: { rcode: 'NOERROR', answer: [] } });
  });

  it('requires a valid host prefix for wildcard entries and sends the concrete FQDN', () => {
    const { component, http, fixture, element } = setup();
    fixture.componentRef.setInput('domain', '*.example.com');
    fixture.detectChanges();
    expect(element.querySelector('#resolve-host')).not.toBeNull();
    component.selectedNS = 'ns1.example.com';
    for (const host of ['', '*', '-bad', 'bad.', 'https://www', 'a'.repeat(64)]) {
      component.additionalHost = host;
      component.resolve();
      expect(component.error()).toContain('valid additional host');
      http.expectNone('https://api.example.com/utils/resolve');
    }
    component.additionalHost = ' api.eu ';
    component.resolve();
    const request = http.expectOne('https://api.example.com/utils/resolve');
    expect(request.request.body.domain).toBe('api.eu.example.com');
    expect(request.request.body.source_ip).toBeUndefined();
    request.flush({ response: { rcode: 'NOERROR', answer: [] } });
  });

  it('requires IPv6 for Geolocation AAAA records but hides IP for Simple AAAA records', () => {
    const { component, http, fixture, element } = setup();
    fixture.componentRef.setInput('recordType', 'AAAA');
    fixture.detectChanges();
    expect(element.querySelector('#resolve-source-ip')).toBeNull();
    fixture.componentRef.setInput('routingPolicy', 'Geolocation');
    fixture.detectChanges();
    expect(element.querySelector('label[for="resolve-source-ip"]')?.textContent).toContain('IPv6');
    component.selectedNS = 'ns1.example.com';
    for (const value of ['', '85.216.128.10', 'invalid', '2001:db8::xyz']) {
      component.sourceIP = value;
      component.resolve();
      expect(component.error()).toContain('valid source IPv6');
      http.expectNone('https://api.example.com/utils/resolve');
    }
    component.sourceIP = '2001:db8::1';
    component.resolve();
    const request = http.expectOne('https://api.example.com/utils/resolve');
    expect(request.request.body.source_ip).toBe('2001:db8::1');
    expect(request.request.body.record_type).toBe('AAAA');
    request.flush({ response: { rcode: 'NOERROR', answer: [] } });
  });

  for (const recordType of ['TXT', 'CNAME', 'SRV', 'MX', 'NS'] as const) {
    it(`queries and displays ${recordType} records using the selected type`, () => {
      const { component, http, fixture, element } = setup();
      fixture.componentRef.setInput('recordType', recordType);
      fixture.componentRef.setInput('domain', recordType === 'SRV' ? '_sip._tcp.example.com' : 'app.example.com');
      component.selectedNS = 'ns1.example.com';
      component.resolve();
      const request = http.expectOne('https://api.example.com/utils/resolve');
      expect(request.request.body.record_type).toBe(recordType);
      expect(request.request.body.source_ip).toBeUndefined();
      request.flush({ response: { rcode: 'NOERROR', answer: [{
        name: request.request.body.domain, type: recordType, class: 'IN', ttl: 60,
        data: recordType === 'TXT' ? '"verification text"' : 'target.example.com.',
      }] } });
      fixture.detectChanges();
      const cells = element.querySelectorAll('table tbody tr td');
      expect(cells[2].textContent).toBe(recordType);
      expect(cells[5].textContent).toContain(recordType === 'TXT' ? '"verification text"' : 'target.example.com.');
    });
  }

  it('reports malformed DNS responses instead of showing an empty successful table', () => {
    const { component, http, fixture, element } = setup();
    component.selectedNS = 'ns1.example.com';
    component.resolve();
    http.expectOne('https://api.example.com/utils/resolve').flush({
      response: { rcode: 'NOERROR', answer: [{ data: 'missing record fields' }] },
    });
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Invalid DNS response');
    expect(element.querySelector('table')).toBeNull();
    expect(component.loading()).toBeFalse();
  });
  it('blocks lookup when nameservers are missing', () => {
    const { component, element, http } = setup([]);
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBeTrue();
    component.resolve();
    expect(component.error()).toContain('No API or nameservers');
    http.expectNone('https://api.example.com/utils/resolve');
  });

  it('reports invalid resolver configuration instead of querying a guessed endpoint', () => {
    const { component, http } = setup([{ ns: 'ns1.example.com', routeResolver: 'not-a-url' }]);
    component.resolve();
    expect(component.error()).toContain('routeResolver URL');
    http.expectNone('https://api.example.com/utils/resolve');
  });

  it('cancels outstanding requests when the modal component is destroyed', () => {
    const { component, http, fixture } = setup();
    component.selectedNS = 'ns1.example.com';
    component.resolve();
    const request = http.expectOne('https://api.example.com/utils/resolve');
    fixture.destroy();
    expect(request.cancelled).toBeTrue();
  });
});

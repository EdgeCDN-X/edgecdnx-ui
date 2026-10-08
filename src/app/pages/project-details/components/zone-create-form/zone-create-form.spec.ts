import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConfigService, Environment } from '../../../../config/config.store';
import { ZoneStore } from '../../../projects/store/zone.store';
import { ZoneCreateForm } from './zone-create-form';

describe('ZoneCreateForm delegation', () => {
  const config: Environment = {
    production: false,
    apiUrl: 'https://api.example.com',
    dnsNameservers: ['ns1.demo.edgecdnx.com', 'ns2.example.com'],
    auth: {
      oidc: {
        issuer: 'https://auth.example.com',
        token: 'https://auth.example.com/token',
        clientId: 'edgecdnx',
        scope: 'openid',
        requireHttps: true,
        redirectUri: 'https://example.com/callback',
      },
      allowSignup: false,
      adminGroups: [],
    },
  };

  function setup(initialConfig: Environment | null = config) {
    const environment = signal(initialConfig);
    const zoneStore = {
      creating: signal(false),
      created: signal(false),
      error: signal(null),
      resetCreate: jasmine.createSpy('resetCreate'),
      createZone: jasmine.createSpy('createZone'),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ConfigService, useValue: { environment } },
        { provide: ZoneStore, useValue: zoneStore },
      ],
    });
    const fixture = TestBed.createComponent(ZoneCreateForm);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    return { fixture, element, environment, zoneStore };
  }

  it('explains domain and subzone delegation and renders all runtime nameservers', () => {
    const { fixture, element, environment } = setup();
    expect(element.textContent).toContain('At your domain registrar');
    expect(element.textContent).toContain('create an NS record');
    expect(element.textContent).toContain("Do not change the parent domain's nameservers.");
    expect(element.textContent).toContain('Creating a zone does not automatically delegate');
    const records = () => Array.from(
      element.querySelectorAll('[aria-label="Delegation nameservers"] li'),
      record => record.textContent?.trim(),
    );
    expect(records()).toEqual(['NS ns1.demo.edgecdnx.com', 'NS ns2.example.com']);
    environment.set({ ...config, dnsNameservers: ['ns.production.example.com'] });
    fixture.detectChanges();
    expect(records()).toEqual(['NS ns.production.example.com']);
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('updates suggested records while typing and places guidance below email', () => {
    const { fixture, element } = setup();
    const input = element.querySelector<HTMLInputElement>('#zone')!;
    const email = element.querySelector<HTMLInputElement>('#email')!;
    const section = element.querySelector('section[aria-labelledby="delegation-title"]')!;
    expect(email.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    for (const domain of ['random.mydomain.com', 'another.example.com', 'example.com']) {
      input.value = domain;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(Array.from(
        element.querySelectorAll('[aria-label="Delegation nameservers"] li'),
        record => record.textContent?.trim(),
      )).toEqual([
        `${domain} NS ns1.demo.edgecdnx.com`,
        `${domain} NS ns2.example.com`,
      ]);
    }

    for (const domain of ['', 'invalid']) {
      input.value = domain;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(section.textContent).toContain('Enter a valid Zone Domain');
      expect(element.querySelector('[aria-label="Delegation nameservers"] li')?.textContent?.trim())
        .toBe('NS ns1.demo.edgecdnx.com');
    }
  });

  it('warns when nameservers are absent or empty without hardcoded demo records', () => {
    const { fixture, element, environment } = setup(null);
    for (const value of [null, { ...config, dnsNameservers: undefined }, { ...config, dnsNameservers: [] }]) {
      environment.set(value);
      fixture.detectChanges();
      expect(element.querySelector('[role="alert"]')?.textContent)
        .toContain('Delegation nameservers are not configured');
      expect(element.querySelector('[aria-label="Delegation nameservers"]')).toBeNull();
      expect(element.textContent).not.toContain('ns1.demo.edgecdnx.com');
    }
  });

  it('preserves form validation, creation payload and the created event', () => {
    const { fixture, element, zoneStore } = setup();
    const button = element.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(button.disabled).toBeTrue();
    expect(zoneStore.resetCreate).toHaveBeenCalled();
    fixture.componentInstance.zoneCreateForm.setValue({
      zone: 'cdn.example.com',
      email: 'dns@example.com',
    });
    fixture.detectChanges();
    expect(button.disabled).toBeFalse();
    button.click();
    expect(zoneStore.createZone).toHaveBeenCalledOnceWith({
      zone: 'cdn.example.com',
      email: 'dns@example.com',
    });
    const onCreated = jasmine.createSpy('onCreated');
    fixture.componentInstance.onZoneCreated.subscribe(onCreated);
    zoneStore.created.set(true);
    fixture.detectChanges();
    expect(onCreated).toHaveBeenCalledOnceWith({ name: 'cdn.example.com' });
    expect(element.textContent).toContain('Zone created successfully');
  });
});

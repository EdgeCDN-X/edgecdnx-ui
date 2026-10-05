import { HealthCheckProbe, HealthCheckProfile } from '../../projects/store/healthcheckprofile.types';
import { createHealthCheckProfileForm, healthCheckProfileDtoFromForm, probeForm } from './healthcheckprofile-form.model';

describe('Health check profile form', () => {
  it('defaults new probes and saved probes with omitted or empty stacks to Dual', () => {
    expect(probeForm().controls.stack.value).toBe('Dual');
    const probes: HealthCheckProbe[] = [
      { name: 'tcp', type: 'TCP', tcp: { port: 80 } },
      { name: 'http', type: 'HTTP', http: { protocol: 'https', stack: '' } },
      { name: 'static', type: 'ASSUME', assume: { status: 'Healthy' } },
    ];
    const form = createHealthCheckProfileForm({ metadata: { name: 'web' }, spec: { probes } });
    const dto = healthCheckProfileDtoFromForm(form);
    for (const probe of dto.probes) {
      const stack = probe.type === 'TCP' ? probe.tcp.stack : probe.type === 'HTTP' ? probe.http.stack : probe.assume.stack;
      expect(stack).toBe('Dual');
    }
  });

  const profile: HealthCheckProfile = {
    metadata: { name: 'web', labels: { 'edgecdnx.com/tenant': 'project-a', region: 'eu' } },
    spec: { probes: [
      { name: 'tcp', type: 'TCP', interval: '30s', timeout: '5s', tcp: { port: 443, target: 'example.com', stack: 'Dual' } },
      { name: 'https', type: 'HTTP', http: { protocol: 'https', port: 8443, path: '/health', host: 'example.com', stack: 'IPv6' } },
      { name: 'static', type: 'ASSUME', assume: { status: 'Unhealthy', stack: 'IPv4' } },
    ] },
  };

  it('round-trips all probe settings without configurable labels', () => {
    const form = createHealthCheckProfileForm(profile);
    const dto = healthCheckProfileDtoFromForm(form);
    expect(Object.keys(dto)).toEqual(['probes']);
    expect(Object.keys(form.controls)).not.toContain('labels');
    expect(dto.probes[0]).toEqual(profile.spec!.probes![0]);
    expect(dto.probes[1]).toEqual({ name: 'https', type: 'HTTP', http: { protocol: 'https', port: 8443, target: '', path: '/health', host: 'example.com', stack: 'IPv6' } });
    expect(dto.probes[2]).toEqual(profile.spec!.probes![2]);
  });

  it('requires a valid name and at least one uniquely named probe', () => {
    const form = createHealthCheckProfileForm();
    expect(() => healthCheckProfileDtoFromForm(form)).toThrow();
    form.controls.name.setValue('web');
    form.controls.probes.clear();
    expect(() => healthCheckProfileDtoFromForm(form)).toThrow();
    const probe = probeForm();
    probe.controls.name.setValue('tcp');
    form.controls.probes.push(probe);
    expect(form.valid).toBeTrue();
    form.controls.probes.push(probeForm({ name: 'tcp', type: 'TCP', tcp: { port: 80 } }));
    expect(form.controls.probes.hasError('duplicate')).toBeTrue();
  });

  it('validates TCP/HTTP port ranges and ignores inactive probe configuration', () => {
    const probe = probeForm({ name: 'tcp', type: 'TCP', tcp: { port: 80 } });
    probe.controls.port.setValue(0);
    expect(probe.invalid).toBeTrue();
    probe.controls.type.setValue('HTTP');
    expect(probe.valid).toBeTrue();
    probe.controls.port.setValue(65536);
    expect(probe.invalid).toBeTrue();
    probe.controls.port.setValue(1.5);
    expect(probe.invalid).toBeTrue();
    probe.controls.type.setValue('ASSUME');
    expect(probe.valid).toBeTrue();
  });

  it('validates durations and emits only the selected type configuration', () => {
    const form = createHealthCheckProfileForm(profile);
    const probe = form.controls.probes.at(0);
    for (const duration of ['bad', '-5s', '30']) {
      probe.controls.interval.setValue(duration);
      expect(form.invalid).toBeTrue();
    }
    probe.controls.interval.setValue('1m30s');
    probe.controls.type.setValue('ASSUME');
    expect(healthCheckProfileDtoFromForm(form).probes[0]).toEqual({
      name: 'tcp', type: 'ASSUME', interval: '1m30s', timeout: '5s', assume: { status: 'Healthy', stack: 'Dual' },
    });
  });
});

import { FormArray, FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { HealthCheckProbe, HealthCheckProbeType, HealthCheckProfile, HealthCheckStack, UpdateHealthCheckProfileDto } from '../../projects/store/healthcheckprofile.types';

const text = (value = '', validators: ValidatorFn[] = []) => new FormControl(value, { nonNullable: true, validators });
const duration = Validators.pattern(/^(?:0|(?:[0-9]+(?:\.[0-9]+)?(?:ns|us|\u00b5s|\u03bcs|ms|s|m|h))+)$/);

export function probeForm(probe?: HealthCheckProbe) {
  const tcp = probe?.type === 'TCP' ? probe.tcp : undefined;
  const http = probe?.type === 'HTTP' ? probe.http : undefined;
  const assume = probe?.type === 'ASSUME' ? probe.assume : undefined;
  return new FormGroup({
    name: text(probe?.name, [Validators.required, Validators.pattern(/\S/)]),
    type: new FormControl<HealthCheckProbeType>(probe?.type ?? 'TCP', { nonNullable: true }),
    interval: text(probe?.interval, [duration]),
    timeout: text(probe?.timeout, [duration]),
    port: new FormControl(tcp?.port ?? http?.port ?? (probe?.type === 'HTTP' ? 0 : 80), { nonNullable: true }),
    target: text(tcp?.target ?? http?.target),
    stack: new FormControl<Exclude<HealthCheckStack, ''>>((tcp?.stack || http?.stack || assume?.stack) || 'Dual', { nonNullable: true, validators: [Validators.required] }),
    protocol: new FormControl<'http' | 'https'>(http?.protocol ?? 'http', { nonNullable: true }),
    path: text(http?.path ?? '/'),
    host: text(http?.host),
    status: new FormControl<'Healthy' | 'Unhealthy'>(assume?.status ?? 'Healthy', { nonNullable: true }),
  }, {
    validators: (control) => {
      if (control.get('type')?.value === 'ASSUME') return null;
      const port: unknown = control.get('port')?.value;
      const minimum = control.get('type')?.value === 'TCP' ? 1 : 0;
      return typeof port === 'number' && Number.isInteger(port) && port >= minimum && port <= 65535 ? null : { port: true };
    },
  });
}

export function createHealthCheckProfileForm(profile?: HealthCheckProfile) {
  return new FormGroup({
    name: text(profile?.metadata.name, [
      Validators.required, Validators.maxLength(253),
      Validators.pattern(/^[a-z0-9](?:[-a-z0-9]*[a-z0-9])?(?:\.[a-z0-9](?:[-a-z0-9]*[a-z0-9])?)*$/),
    ]),
    probes: new FormArray((profile?.spec?.probes ?? [undefined]).map(probeForm), [
      Validators.required,
      (control) => {
        const names = (control.value as { name: string }[]).map((probe) => probe.name);
        return new Set(names).size === names.length ? null : { duplicate: true };
      },
    ]),
  });
}

export function healthCheckProfileDtoFromForm(form: ReturnType<typeof createHealthCheckProfileForm>): UpdateHealthCheckProfileDto & { probes: HealthCheckProbe[] } {
  if (form.invalid) throw new Error('Check the profile name and probes. At least one uniquely named probe is required. Ports must be 1-65535 (HTTP may use 0 for the default port). Durations use Go syntax, e.g. 30s or 1m30s.');
  const value = form.getRawValue();
  const probes: HealthCheckProbe[] = value.probes.map((probe) => {
    const base = { name: probe.name, ...(probe.interval ? { interval: probe.interval } : {}), ...(probe.timeout ? { timeout: probe.timeout } : {}) };
    switch (probe.type) {
      case 'TCP': return { ...base, type: 'TCP', tcp: { port: probe.port, target: probe.target, stack: probe.stack } };
      case 'HTTP': return { ...base, type: 'HTTP', http: { protocol: probe.protocol, ...(probe.port ? { port: probe.port } : {}), target: probe.target, stack: probe.stack, path: probe.path, host: probe.host } };
      case 'ASSUME': return { ...base, type: 'ASSUME', assume: { status: probe.status, stack: probe.stack } };
    }
  });
  return { probes };
}

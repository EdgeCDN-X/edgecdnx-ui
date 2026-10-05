import { KubernetesObjectMeta } from '../../admin/store/admin.types';

export type HealthCheckStack = '' | 'IPv4' | 'IPv6' | 'Dual';
export type HealthCheckProbeType = 'TCP' | 'HTTP' | 'ASSUME';
export type HealthCheckProbe = {
  name: string;
  interval?: string;
  timeout?: string;
} & (
  | { type: 'TCP'; tcp: { port: number; target?: string; stack?: HealthCheckStack } }
  | { type: 'HTTP'; http: { protocol: 'http' | 'https'; port?: number; target?: string; path?: string; host?: string; stack?: HealthCheckStack } }
  | { type: 'ASSUME'; assume: { status: 'Healthy' | 'Unhealthy'; stack?: HealthCheckStack } }
);

export type UpdateHealthCheckProfileDto = {
  probes?: HealthCheckProbe[];
};
export type CreateHealthCheckProfileDto = {
  name: string;
  probes: HealthCheckProbe[];
};
export type HealthCheckProfile = {
  metadata: KubernetesObjectMeta & { name: string };
  spec?: { probes?: HealthCheckProbe[] };
  status?: { status?: string };
};

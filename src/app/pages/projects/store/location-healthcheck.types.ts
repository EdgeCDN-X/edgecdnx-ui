export type HealthcheckResult = {
  time: string;
  start?: string;
  code?: number;
  message: string;
  alive: boolean;
  durationMs?: number;
};

export type HealthcheckSeries = {
  name: string;
  type: string;
  target: string;
  alive: boolean;
  lastCheck: string;
  results: HealthcheckResult[];
};

export type NodeHealthStatus = 'Healthy' | 'Unhealthy' | 'Unknown';

export type NodeHealthcheckReport = {
  name: string;
  nodeGroup?: string;
  flavor?: string;
  ipv4?: string;
  ipv6?: string;
  maintenanceMode?: boolean;
  configured: boolean;
  status: NodeHealthStatus;
  checks: HealthcheckSeries[];
};

export type LocationHealthchecks = {
  location: string;
  from: string;
  to: string;
  nodes: NodeHealthcheckReport[];
};

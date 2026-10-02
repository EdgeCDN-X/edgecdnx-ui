import {
  CacheConfig,
  GeoLookup,
  KubernetesObjectMeta,
  LocationStatus,
  PrometheusAlertMatcher,
} from '../../admin/store/admin.types';

export type LocationNode = {
  name: string;
  ipv4?: string;
  ipv6?: string;
  caches?: string[];
  maintenanceMode?: boolean;
  alerts?: PrometheusAlertMatcher[];
  healthCheck?: { name: string };
};

export type LocationNodeGroup = {
  name: string;
  flavor: string;
  labels?: Record<string, string>;
  metadata?: Record<string, string>;
  nodeSelector?: Record<string, string>;
  nodes?: LocationNode[];
  healthCheck?: { name: string };
  cacheConfig?: CacheConfig;
};

export type UpdateLocationDto = {
  nodeGroups: LocationNodeGroup[];
  geoLookup: GeoLookup;
  weight: number;
  fallbackLocations: string[];
};

export type CreateLocationDto = UpdateLocationDto & { name: string };

export type ProjectLocation = {
  metadata: KubernetesObjectMeta & { name: string };
  spec?: Partial<UpdateLocationDto>;
  status?: LocationStatus;
};
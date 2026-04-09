export type AdminResource = 'locations' | 'prefixlists' | 'zones';

export type HealthStatus = 'Healthy' | 'Progressing' | 'Degraded';

export type ConsolidationStatus = 'Consolidating' | 'Consolidated' | 'Requested';

export type AlertState = 'firing' | 'pending' | 'inactive';

export type NodeConditionType = 'IPV4HealthCheckSuccessful' | 'IPV6HealthCheckSuccessful';

export type PrefixListSource = 'Static' | 'Bgp' | 'Controller';

export type KubernetesTypeMeta = {
  apiVersion?: string;
  kind?: string;
};

export type KubernetesObjectMeta = {
  name?: string;
  namespace?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  creationTimestamp?: string;
  generation?: number;
  resourceVersion?: string;
  uid?: string;
};

export type PrometheusAlertMatcher = {
  alertName: string;
  labels?: Record<string, string>;
};

export type GeoLookupAttributeValue = {
  value?: string;
  weight?: number;
};

export type GeoLookupAttribute = {
  weight?: number;
  values?: GeoLookupAttributeValue[];
};

export type GeoLookup = {
  weight?: number;
  attributes?: Record<string, GeoLookupAttribute>;
};

export type CacheConfig = {
  name?: string;
  path: string;
  keysZone: string;
  inactive: string;
  maxSize: string;
};

export type Node = {
  name: string;
  ipv4?: string;
  ipv6?: string;
  caches?: string[];
  maintenanceMode?: boolean;
  alerts?: PrometheusAlertMatcher[];
};

export type NodeGroup = {
  name: string;
  flavor?: string;
  nodes?: Node[];
  cacheConfig: CacheConfig;
  nodeSelector?: Record<string, string>;
};

export type LocationSpec = {
  fallbackLocations?: string[];
  nodes?: Node[];
  geoLookup: GeoLookup;
  maintenanceMode?: boolean;
  nodeGroups?: NodeGroup[];
  alerts?: PrometheusAlertMatcher[];
  parent?: string;
};

export type NodeCondition = {
  type: NodeConditionType;
  status: boolean;
  lastTransitionTime?: string;
  reason?: string;
  observedGeneration?: number;
};

export type PrometheusAlertStatus = {
  alertName?: string;
  state?: AlertState;
  labels?: Record<string, string>;
  lastTransitionTime?: string;
};

export type NodeInstanceStatus = {
  conditions: NodeCondition[];
  alerts?: PrometheusAlertStatus[];
};

export type LocationStatus = {
  status?: HealthStatus;
  alerts?: PrometheusAlertStatus[];
  nodeStatus?: Record<string, NodeInstanceStatus>;
};

export type Location = KubernetesTypeMeta & {
  metadata?: KubernetesObjectMeta;
  spec?: LocationSpec;
  status?: LocationStatus;
};

export type LocationHealthNode = {
  location?: string;
  source?: string;
  nodeName?: string;
  nodeGroupName?: string;
  nodeGroupFlavor?: string;
  ip?: string;
  instance: string;
  role?: string;
  healthy: boolean;
  value: string;
  timestamp: number;
  matched: boolean;
  matchField?: string;
  alertScope?: 'location' | 'node' | string;
  alerts?: LocationHealthAlert[];
  labels: Record<string, string>;
};

export type LocationHealthAlert = {
  alertName: string;
  labels?: Record<string, string>;
  timestamp?: number;
};

export type LocationHealthSource = {
  source: string;
  totalNodes: number;
  healthyNodes: number;
  unhealthyNodes: number;
  unknownNodes: number;
  nodes: LocationHealthNode[];
};

export type LocationHealthItem = {
  name: string;
  status?: HealthStatus | string;
  maintenanceMode?: boolean;
  alerts?: LocationHealthAlert[];
  sources: LocationHealthSource[];
};

export type LocationHealthApiResponse = {
  status: string;
  data?: {
    resultType?: string;
    sources?: string[];
    locations?: LocationHealthItem[];
    unmatchedMetrics?: LocationHealthNode[];
  };
};

export type LocationHealthState = {
  items: LocationHealthItem[];
  sources: string[];
  unmatchedMetrics: LocationHealthNode[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
};

export type V4Prefix = {
  address: string;
  size: number;
};

export type V6Prefix = {
  address: string;
  size: number;
};

export type Prefix = {
  v4?: V4Prefix[];
  v6?: V6Prefix[];
};

export type PrefixListSpec = {
  source: PrefixListSource;
  prefix: Prefix;
  destination: string;
};

export type PrefixListStatus = {
  status?: HealthStatus;
  consolidationStatus?: ConsolidationStatus;
};

export type PrefixList = KubernetesTypeMeta & {
  metadata?: KubernetesObjectMeta;
  spec?: PrefixListSpec;
  status?: PrefixListStatus;
};

export type ZoneSpec = {
  zone: string;
  email: string;
};

export type ZoneStatus = {
  status?: HealthStatus;
};

export type Zone = KubernetesTypeMeta & {
  metadata?: KubernetesObjectMeta;
  spec?: ZoneSpec;
  status?: ZoneStatus;
};

export type AdminResourceItemByResource = {
  locations: Location;
  prefixlists: PrefixList;
  zones: Zone;
};

export type AdminResourceItem = AdminResourceItemByResource[AdminResource];

export type AdminResourceState<T = unknown> = {
  items: T[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
};


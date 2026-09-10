import { Metadata } from '../../../shared/types/spec.types';

export type DNSRecordType = 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'SRV' | 'NS';

export interface DNSEndpoint {
  kind: 'DNSEndpoint';
  apiVersion: 'infrastructure.edgecdnx.com/v1alpha1';
  metadata: Metadata;
  spec: DNSEndpointSpec;
}

export type DNSRoutingPolicy =
  | 'Simple'
  | 'Weighted'
  | 'Failover'
  | 'Geolocation'
  | 'RoundRobin';

export interface LabelSelectorRequirement {
  key: string;
  operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist';
  values?: string[];
}

export interface LabelSelector {
  matchLabels?: Record<string, string>;
  matchExpressions?: LabelSelectorRequirement[];
}

export interface DNSEndpointSpec {
  dnsName: string;
  routingPolicy: DNSRoutingPolicy;
  recordTTL: number;
  recordType: DNSRecordType;
  targets: string[];
  routeSelector?: LabelSelector | null;
}

export interface CreateDNSEndpointDto {
  dnsName: string;
  routingPolicy: 'Simple';
  recordTTL: number;
  recordType: DNSRecordType;
  targets: string[];
}

export type UpdateDNSEndpointDto = Partial<CreateDNSEndpointDto>;

export interface DNSEndpointActionError {
  message: string;
  action: 'list' | 'create' | 'update' | 'delete';
}

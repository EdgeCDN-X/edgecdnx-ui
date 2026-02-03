
import { Metadata } from "../../../shared/types/spec.types";

export enum OriginType {
    S3 = 's3',
    Static = 'static',
}

export interface CreateServiceDto {
    name: string;
    originType: OriginType;
    staticOrigin?: {
        upstream: string;
        hostHeader?: string;
        port?: number;
        scheme?: "Http" | "Https";
    };
}

export interface ServiceActionError {
    message: string;
    action: "create" | "list";
}

export type ServiceList = Service[];

export interface Service {
    kind: "Service";
    apiVersion: "infrastructure.edgecdnx.com/v1alpha1";
    metadata: Metadata;
    spec: ServiceSpec;
    status?: Record<string, never>;
}

export interface ServiceSpec {
    /** Specifies which cache to use for the service */
    cache?: string;

    /** Specifies the cache key modifiers for the service */
    cacheKey: CacheKeySpec;

    /** SSL Certificate for the service */
    certificate: CertificateSpec;

    /** Defines the customer details for the service */
    customer: CustomerSpec;

    /** Domain name. Ideally the same as the service name */
    domain?: string;

    /** Host Aliases for the service (max 10) */
    hostAliases?: HostAlias[];

    /** Service Name. Use full domain name for the service */
    name?: string;

    /** Defines the Origin type for the service */
    originType?: OriginType;

    /** Defines the specs of the origin if an S3 origin is used */
    s3OriginSpec?: S3OriginSpec[];

    /** Defines the secure keys for the service (max 2 items) */
    secureKeys?: SecureKey[];

    /** Defines the specs of the origin if a static origin is used */
    staticOrigins?: StaticOrigin[];

    /** WAF configuration */
    waf: WafSpec;
}

/* =========================
 * Cache Key
 * ========================= */

export interface CacheKeySpec {
    /** Headers that alter the cache key */
    headers?: string[];

    /** Query parameters that alter the cache key */
    queryParams?: string[];
}

/* =========================
 * Certificate
 * ========================= */

export interface CertificateSpec {
    /** Certificate Object Reference */
    certificateRef?: string;

    /** Inline certificate */
    crt?: string;

    /** Inline key */
    key?: string;

    /** Secret Object Reference */
    secretRef?: string;
}

/* =========================
 * Customer
 * ========================= */

export interface CustomerSpec {
    /** Customer ID (informational) */
    id?: number;

    /** Customer name (informational) */
    name?: string;
}

/* =========================
 * Host Aliases
 * ========================= */

export interface HostAlias {
    /** Host Alias Name */
    name: string;

    /** Optional certificate override */
    certificate?: CertificateSpec;
}

/* =========================
 * S3 Origin
 * ========================= */

export interface S3OriginSpec {
    /** S3 Bucket Signature version */
    awsSigsVersion: 2 | 4;

    /** Access Key ID */
    s3AccessKeyId: string;

    /** S3 Bucket Name */
    s3BucketName: string;

    /** S3 Region */
    s3Region: string;

    /** Secret Access Key */
    s3SecretKey: string;

    /** S3 Server */
    s3Server?: string;

    /** S3 Server Port */
    s3ServerPort?: number;

    /** S3 Server Protocol */
    s3ServerProto?: string;

    /** S3 Server Style */
    s3Style?: "virtual" | "path";
}

/* =========================
 * Secure Keys
 * ========================= */

export interface SecureKey {
    /** Creation time */
    createdAt: string; // RFC3339 / ISO date-time

    /** Key name for URL signatures */
    name?: string;

    /** Key value (32 chars) */
    value?: string;
}

/* =========================
 * Static Origin
 * ========================= */

export interface StaticOrigin {
    /** Upstream URL */
    upstream?: string;

    /** Host header override */
    hostHeader?: string;

    /** Port */
    port?: number;

    /** Scheme */
    scheme?: "Http" | "Https";
}

/* =========================
 * WAF
 * ========================= */

export interface WafSpec {
    enabled?: boolean;
}

/* =========================
 * Status
 * ========================= */

export interface ServiceStatus {
    status?: "Healthy" | "Progressing" | "Degraded";
}
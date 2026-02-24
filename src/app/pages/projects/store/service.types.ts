
import { Metadata } from "../../../shared/types/spec.types";

export enum OriginType {
    S3 = 's3',
    Static = 'static',
}

export interface CreateServiceDto {
    name: string;
    originType: OriginType;
    staticOrigin?: StaticOrigin;
    s3OriginSpec?: S3OriginSpec;
    cache: string;
    hostAliases?: HostAlias[];

    signedUrlsEnabled: boolean;
    wafEnabled: boolean;
}

export interface ServiceActionError {
    message: string;
    action: "create" | "list" | "key-add" | "key-delete" | "update" | "host-alias-add" | "host-alias-delete" | "status-fetch";
}

export type ServiceList = Service[];

export interface Service {
    kind: "Service";
    apiVersion: "infrastructure.edgecdnx.com/v1alpha1";
    metadata: Metadata;
    spec: ServiceSpec;
    status?: ServiceStatus;
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

export interface ServiceStatusDTO {
    serviceId: string;
    certificateStatus?: CertificateStatusDTO;
    applicationSetStatus?: ApplicationSetStatusDTO;
}


export interface CertificateStatusDTO {
    /**
     * List of status conditions to indicate the status of certificates. 
     * Known condition types are `Ready` and `Issuing`.
     */
    conditions?: CertificateConditionDTO[];

    /**
     * The number of continuous failed issuance attempts up till now. 
     * Gets removed on successful issuance and set to 1 if unset and an issuance has failed.
     */
    failedIssuanceAttempts?: number;

    /**
     * LastFailureTime is set only if the latest issuance for this Certificate failed.
     * Contains the time of the failure.
     */
    lastFailureTime?: string; // ISO 8601 date-time

    /**
     * The name of the Secret resource containing the private key for the next certificate iteration.
     */
    nextPrivateKeySecretName?: string;

    /**
     * The expiration time of the certificate stored in the secret named by this resource in `spec.secretName`.
     */
    notAfter?: string; // ISO 8601 date-time

    /**
     * The time after which the certificate stored in the secret named by this resource in `spec.secretName` is valid.
     */
    notBefore?: string; // ISO 8601 date-time

    /**
     * RenewalTime is the time at which the certificate will be next renewed.
     * If not set, no upcoming renewal is scheduled.
     */
    renewalTime?: string; // ISO 8601 date-time

    /**
     * The current 'revision' of the certificate as issued.
     */
    revision?: number;
}

export interface CertificateConditionDTO {
    /**
     * LastTransitionTime is the timestamp corresponding to the last status change of this condition.
     */
    lastTransitionTime?: string; // ISO 8601 date-time

    /**
     * Message is a human readable description of the details of the last transition.
     */
    message?: string;

    /**
     * Represents the .metadata.generation that the condition was set based upon.
     */
    observedGeneration?: number;

    /**
     * Reason is a brief machine readable explanation for the condition's last transition.
     */
    reason?: string;

    /**
     * Status of the condition, one of 'True', 'False', 'Unknown'.
     */
    status: 'True' | 'False' | 'Unknown';

    /**
     * Type of the condition, known values are 'Ready', 'Issuing'.
     */
    type: string;
}

export interface ApplicationSetStatusDTO {
    /**
     * Status for each application. Contains information about steps and target revisions.
     */
    applicationStatus?: ApplicationItemDTO[];

    /**
     * List of conditions for the overall status.
     */
    conditions?: ConditionDTO[];

    /**
     * List of resources associated with the application.
     */
    resources?: ResourceDTO[];

    /**
     * Total count of resources.
     */
    resourcesCount?: number;
}

export interface ApplicationItemDTO {
    /**
     * Name of the application.
     */
    application: string;

    /**
     * Last time the status of this application changed.
     */
    lastTransitionTime?: string; // ISO 8601 date-time

    /**
     * Human-readable message describing the status.
     */
    message: string;

    /**
     * Status of the application.
     */
    status: string;

    /**
     * Current step of the application process.
     */
    step: string;

    /**
     * Target revisions for this application.
     */
    targetRevisions: string[];
}

export interface ConditionDTO {
    /**
     * Last time the condition changed.
     */
    lastTransitionTime?: string; // ISO 8601 date-time

    /**
     * Human-readable message for the condition.
     */
    message: string;

    /**
     * Reason for the condition.
     */
    reason: string;

    /**
     * Status of the condition.
     */
    status: string;

    /**
     * Type of the condition.
     */
    type: string;
}

export interface ResourceDTO {
    /**
     * API group of the resource.
     */
    group?: string;

    /**
     * Health status of the resource.
     */
    health?: ResourceHealthDTO;

    /**
     * Whether this resource is a hook.
     */
    hook?: boolean;

    /**
     * Kind of the resource (e.g., Deployment, Service).
     */
    kind?: string;

    /**
     * Name of the resource.
     */
    name?: string;

    /**
     * Namespace of the resource.
     */
    namespace?: string;

    /**
     * Whether deletion confirmation is required.
     */
    requiresDeletionConfirmation?: boolean;

    /**
     * Whether the resource requires pruning.
     */
    requiresPruning?: boolean;

    /**
     * Current status of the resource.
     */
    status?: string;

    /**
     * Synchronization wave for ordering operations.
     */
    syncWave?: number;

    /**
     * Version of the resource.
     */
    version?: string;
}

export interface ResourceHealthDTO {
    /**
     * Last time the health status changed.
     */
    lastTransitionTime?: string; // ISO 8601 date-time

    /**
     * Human-readable health message.
     */
    message?: string;

    /**
     * Status of the resource health.
     */
    status?: string;
}
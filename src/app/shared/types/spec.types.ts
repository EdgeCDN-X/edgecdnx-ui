export interface Metadata {
    name: string;
    namespace: string;
    uid?: string;
    resourceVersion?: string;
    generation?: number;
    creationTimestamp?: string; // ISO date string
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    managedFields?: any;
}
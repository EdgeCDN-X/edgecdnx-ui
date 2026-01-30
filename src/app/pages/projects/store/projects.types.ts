
export type ProjectList = Project[];

export interface Project {
    kind: "Project";
    apiVersion: "infrastructure.edgecdnx.com/v1alpha1";
    metadata: Metadata;
    spec: ProjectSpec;
    status?: Record<string, never>;
}

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

export interface ProjectSpec {
    name: string;
    description: string;
    rbac: RBAC;
}

export interface RBAC {
    groups: RBACGroup[];
    rules: RBACRule[];
}

export interface RBACGroup {
    ptype: "g";
    v0: string; // user/email
    v1: string; // role
    v2: string; // project
}

export interface RBACRule {
    ptype: "p";
    v0: string; // role
    v1: string; // project
    v2: string; // resource
    v3: "create" | "read" | "write" | "delete" | string;
}

export interface CreateProjectDto {
    name: string;
    description: string;
}

export interface ProjectActionError {
    message: string;
    action: "create" | "list";
}
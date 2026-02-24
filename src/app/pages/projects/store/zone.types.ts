import { Metadata } from "../../../shared/types/spec.types";

export type ZoneList = Zone[];

export interface Zone {
    kind: "Zone";
    apiVersion: "infrastructure.edgecdnx.com/v1alpha1";
    metadata: Metadata;
    spec: ZoneSpec;
    status?: ZoneStatus;
}

export interface ZoneSpec {
    email: string;
    zone: string;
}

export interface ZoneStatus {
    status: "Healthy" | "Progressing" | "Degraded";
}

export interface CreateZoneDto {
    email: string;
    zone: string;
}

export interface ZoneActionError {
    message: string;
    action: "create" | "list" | "delete" | "update";
}
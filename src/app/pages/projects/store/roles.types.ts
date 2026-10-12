export interface RolePermission {
  resource: string;
  action: string;
}

export interface ProjectRole {
  name: string;
  permissions: RolePermission[];
}

export interface CreateRoleDto extends ProjectRole {}

export type UpdateRoleDto = Omit<ProjectRole, 'name'>;

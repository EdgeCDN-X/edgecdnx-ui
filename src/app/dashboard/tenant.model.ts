export interface Tenant {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  status: 'active' | 'inactive' | 'pending';
}

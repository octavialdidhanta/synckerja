// Type definitions for organizational structure

export interface OrganizationalNode {
  id: string;
  name: string;
  type: 'department' | 'position' | 'employee';
  employee?: {
    id: string;
    full_name: string;
    email: string;
    photo_url?: string;
    job_level_name?: string;
    is_organization_owner?: boolean;
  };
  employeeCount?: number;
  children: OrganizationalNode[];
}





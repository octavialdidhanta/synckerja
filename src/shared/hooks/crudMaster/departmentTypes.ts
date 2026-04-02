
export type Department = { 
  id: string; 
  name: string; 
  organization_id: string;
  is_active: boolean;
  code: string;
  description: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  is_default?: boolean;
};

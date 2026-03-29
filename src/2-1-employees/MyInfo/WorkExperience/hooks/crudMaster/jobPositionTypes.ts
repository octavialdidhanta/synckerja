
export type JobPosition = {
  id: string;
  name: string;
  organization_id?: string | null;
  department_id?: string | null;
  isDefault?: boolean; // Added for marking global job positions
};

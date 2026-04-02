
export type Branch = {
  id: string;
  name: string;
  organization_id?: string;
  isDefault?: boolean; // Added for marking global branches
};

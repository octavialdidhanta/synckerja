
export type JobLevel = {
  id: string;
  name: string;
  organization_id?: string | null;
  isDefault?: boolean; // Added for marking global job levels
  // Add other job level fields as needed
};

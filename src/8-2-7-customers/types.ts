export type CustomerListRow = {
  /** Stable identity key: `phone:…` or `email:…` (not a lead UUID). */
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  customerSince: string | null;
  thisMonth: number;
  thisYear: number;
  lifetime: number;
};

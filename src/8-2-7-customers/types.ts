export type CustomerListRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  customerSince: string | null;
  thisMonth: number;
  thisYear: number;
  lifetime: number;
};

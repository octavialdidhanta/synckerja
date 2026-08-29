import type { CustomerListRow } from '../types';

export function filterCustomers(rows: CustomerListRow[], search: string): CustomerListRow[] {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => {
    const hay = `${row.name} ${row.email ?? ''} ${row.phone ?? ''}`.toLowerCase();
    return hay.includes(q);
  });
}

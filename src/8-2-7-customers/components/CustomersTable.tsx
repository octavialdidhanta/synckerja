import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import type { CustomerListRow } from '../types';

type Props = {
  rows: CustomerListRow[];
};

function formatCustomerSince(value: string | null): string {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, 'dd-MM-yyyy');
}

function dash(value: string | null | undefined): string {
  const trimmed = String(value ?? '').trim();
  return trimmed || '—';
}

export function CustomersTable({ rows }: Props) {
  const { t } = useAppTranslation();

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
        {t('customers.table.empty', 'No customers yet.')}
      </div>
    );
  }

  return (
    <div className="scrollbar-hide min-h-0 flex-1 overflow-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Table>
        <TableHeader className="sticky top-0 z-20 bg-gray-50">
          <TableRow>
            <TableHead>{t('customers.table.colName', 'Name')}</TableHead>
            <TableHead>{t('customers.table.colPhone', 'Phone')}</TableHead>
            <TableHead>{t('customers.table.colEmail', 'Email')}</TableHead>
            <TableHead>{t('customers.table.colCustomerSince', 'Customer Since')}</TableHead>
            <TableHead className="text-right">{t('customers.table.colThisMonth', 'This Month')}</TableHead>
            <TableHead className="text-right">{t('customers.table.colThisYear', 'This Year')}</TableHead>
            <TableHead className="text-right">{t('customers.table.colLifetime', 'Lifetime')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell className="tabular-nums">{dash(row.phone)}</TableCell>
              <TableCell className="max-w-[220px] truncate" title={row.email ?? undefined}>
                {dash(row.email)}
              </TableCell>
              <TableCell className="tabular-nums">{formatCustomerSince(row.customerSince)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatToRupiah(row.thisMonth)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatToRupiah(row.thisYear)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatToRupiah(row.lifetime)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

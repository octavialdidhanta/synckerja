import * as XLSX from 'xlsx';
import type { OmnichannelContactRow } from '@/5-3-whatsapp/hooks/useOmnichannelContacts';
import { RECIPIENT_IMPORT_REQUIRED_HEADERS } from '@/5-3-whatsapp-template/utils/parseRecipientImportFile';

export type OmnichannelContactExportRow = {
  phone_number: string;
  full_name: string;
  customer_name: string;
  company: string;
};

export function mapContactsToExportRows(rows: OmnichannelContactRow[]): OmnichannelContactExportRow[] {
  return rows.map((row) => {
    const displayName = row.name?.trim() || 'WhatsApp Lead';
    return {
      phone_number: row.phone_key,
      full_name: displayName,
      customer_name: displayName,
      company: row.target_market,
    };
  });
}

export function buildOmnichannelContactsCsv(rows: OmnichannelContactExportRow[]): string {
  const header = [...RECIPIENT_IMPORT_REQUIRED_HEADERS];
  const escape = (v: string) => {
    if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const lines = [
    header.join(','),
    ...rows.map((r) => header.map((h) => escape(String(r[h as keyof OmnichannelContactExportRow] ?? ''))).join(',')),
  ];
  return lines.join('\r\n');
}

export function downloadOmnichannelContactsCsv(rows: OmnichannelContactExportRow[], filenameBase: string): void {
  const csv = buildOmnichannelContactsCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenameBase}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadOmnichannelContactsXls(rows: OmnichannelContactExportRow[], filenameBase: string): void {
  const header = [...RECIPIENT_IMPORT_REQUIRED_HEADERS];
  const aoa: (string | number)[][] = [
    header,
    ...rows.map((r) => header.map((h) => String(r[h as keyof OmnichannelContactExportRow] ?? ''))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
  XLSX.writeFile(wb, `${filenameBase}.xls`, { bookType: 'biff8' });
}

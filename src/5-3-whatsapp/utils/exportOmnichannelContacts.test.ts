import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { RECIPIENT_IMPORT_REQUIRED_HEADERS } from '@/5-3-whatsapp-template/utils/parseRecipientImportFile';
import { normalizeWaPhoneKey } from '@/5-3-whatsapp-template/utils/normalizeWaPhoneKey';
import {
  buildOmnichannelContactsCsv,
  mapContactsToExportRows,
} from './exportOmnichannelContacts';
import type { OmnichannelContactRow } from '@/5-3-whatsapp/hooks/useOmnichannelContacts';

const SAMPLE_CONTACTS: OmnichannelContactRow[] = [
  {
    id: 'sub-1',
    name: 'Budi Santoso',
    phone_number: '081234567890',
    phone_key: '6281234567890',
    campaign_name: 'Campaign1',
    target_market: 'Funnel Marketing',
    captured_at: '2026-07-17T10:00:00.000Z',
    source: 'Lead Magnet',
  },
];

function parseSheetRowsFromCsv(csv: string): unknown[][] {
  const wb = XLSX.read(csv, { type: 'string', raw: false });
  const sheet = wb.Sheets[wb.SheetNames[0]!]!;
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', blankrows: false }) as unknown[][];
}

function parseSheetRowsFromXlsBuffer(buf: ArrayBuffer): unknown[][] {
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: false, raw: false });
  const sheet = wb.Sheets[wb.SheetNames[0]!]!;
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', blankrows: false }) as unknown[][];
}

describe('exportOmnichannelContacts', () => {
  it('maps export rows with company = target market', () => {
    const rows = mapContactsToExportRows(SAMPLE_CONTACTS);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      phone_number: '6281234567890',
      full_name: 'Budi Santoso',
      customer_name: 'Budi Santoso',
      company: 'Funnel Marketing',
    });
  });

  it('export CSV has recipient-import headers and valid phone row', () => {
    const exportRows = mapContactsToExportRows(SAMPLE_CONTACTS);
    const csv = buildOmnichannelContactsCsv(exportRows);
    const rows = parseSheetRowsFromCsv(csv);
    const header = (rows[0] ?? []).map((c) => String(c).trim().toLowerCase());
    expect(header).toEqual([...RECIPIENT_IMPORT_REQUIRED_HEADERS]);

    const data = rows[1] ?? [];
    const phoneRaw = String(data[0] ?? '').trim();
    const fullName = String(data[1] ?? '').trim();
    const customerName = String(data[2] ?? '').trim();
    const company = String(data[3] ?? '').trim();

    expect(normalizeWaPhoneKey(phoneRaw)).toBe('6281234567890');
    expect(fullName).toBe('Budi Santoso');
    expect(customerName).toBe('Budi Santoso');
    expect(company).toBe('Funnel Marketing');
  });

  it('export XLS has recipient-import headers and valid phone row', () => {
    const exportRows = mapContactsToExportRows(SAMPLE_CONTACTS);
    const aoa = [
      [...RECIPIENT_IMPORT_REQUIRED_HEADERS],
      ...exportRows.map((r) => [r.phone_number, r.full_name, r.customer_name, r.company]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
    const buf = XLSX.write(wb, { bookType: 'biff8', type: 'array' }) as ArrayBuffer;

    const rows = parseSheetRowsFromXlsBuffer(buf);
    const header = (rows[0] ?? []).map((c) => String(c).trim().toLowerCase());
    expect(header).toEqual([...RECIPIENT_IMPORT_REQUIRED_HEADERS]);

    const data = rows[1] ?? [];
    expect(normalizeWaPhoneKey(String(data[0] ?? ''))).toBe('6281234567890');
    expect(String(data[1] ?? '')).toBe('Budi Santoso');
    expect(String(data[3] ?? '')).toBe('Funnel Marketing');
  });
});

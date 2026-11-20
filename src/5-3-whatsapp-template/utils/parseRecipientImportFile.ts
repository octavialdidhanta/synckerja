import * as XLSX from "xlsx";
import { normalizeWaPhoneKey } from "./normalizeWaPhoneKey";

export const RECIPIENT_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const RECIPIENT_IMPORT_MAX_DATA_ROWS = 50_000;
/** Matches `whatsapp_recipient_lists` name constraint. */
export const RECIPIENT_LIST_NAME_MAX_LEN = 120;
export const RECIPIENT_IMPORT_ERROR_SUMMARY_CAP = 500;

export const RECIPIENT_IMPORT_REQUIRED_HEADERS = [
  "phone_number",
  "full_name",
  "customer_name",
  "company",
] as const;

export type RecipientImportFailureCode =
  | "MISSING_FIELD"
  | "INVALID_PHONE"
  | "DUPLICATE_PHONE"
  | "FIELD_TOO_LONG";

export type RecipientImportFailure = {
  /** 1-based row number as shown in Excel / the CSV file (header is row 1). */
  row: number;
  code: RecipientImportFailureCode;
  field?: string;
  /** Raw phone and name from the rejected row, so the user can find and fix it. */
  phone?: string;
  name?: string;
};

/** Cap on stored raw values so one bad cell cannot bloat the error summary. */
const FAILURE_VALUE_MAX_LEN = 120;

export type RecipientImportValidRow = {
  phoneKey: string;
  import_full_name: string;
  import_customer_name: string;
  import_company: string;
};

export type ParseRecipientImportFileResult =
  | {
      ok: true;
      validRows: RecipientImportValidRow[];
      failures: RecipientImportFailure[];
      /** Non-empty body rows (after header) considered for import. */
      rowCountExpected: number;
    }
  | {
      ok: false;
      code: "FILE_TOO_LARGE" | "FILE_TYPE" | "TOO_MANY_ROWS" | "MISSING_HEADERS" | "PARSE" | "EMPTY_FILE";
      message?: string;
    };

function pushFailureUnique(
  failures: RecipientImportFailure[],
  row: number,
  code: RecipientImportFailureCode,
  field: string | undefined,
  values: { phone: string; name: string },
): void {
  if (failures.some((f) => f.row === row)) return;
  const failure: RecipientImportFailure = { row, code };
  if (field) failure.field = field;
  const phone = values.phone.slice(0, FAILURE_VALUE_MAX_LEN);
  const name = values.name.slice(0, FAILURE_VALUE_MAX_LEN);
  if (phone) failure.phone = phone;
  if (name) failure.name = name;
  failures.push(failure);
}

const MAX_FIELD_LEN = 500;

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function buildHeaderIndexMap(headerRow: unknown[]): Map<string, number> | null {
  const map = new Map<string, number>();
  for (let c = 0; c < headerRow.length; c++) {
    const key = String(headerRow[c] ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
    if (key) map.set(key, c);
  }
  for (const req of RECIPIENT_IMPORT_REQUIRED_HEADERS) {
    if (!map.has(req)) return null;
  }
  return map;
}

function cell(row: unknown[], col: number | undefined): string {
  if (col === undefined) return "";
  const v = row[col];
  if (v == null) return "";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v).trim();
}

function rowIsEmpty(row: unknown[]): boolean {
  return row.every((c) => String(c ?? "").trim() === "");
}

/**
 * Parse CSV or XLS (legacy Excel) recipient import; validates required columns and phones.
 * Duplicate normalized phones: first row wins, later rows become DUPLICATE_PHONE failures.
 */
export async function parseRecipientImportFile(file: File): Promise<ParseRecipientImportFileResult> {
  const ext = extOf(file.name);
  if (ext !== "csv" && ext !== "xls") {
    return { ok: false, code: "FILE_TYPE" };
  }
  if (file.size > RECIPIENT_IMPORT_MAX_FILE_BYTES) {
    return { ok: false, code: "FILE_TOO_LARGE" };
  }

  let workbook: XLSX.WorkBook;
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    workbook = XLSX.read(data, { type: "array", cellDates: false, raw: false });
  } catch {
    return { ok: false, code: "PARSE" };
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : null;
  if (!sheet) return { ok: false, code: "EMPTY_FILE" };

  // Keep blank rows so each row's index maps to its real row number in the file
  // (reported back to the user for rejected rows); empty rows are skipped below.
  // A sheet whose used range is far larger than the row limit (e.g. formatting down to row
  // 1,048,576) would allocate one array per blank row; fall back to skipping blanks there.
  let allRows: unknown[][];
  let firstSheetRow = 0;
  try {
    const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
    if (range) firstSheetRow = range.s.r;
    const keepBlankRows = !range || range.e.r - range.s.r < RECIPIENT_IMPORT_MAX_DATA_ROWS * 2;
    allRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      blankrows: keepBlankRows,
    }) as unknown[][];
  } catch {
    return { ok: false, code: "PARSE" };
  }

  const rows: { cells: unknown[]; rowNumber: number }[] = [];
  (allRows ?? []).forEach((cells, index) => {
    if (!rowIsEmpty(cells ?? [])) rows.push({ cells: cells ?? [], rowNumber: firstSheetRow + index + 1 });
  });

  if (!rows.length) return { ok: false, code: "EMPTY_FILE" };

  const headerRow = rows[0].cells;
  const colMap = buildHeaderIndexMap(headerRow);
  if (!colMap) {
    return { ok: false, code: "MISSING_HEADERS" };
  }

  const idxPhone = colMap.get("phone_number")!;
  const idxFull = colMap.get("full_name")!;
  const idxCustomer = colMap.get("customer_name")!;
  const idxCompany = colMap.get("company")!;

  const dataRows = rows.slice(1);
  if (dataRows.length > RECIPIENT_IMPORT_MAX_DATA_ROWS) {
    return { ok: false, code: "TOO_MANY_ROWS" };
  }

  const failures: RecipientImportFailure[] = [];
  const validRows: RecipientImportValidRow[] = [];
  const seenPhone = new Set<string>();

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i].cells;
    const sheetRowNumber = dataRows[i].rowNumber;

    const phoneRaw = cell(row, idxPhone);
    const fullName = cell(row, idxFull);
    const customerName = cell(row, idxCustomer);
    const company = cell(row, idxCompany);
    const rawValues = { phone: phoneRaw, name: fullName || customerName };

    const fields = [
      { key: "phone_number", val: phoneRaw },
      { key: "full_name", val: fullName },
      { key: "customer_name", val: customerName },
      { key: "company", val: company },
    ] as const;

    for (const f of fields) {
      if (!f.val) {
        pushFailureUnique(failures, sheetRowNumber, "MISSING_FIELD", f.key, rawValues);
        break;
      }
      if (f.val.length > MAX_FIELD_LEN) {
        pushFailureUnique(failures, sheetRowNumber, "FIELD_TOO_LONG", f.key, rawValues);
        break;
      }
    }

    if (failures.some((f) => f.row === sheetRowNumber)) continue;

    const phoneKey = normalizeWaPhoneKey(phoneRaw);
    if (!phoneKey) {
      pushFailureUnique(failures, sheetRowNumber, "INVALID_PHONE", undefined, rawValues);
      continue;
    }

    if (seenPhone.has(phoneKey)) {
      pushFailureUnique(failures, sheetRowNumber, "DUPLICATE_PHONE", undefined, rawValues);
      continue;
    }
    seenPhone.add(phoneKey);

    validRows.push({
      phoneKey,
      import_full_name: fullName,
      import_customer_name: customerName,
      import_company: company,
    });
  }

  return {
    ok: true,
    validRows,
    failures,
    rowCountExpected: dataRows.length,
  };
}

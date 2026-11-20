import type {
  RecipientImportFailure,
  RecipientImportFailureCode,
} from "@/5-3-whatsapp-template/utils/parseRecipientImportFile";

const FAILURE_CODES: readonly RecipientImportFailureCode[] = [
  "MISSING_FIELD",
  "INVALID_PHONE",
  "DUPLICATE_PHONE",
  "FIELD_TOO_LONG",
];

export type RecipientImportRejectedRows = {
  /** All rejected rows in the uploaded file (may exceed `items.length`, which is capped). */
  total: number;
  items: RecipientImportFailure[];
};

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

/**
 * Read `whatsapp_recipient_lists.error_summary` (written at upload time) defensively:
 * older lists have no phone/name, and the column is free-form JSON.
 */
export function parseImportErrorSummary(raw: unknown): RecipientImportRejectedRows {
  if (!raw || typeof raw !== "object") return { total: 0, items: [] };
  const summary = raw as { failures?: unknown; failedTotal?: unknown };

  const items: RecipientImportFailure[] = [];
  if (Array.isArray(summary.failures)) {
    for (const entry of summary.failures) {
      if (!entry || typeof entry !== "object") continue;
      const f = entry as Record<string, unknown>;
      const row = typeof f.row === "number" && Number.isFinite(f.row) ? f.row : null;
      const code = FAILURE_CODES.find((c) => c === f.code);
      if (row === null || !code) continue;
      const item: RecipientImportFailure = { row, code };
      const field = optionalString(f.field);
      const phone = optionalString(f.phone);
      const name = optionalString(f.name);
      if (field) item.field = field;
      if (phone) item.phone = phone;
      if (name) item.name = name;
      items.push(item);
    }
  }
  items.sort((a, b) => a.row - b.row);

  const failedTotal =
    typeof summary.failedTotal === "number" && Number.isFinite(summary.failedTotal) ? summary.failedTotal : 0;
  return { total: Math.max(failedTotal, items.length), items };
}

function csvCell(value: string): string {
  // Neutralise spreadsheet formulas (CSV injection) before quoting; a plain
  // international phone such as "+62 812-3456" is left as is.
  const looksLikePhone = /^\+[\d\s\-().]+$/.test(value);
  const safe = !looksLikePhone && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export type RejectedRowsCsvLabels = {
  row: string;
  phone: string;
  name: string;
  reason: string;
};

/** CSV (UTF-8 with BOM so Excel shows non-ASCII names correctly) of rejected rows. */
export function buildRejectedRowsCsv(
  items: RecipientImportFailure[],
  labels: RejectedRowsCsvLabels,
  reasonOf: (failure: RecipientImportFailure) => string,
): string {
  const lines = [[labels.row, labels.phone, labels.name, labels.reason].map(csvCell).join(",")];
  for (const item of items) {
    lines.push([String(item.row), item.phone ?? "", item.name ?? "", reasonOf(item)].map(csvCell).join(","));
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}

import * as XLSX from "xlsx";

/** Same structure as `public/templates/whatsapp-recipient-import.csv` (header + one example row). */
const TEMPLATE_AOA: (string | number)[][] = [
  ["phone_number", "full_name", "customer_name", "company"],
  ["6281234567890", "Budi Santoso", "Budi Santoso", "PT Contoh"],
];

const XLS_FILENAME = "whatsapp-recipient-import.xls";

/**
 * Generate and download a legacy `.xls` (BIFF8) template in the browser.
 */
export function downloadRecipientImportTemplateXls(): void {
  const ws = XLSX.utils.aoa_to_sheet(TEMPLATE_AOA);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Recipients");
  XLSX.writeFile(wb, XLS_FILENAME, { bookType: "biff8" });
}

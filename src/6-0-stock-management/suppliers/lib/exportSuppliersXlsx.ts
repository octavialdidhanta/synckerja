import * as XLSX from "xlsx";
import type { CatalogSupplier } from "../types";

export function exportSuppliersXlsx(args: { rows: CatalogSupplier[]; filename: string }): void {
  const header = ["Name", "Address", "Phone", "Email", "City", "State", "Zip"];
  const body = args.rows.map((row) => [
    row.name,
    row.address ?? "",
    row.phone ?? "",
    row.email ?? "",
    row.city ?? "",
    row.state ?? "",
    row.zip ?? "",
  ]);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  XLSX.utils.book_append_sheet(wb, ws, "Suppliers");
  XLSX.writeFile(wb, args.filename);
}

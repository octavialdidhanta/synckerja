import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { CatalogSupplier } from "../types";

export function SuppliersTable(props: {
  rows: CatalogSupplier[];
  onRowClick: (row: CatalogSupplier) => void;
}) {
  const { t } = useAppTranslation();

  if (props.rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
        {t("operations.inventory.suppliers.empty", "No Data To Display")}
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("operations.inventory.suppliers.colName", "Name")}</TableHead>
            <TableHead>{t("operations.inventory.suppliers.colAddress", "Address")}</TableHead>
            <TableHead>{t("operations.inventory.suppliers.colPhone", "Phone")}</TableHead>
            <TableHead>{t("operations.inventory.suppliers.colEmail", "Email")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.rows.map((row) => (
            <TableRow
              key={row.id}
              className="cursor-pointer hover:bg-muted/40"
              onClick={() => props.onRowClick(row)}
            >
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell>{row.address ?? "—"}</TableCell>
              <TableCell>{row.phone ? (row.phone.startsWith("62") ? `+${row.phone}` : row.phone) : "—"}</TableCell>
              <TableCell>{row.email ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

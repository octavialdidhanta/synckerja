import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { format, type Locale } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { FlowBuilderStatusBadge } from "@/5-3-dashboard/omnichannel-settings/components/flow-builder/shared/FlowBuilderStatusBadge";
import { FlowBuilderUserCell } from "@/5-3-dashboard/omnichannel-settings/components/flow-builder/shared/FlowBuilderUserCell";
import type { FlowBuilderListingRow } from "@/5-3-dashboard/omnichannel-settings/types/flowBuilder.types";

type FlowBuilderListingTableProps = {
  rows: FlowBuilderListingRow[];
  selectedIds: Set<string>;
  onToggleRow: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onViewFlowLog?: (row: FlowBuilderListingRow) => void;
  onOpenFlow?: (row: FlowBuilderListingRow) => void;
  onOpenMetaFlow?: (row: FlowBuilderListingRow) => void;
  /** Meta Form Flows have no Synckerja user audit — hide user columns in that tab. */
  hideUserColumns?: boolean;
};

function formatUpdatedAt(value: string | null, locale: Locale): string {
  if (!value) return "—";
  try {
    return format(new Date(value), "dd MMM yyyy HH:mm", { locale });
  } catch {
    return "—";
  }
}

export function FlowBuilderListingTable({
  rows,
  selectedIds,
  onToggleRow,
  onToggleAll,
  onViewFlowLog,
  onOpenFlow,
  onOpenMetaFlow,
  hideUserColumns = false,
}: FlowBuilderListingTableProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "id" ? idLocale : enUS;
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));
  const someSelected = rows.some((row) => selectedIds.has(row.id));

  const statusLabel = (status: FlowBuilderListingRow["status"]) => {
    if (status === "ACTIVE") return t("omnichannel.settings.flowBuilder.status.active");
    if (status === "DRAFT") return t("omnichannel.settings.flowBuilder.status.draft");
    return t("omnichannel.settings.flowBuilder.status.other");
  };

  const colSpan = hideUserColumns ? 5 : 7;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-primary/5 hover:bg-primary/5">
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={(checked) => onToggleAll(checked === true)}
                aria-label={t("omnichannel.settings.flowBuilder.listing.selectAll")}
              />
            </TableHead>
            <TableHead>{t("omnichannel.settings.flowBuilder.listing.colFlowName")}</TableHead>
            <TableHead className="w-[120px]">{t("omnichannel.settings.flowBuilder.listing.colStatus")}</TableHead>
            <TableHead className="w-[120px]">{t("omnichannel.settings.flowBuilder.listing.colFlowLog")}</TableHead>
            {hideUserColumns ? null : (
              <>
                <TableHead className="min-w-[180px]">{t("omnichannel.settings.flowBuilder.listing.colCreatedBy")}</TableHead>
                <TableHead className="min-w-[180px]">{t("omnichannel.settings.flowBuilder.listing.colLastUpdatedBy")}</TableHead>
              </>
            )}
            <TableHead className="w-[160px]">{t("omnichannel.settings.flowBuilder.listing.colLastUpdated")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="py-14 text-center text-sm text-muted-foreground">
                {t("omnichannel.settings.flowBuilder.listing.empty")}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(row.id)}
                    onCheckedChange={(checked) => onToggleRow(row.id, checked === true)}
                    aria-label={t("omnichannel.settings.flowBuilder.listing.selectRow", { name: row.name })}
                  />
                </TableCell>
                <TableCell className="font-medium text-foreground">
                  {row.kind === "automation" && onOpenFlow ? (
                    <button
                      type="button"
                      className="text-left text-primary hover:underline"
                      onClick={() => onOpenFlow(row)}
                    >
                      {row.name}
                    </button>
                  ) : row.kind === "meta_form" && onOpenMetaFlow ? (
                    <button
                      type="button"
                      className="text-left text-primary hover:underline"
                      onClick={() => onOpenMetaFlow(row)}
                    >
                      {row.name}
                    </button>
                  ) : (
                    row.name
                  )}
                </TableCell>
                <TableCell>
                  <FlowBuilderStatusBadge status={row.status} label={statusLabel(row.status)} />
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 px-2 text-primary hover:text-primary"
                    onClick={() => onViewFlowLog?.(row)}
                  >
                    {t("omnichannel.settings.flowBuilder.listing.viewFlowLog")}
                    <FileText className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </TableCell>
                {hideUserColumns ? null : (
                  <>
                    <TableCell>
                      <FlowBuilderUserCell
                        user={row.createdBy}
                        emptyLabel={t("omnichannel.settings.flowBuilder.listing.noUser")}
                      />
                    </TableCell>
                    <TableCell>
                      <FlowBuilderUserCell
                        user={row.lastUpdatedBy}
                        emptyLabel={t("omnichannel.settings.flowBuilder.listing.noUser")}
                      />
                    </TableCell>
                  </>
                )}
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatUpdatedAt(row.lastUpdatedAt, locale)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function FlowBuilderListingPagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center gap-2 py-3">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label={t("omnichannel.settings.flowBuilder.listing.prevPage")}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
        aria-label={t("omnichannel.settings.flowBuilder.listing.nextPage")}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

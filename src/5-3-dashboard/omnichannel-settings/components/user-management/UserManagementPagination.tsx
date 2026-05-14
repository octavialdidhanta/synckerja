import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";

type UserManagementPaginationProps = {
  page: number;
  pageCount: number;
  rowsPerPage: number;
  onRowsPerPageChange: (n: number) => void;
  onPageChange: (p: number) => void;
  totalFiltered: number;
  showingFrom: number;
  showingTo: number;
};

export function UserManagementPagination({
  page,
  pageCount,
  rowsPerPage,
  onRowsPerPageChange,
  onPageChange,
  totalFiltered,
  showingFrom,
  showingTo,
}: UserManagementPaginationProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-w-0 flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap">{t("omnichannel.settings.userManagement.rowsPerPage")}</span>
          <Select
            value={String(rowsPerPage)}
            onValueChange={(v) => onRowsPerPageChange(Number.parseInt(v, 10) || 10)}
          >
            <SelectTrigger className="h-8 w-[4.25rem] bg-background px-2 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span>
          {t("omnichannel.settings.userManagement.showingRange", {
            from: totalFiltered === 0 ? 0 : showingFrom,
            to: showingTo,
            total: totalFiltered,
          })}
        </span>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2">
        <div className="flex items-center gap-1 tabular-nums text-primary/80">
          <span>{page}</span>
          <span>{t("omnichannel.settings.userManagement.ofPages", { count: pageCount })}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7 shrink-0"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label={t("omnichannel.settings.userManagement.prevPage")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7 shrink-0"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
            aria-label={t("omnichannel.settings.userManagement.nextPage")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

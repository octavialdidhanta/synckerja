import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { useTranslation } from "react-i18next";

type RecipientListsTableFooterProps = {
  totalRows: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

export function RecipientListsTableFooter({
  totalRows,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: RecipientListsTableFooterProps) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = totalRows === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(totalRows, safePage * pageSize);
  const [jumpValue, setJumpValue] = useState(String(safePage));

  useEffect(() => {
    setJumpValue(String(safePage));
  }, [safePage]);

  const applyJump = useCallback(() => {
    const n = Number.parseInt(jumpValue, 10);
    if (Number.isNaN(n)) {
      setJumpValue(String(safePage));
      return;
    }
    const clamped = Math.min(totalPages, Math.max(1, n));
    onPageChange(clamped);
    setJumpValue(String(clamped));
  }, [jumpValue, onPageChange, safePage, totalPages]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap">{t("whatsappTemplates.recipientLists.footer.rowsPerPage")}</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  onPageSizeChange(Number(v));
                  onPageChange(1);
                }}
              >
                <SelectTrigger className="h-8 w-[4.5rem] border-border bg-background text-xs text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)} className="text-xs">
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="whitespace-nowrap text-muted-foreground/90">
              {t("whatsappTemplates.recipientLists.footer.showingRange", {
                start,
                end,
                total: totalRows,
              })}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={jumpValue}
                    onChange={(e) => setJumpValue(e.target.value)}
                    onBlur={applyJump}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyJump();
                      }
                    }}
                    className="h-8 w-12 border-border bg-background px-1 text-center text-xs tabular-nums text-foreground"
                    aria-label={t("whatsappTemplates.recipientLists.footer.jumpToPageAria")}
                  />
                  <span className="whitespace-nowrap text-muted-foreground/90">
                    {t("whatsappTemplates.recipientLists.footer.ofPages", { count: totalPages })}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {t("whatsappTemplates.recipientLists.footer.jumpToPageTooltip")}
              </TooltipContent>
            </Tooltip>
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                disabled={safePage <= 1}
                onClick={() => onPageChange(safePage - 1)}
                aria-label={t("whatsappTemplates.recipientLists.footer.prevPage")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                disabled={safePage >= totalPages}
                onClick={() => onPageChange(safePage + 1)}
                aria-label={t("whatsappTemplates.recipientLists.footer.nextPage")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

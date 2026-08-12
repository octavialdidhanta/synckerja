import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/mobile-app/components/ui/drawer";
import type {
  ReportServiceFilterOption,
  ReportServiceFilterValue,
} from "@/6-0-digital-marketing-shared/reportServiceFilter";

type Props = {
  options: ReportServiceFilterOption[];
  value: ReportServiceFilterValue;
  onChange: (value: ReportServiceFilterValue) => void;
  disabled?: boolean;
  className?: string;
};

export function MobileReportServicePicker({
  options,
  value,
  onChange,
  disabled,
  className,
}: Props) {
  const { t } = useAppTranslation();
  const [open, setOpen] = useState(false);

  const active = useMemo(
    () => options.find((o) => o.value === value) ?? options[0] ?? null,
    [options, value],
  );

  const fieldLabel = t("digitalMarketing.report.tableServiceFilterLabel", "Service");

  return (
    <div className={cn("w-full", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-auto min-h-9 w-full flex-col items-start gap-0 px-3 py-1.5 text-left text-xs font-normal"
        disabled={disabled || options.length === 0}
        onClick={() => setOpen(true)}
        aria-label={fieldLabel}
      >
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {fieldLabel}
        </span>
        <span className="flex w-full min-w-0 items-center gap-1">
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
            {active?.label ??
              t("digitalMarketing.report.serviceFilterAll", "All services")}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        </span>
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[85vh] px-0 pb-4">
          <DrawerHeader className="px-4 pb-2 text-left">
            <DrawerTitle className="text-base">{fieldLabel}</DrawerTitle>
          </DrawerHeader>
          <div className="max-h-[min(60vh,360px)] overflow-y-auto px-2 pb-2">
            <ul className="space-y-0.5" role="list">
              {options.map((opt) => {
                const isActive = opt.value === value;
                return (
                  <li key={opt.value || "all"}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm touch-manipulation",
                        isActive
                          ? "bg-primary/10 font-medium text-primary"
                          : "text-foreground hover:bg-muted/60",
                      )}
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isActive ? "opacity-100" : "opacity-0",
                        )}
                        aria-hidden
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

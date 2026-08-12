import { useMemo } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/mobile-app/components/ui/command";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/mobile-app/components/ui/drawer";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  reportSummaryMetricGroups,
  type ReportSummaryMetricOption,
} from "@/6-0-digital-marketing-shared/reportSummaryMetrics";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedKey: string;
  onSelectKey: (key: string) => void;
  options: ReportSummaryMetricOption[];
};

export function MobileReportMetricPickerSheet({
  open,
  onOpenChange,
  selectedKey,
  onSelectKey,
  options,
}: Props) {
  const { t } = useAppTranslation();
  const groups = useMemo(() => reportSummaryMetricGroups(options), [options]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] px-0 pb-4">
        <DrawerHeader className="px-4 pb-2 text-left">
          <DrawerTitle className="text-base">
            {t("digitalMarketing.report.summarySearchMetrics", "Search metrics…")}
          </DrawerTitle>
        </DrawerHeader>
        <Command className="rounded-none border-0 bg-transparent">
          <CommandInput
            placeholder={t(
              "digitalMarketing.report.summarySearchMetrics",
              "Search metrics…",
            )}
          />
          <CommandList className="max-h-[min(60vh,360px)] px-1">
            <CommandEmpty>
              {t("digitalMarketing.report.summaryNoMetrics", "No metrics found.")}
            </CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.id} heading={group.label}>
                {group.options.map((opt) => (
                  <CommandItem
                    key={opt.key}
                    value={`${opt.label} ${opt.key}`}
                    onSelect={() => {
                      onSelectKey(opt.key);
                      onOpenChange(false);
                    }}
                  >
                    <span
                      className={cn(
                        "truncate",
                        opt.key === selectedKey && "font-medium text-primary",
                      )}
                    >
                      {opt.label}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DrawerContent>
    </Drawer>
  );
}

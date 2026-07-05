import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { cn } from "@/shared/lib/utils";
import { FLOW_BUILDER_STATUS_FILTERS } from "@/5-3-dashboard/omnichannel-settings/constants/flowBuilderFilters";
import { FlowBuilderPillFilterTrigger } from "@/5-3-dashboard/omnichannel-settings/components/flow-builder/listing/filters/FlowBuilderPillFilterTrigger";
import type { FlowBuilderStatusFilter } from "@/5-3-dashboard/omnichannel-settings/types/flowBuilder.types";

type FlowBuilderStatusFilterProps = {
  value: FlowBuilderStatusFilter;
  onChange: (value: FlowBuilderStatusFilter) => void;
};

export function FlowBuilderStatusFilter({ value, onChange }: FlowBuilderStatusFilterProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const label = t(`omnichannel.settings.flowBuilder.filters.statusLabel`, {
    value: t(`omnichannel.settings.flowBuilder.filters.status.${value}`),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FlowBuilderPillFilterTrigger label={label} open={open} aria-label={label} />
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="start">
        <ul className="py-1">
          {FLOW_BUILDER_STATUS_FILTERS.map((option) => {
            const selected = value === option;
            return (
              <li key={option}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center rounded-sm px-3 py-2 text-sm transition-colors hover:bg-muted/60",
                    selected ? "font-medium text-primary" : "text-foreground",
                  )}
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  {t(`omnichannel.settings.flowBuilder.filters.status.${option}`)}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

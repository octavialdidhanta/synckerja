import { useEffect, useState } from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { FlowBuilderDatePickerPanel } from "@/5-3-dashboard/omnichannel-settings/components/flow-builder/listing/filters/FlowBuilderDatePickerPanel";
import { FlowBuilderPillFilterTrigger } from "@/5-3-dashboard/omnichannel-settings/components/flow-builder/listing/filters/FlowBuilderPillFilterTrigger";

type FlowBuilderLastUpdatedFilterProps = {
  value: Date | null;
  onChange: (value: Date | null) => void;
};

export function FlowBuilderLastUpdatedFilter({ value, onChange }: FlowBuilderLastUpdatedFilterProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<Date | undefined>(value ?? undefined);
  const locale = i18n.language === "id" ? idLocale : enUS;

  useEffect(() => {
    if (open) setDraftDate(value ?? undefined);
  }, [open, value]);

  const triggerLabel = value
    ? format(value, "dd MMM yyyy", { locale })
    : t("omnichannel.settings.flowBuilder.filters.lastUpdated");

  const confirm = () => {
    onChange(draftDate ?? null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <FlowBuilderPillFilterTrigger
          label={triggerLabel}
          open={open}
          trailingIcon={<CalendarIcon className="h-4 w-4 shrink-0 opacity-60" aria-hidden />}
          aria-label={t("omnichannel.settings.flowBuilder.filters.lastUpdated")}
        />
      </PopoverTrigger>
      <PopoverContent
        className="w-auto overflow-hidden rounded-lg border border-border p-0 shadow-lg"
        align="start"
        sideOffset={6}
      >
        <FlowBuilderDatePickerPanel
          value={draftDate}
          onChange={setDraftDate}
          onConfirm={confirm}
          confirmLabel={t("omnichannel.settings.flowBuilder.filters.confirmDate")}
        />
      </PopoverContent>
    </Popover>
  );
}

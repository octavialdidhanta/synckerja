import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import {
  countTemplateBodySlots,
  templateSelectionKey,
  useApprovedWhatsAppTemplatesFlat,
} from "@/5-3-dashboard/omnichannel-settings/hooks/useApprovedWhatsAppTemplatesFlat";
import type { TemplateTableRow } from "@/5-3-whatsapp-template/types";
import { cn } from "@/shared/lib/utils";

export type WhatsAppTemplateSelection = {
  name: string;
  language: string;
};

const INVOICE_EXPECTED_BODY_SLOTS = 4;
const LEAD_FALLBACK_BODY_SLOTS = 7;

type WhatsAppTemplatePickerProps = {
  id: string;
  value: WhatsAppTemplateSelection | null;
  onChange: (next: WhatsAppTemplateSelection | null) => void;
  purpose: "invoice" | "lead";
  disabled?: boolean;
  queryEnabled?: boolean;
  /** When lead mapping is complete in API Integration, hide fixed-7 fallback warning. */
  leadMappingComplete?: boolean;
  /** Hide helper line under label (e.g. when parent already shows section subtitle). */
  hideApprovedHint?: boolean;
};

function rowLanguageCode(row: TemplateTableRow): string {
  return row.languageCode === "—" ? "id" : row.languageCode;
}

function findMatchingRow(
  rows: TemplateTableRow[],
  value: WhatsAppTemplateSelection | null,
): TemplateTableRow | undefined {
  if (!value?.name.trim()) return undefined;
  const key = templateSelectionKey(value.name, value.language || "id");
  return rows.find(
    (row) => templateSelectionKey(row.templateName, rowLanguageCode(row)) === key,
  );
}

function slotWarning(
  purpose: "invoice" | "lead",
  slotCount: number,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string | null {
  if (purpose === "invoice" && slotCount !== INVOICE_EXPECTED_BODY_SLOTS) {
    return t("omnichannel.settings.apiIntegration.waTemplatePickerSlotWarningInvoice", {
      count: slotCount,
    });
  }
  if (purpose === "lead" && slotCount !== LEAD_FALLBACK_BODY_SLOTS) {
    return t("omnichannel.settings.apiIntegration.waTemplatePickerSlotWarningLead", {
      count: slotCount,
    });
  }
  return null;
}

export function WhatsAppTemplatePicker({
  id,
  value,
  onChange,
  purpose,
  disabled = false,
  queryEnabled = true,
  leadMappingComplete = false,
  hideApprovedHint = false,
}: WhatsAppTemplatePickerProps) {
  const { t } = useTranslation();
  const { rows, isLoading, waConfigured } = useApprovedWhatsAppTemplatesFlat({ enabled: queryEnabled });

  const [open, setOpen] = useState(false);

  const matchedRow = useMemo(() => findMatchingRow(rows, value), [rows, value]);
  const valueMissingFromMeta =
    Boolean(value?.name.trim()) && !isLoading && waConfigured && !matchedRow;

  const comboboxLabel = useMemo(() => {
    if (!value?.name.trim()) {
      return t("omnichannel.settings.apiIntegration.waTemplatePickerPlaceholder");
    }
    if (matchedRow) {
      const slots = countTemplateBodySlots(matchedRow);
      return `${matchedRow.templateName} · ${matchedRow.languageLabel} · ${slots} vars`;
    }
    return `${value.name} · ${value.language || "id"}`;
  }, [value, matchedRow, t]);

  const selectedKey = value?.name.trim()
    ? templateSelectionKey(value.name, value.language || "id")
    : "";

  const warningText =
    matchedRow != null && !(purpose === "lead" && leadMappingComplete)
      ? slotWarning(purpose, countTemplateBodySlots(matchedRow), t)
      : null;

  const handleSelectRow = (row: TemplateTableRow) => {
    onChange({
      name: row.templateName,
      language: rowLanguageCode(row),
    });
    setOpen(false);
  };

  const comboboxDisabled = disabled || isLoading || !waConfigured;

  return (
    <div className="space-y-2">
      {!hideApprovedHint && !waConfigured ? (
        <p className="text-xs text-muted-foreground">
          {t("omnichannel.settings.apiIntegration.waTemplatePickerWaNotConfigured")}{" "}
          <Link
            to="/omnichannel/integrations/whatsapp"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            {t("omnichannel.settings.apiIntegration.waTemplatePickerConnectLink")}
          </Link>
        </p>
      ) : !hideApprovedHint ? (
        <p className="text-xs text-muted-foreground">
          {t("omnichannel.settings.apiIntegration.waTemplatePickerApprovedOnly")}
        </p>
      ) : null}

      {valueMissingFromMeta ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {t("omnichannel.settings.apiIntegration.waTemplatePickerNotFound")}
        </p>
      ) : null}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={comboboxDisabled}
            className="h-10 w-full justify-between font-mono text-sm font-normal"
          >
            <span className={cn("truncate", !value?.name && "text-muted-foreground")}>
              {isLoading ? (
                <span className="inline-flex items-center gap-2 font-sans">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  <span className="sr-only">{t("common.loading")}</span>
                </span>
              ) : (
                comboboxLabel
              )}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput
              placeholder={t("omnichannel.settings.apiIntegration.waTemplatePickerSearch")}
              className="h-10"
            />
            <CommandList className="max-h-72">
              <CommandEmpty>
                {t("omnichannel.settings.apiIntegration.waTemplatePickerEmpty")}
              </CommandEmpty>
              {rows.map((row) => {
                const slots = countTemplateBodySlots(row);
                const key = templateSelectionKey(row.templateName, rowLanguageCode(row));
                return (
                  <CommandItem key={row.id} value={key} onSelect={() => handleSelectRow(row)}>
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        selectedKey === key ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate font-mono text-sm">
                      {row.templateName} · {row.languageLabel} · {slots} vars
                    </span>
                  </CommandItem>
                );
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {warningText ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {warningText}
        </p>
      ) : null}
    </div>
  );
}

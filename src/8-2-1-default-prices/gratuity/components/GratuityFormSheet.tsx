import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { useCatalogGratuities } from "../hooks/useCatalogGratuities";
import type { CatalogGratuity } from "../types";
import { GratuityOutletsSection } from "./GratuityOutletsSection";

export type GratuityFormSheetProps = {
  gratuity: CatalogGratuity | null;
  selectedOutletId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function formatAmountDisplay(value: number): string {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function parseAmountInput(raw: string): { display: string; value: number | null } {
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(",", ".");
  const parts = cleaned.split(".");
  const display =
    parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("").slice(0, 1)}` : parts[0] ?? "";
  if (!display) return { display: "", value: null };
  const n = Number(display);
  if (!Number.isFinite(n)) return { display, value: null };
  return { display, value: n };
}

export function GratuityFormSheet({
  gratuity,
  selectedOutletId,
  open,
  onOpenChange,
}: GratuityFormSheetProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { save, isSaving } = useCatalogGratuities();
  const [name, setName] = useState("");
  const [amountDisplay, setAmountDisplay] = useState("");
  const [outletIds, setOutletIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (gratuity) {
      setName(gratuity.name);
      setAmountDisplay(formatAmountDisplay(gratuity.amount_percent));
      setOutletIds([...(gratuity.outlet_ids ?? [])]);
    } else {
      setName("");
      setAmountDisplay("");
      setOutletIds(selectedOutletId ? [selectedOutletId] : []);
    }
  }, [open, gratuity, selectedOutletId]);

  const parsedAmount = parseAmountInput(amountDisplay).value;
  const nameValid = name.trim().length > 0;
  const amountValid = parsedAmount != null && parsedAmount >= 0 && parsedAmount <= 100;
  const title = gratuity
    ? t("defaultPrices.gratuity.editTitle", "Edit gratuity")
    : t("defaultPrices.gratuity.addTitle", "New gratuity");

  const handleSave = async () => {
    if (!nameValid) {
      toast({
        title: t("defaultPrices.gratuity.nameRequired", "Enter a gratuity name."),
        variant: "destructive",
      });
      return;
    }
    if (!amountValid || parsedAmount == null) {
      toast({
        title: t("defaultPrices.gratuity.amountInvalid", "Enter an amount between 0 and 100."),
        variant: "destructive",
      });
      return;
    }
    if (outletIds.length < 1) {
      toast({
        title: t("outlets.assign.minOne", "Please select minimum one outlet"),
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await save({
        id: gratuity?.id,
        name: name.trim(),
        amount_percent: parsedAmount,
        outlet_ids: outletIds,
      });
      toast({ title: t("defaultPrices.gratuity.saved", "Gratuity saved.") });
      onOpenChange(false);
    } catch {
      toast({
        title: t("defaultPrices.form.saveFailed", "Failed to save."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || isSaving;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        aria-describedby={undefined}
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12 text-left">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <section className="space-y-3">
            <p className="border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("defaultPrices.gratuity.section", "Gratuity information")}
            </p>
            <div className="grid grid-cols-[1fr_140px] gap-2">
              <div className="relative">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("defaultPrices.gratuity.namePlaceholder", "Name")}
                  className={cn(nameValid && "pr-8")}
                />
                {nameValid ? (
                  <Check className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
                ) : null}
              </div>
              <div className="flex">
                <div className="relative min-w-0 flex-1">
                  <Input
                    inputMode="decimal"
                    value={amountDisplay}
                    onChange={(e) => setAmountDisplay(parseAmountInput(e.target.value).display)}
                    placeholder={t("defaultPrices.gratuity.amountPlaceholder", "Amount")}
                    className={cn("rounded-r-none", amountValid && "pr-8")}
                  />
                  {amountValid ? (
                    <Check className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
                  ) : null}
                </div>
                <span className="inline-flex items-center rounded-r-md border border-l-0 border-input bg-muted px-2.5 text-sm text-muted-foreground">
                  %
                </span>
              </div>
            </div>
          </section>
          <GratuityOutletsSection selectedIds={outletIds} onChange={setOutletIds} />
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={busy}>
            {t("common.save", "Save")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

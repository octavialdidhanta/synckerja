import { useEffect, useState } from "react";
import { Label } from "@/shared/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { useToast } from "@/shared/hooks/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useSelectedPosOutlet } from "@/8-2-2-outlets/hooks/useSelectedPosOutlet";
import {
  usePosOutletStockSettings,
} from "@/stock-management/stock-commit/hooks/usePosOutletStockSettings";
import type { StockCommitPoint } from "@/stock-management/stock-commit/types/stockCommitPoint";

const OPTIONS: Array<{
  value: StockCommitPoint;
  labelKey: string;
  labelFallback: string;
  descKey: string;
  descFallback: string;
  disabled?: boolean;
}> = [
  {
    value: "pay",
    labelKey: "settings.inventory.stockCommitPoint.pay",
    labelFallback: "Pay (retail counter)",
    descKey: "settings.inventory.stockCommitPoint.payDesc",
    descFallback: "Deduct stock when payment completes. Default for retail.",
  },
  {
    value: "kitchen",
    labelKey: "settings.inventory.stockCommitPoint.kitchen",
    labelFallback: "Kitchen (F&B)",
    descKey: "settings.inventory.stockCommitPoint.kitchenDesc",
    descFallback: "Deduct ingredients when order tickets print. Payment skips already committed lines.",
  },
  {
    value: "fulfillment",
    labelKey: "settings.inventory.stockCommitPoint.fulfillment",
    labelFallback: "Fulfillment (warehouse)",
    descKey: "settings.inventory.stockCommitPoint.fulfillmentDesc",
    descFallback: "Reserve on order; deduct finished goods when marked shipped from Bill List.",
  },
];

export function StockCommitPointSection() {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { selectedOutletId, selectedOutletName } = useSelectedPosOutlet();
  const { stockCommitPoint, isLoading, save } = usePosOutletStockSettings(
    selectedOutletId || null,
  );
  const [local, setLocal] = useState<StockCommitPoint>(stockCommitPoint);

  useEffect(() => {
    setLocal(stockCommitPoint);
  }, [stockCommitPoint]);

  if (!selectedOutletId) {
    return null;
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-background p-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900">
          {t("settings.inventory.stockCommitPoint.title", "Stock commit point")}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            "settings.inventory.stockCommitPoint.outletHint",
            "When should this outlet deduct inventory? Outlet: {{name}}",
            { name: selectedOutletName || selectedOutletId },
          )}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t(
            "settings.inventory.stockCommitPoint.savesImmediately",
            "Applies as soon as you select an option. The Save button above is for purchase order and transfer settings only.",
          )}
        </p>
      </div>

      <RadioGroup
        value={local}
        onValueChange={(v) => {
          const next = v as StockCommitPoint;
          if (next === local || save.isPending) return;
          const previous = local;
          setLocal(next);
          void save.mutateAsync(next).then(
            () => {
              toast({
                title: t("settings.inventory.stockCommitPoint.saved", "Stock commit point updated"),
              });
            },
            (error) => {
              setLocal(previous);
              toast({
                title: t(
                  "settings.inventory.stockCommitPoint.saveError",
                  "Failed to update stock commit point",
                ),
                description: error instanceof Error ? error.message : String(error),
                variant: "destructive",
              });
            },
          );
        }}
        className="space-y-3"
        disabled={isLoading || save.isPending}
      >
        {OPTIONS.map((opt) => (
          <div
            key={opt.value}
            className="flex items-start gap-3 rounded-md border border-border px-3 py-3"
          >
            <RadioGroupItem value={opt.value} id={`stock-commit-${opt.value}`} className="mt-1" />
            <div className="min-w-0 flex-1">
              <Label htmlFor={`stock-commit-${opt.value}`} className="font-medium">
                {t(opt.labelKey, opt.labelFallback)}
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t(opt.descKey, opt.descFallback)}
              </p>
            </div>
          </div>
        ))}
      </RadioGroup>
    </section>
  );
}

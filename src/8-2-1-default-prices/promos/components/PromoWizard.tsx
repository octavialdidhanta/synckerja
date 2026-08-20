import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronUp } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { usePosOutlets } from "@/8-2-2-outlets/hooks/usePosOutlets";
import { activePosOutletIds } from "@/8-2-2-outlets/lib/assignedOutlets";
import { useDefaultPrices } from "../../hooks/useDefaultPrices";
import { useCatalogProductCategories } from "../../categories";
import { useCatalogSalesTypes } from "../../sales-types";
import { useCatalogPromos } from "../hooks/useCatalogPromos";
import type { CatalogPromo, CatalogPromoSave, PromoDraft } from "../types";
import { emptyPromoDraft, newRequirementDraft } from "../types";
import { PromoInformationStep } from "./PromoInformationStep";
import { PromoRequirementStep } from "./PromoRequirementStep";
import { PromoRewardStep } from "./PromoRewardStep";
import { PromoConfigurationStep } from "./PromoConfigurationStep";

export type PromoWizardProps = {
  promo: CatalogPromo | null;
  onClose: () => void;
};

function formatAmountDisplay(value: number | null, unit: PromoDraft["reward_amount_unit"]): string {
  if (value == null || !Number.isFinite(value)) return "";
  if (unit === "percent") {
    const rounded = Math.round(value * 10) / 10;
    return String(rounded);
  }
  return String(Math.round(value));
}

function draftFromPromo(promo: CatalogPromo): PromoDraft {
  const kind = promo.requirements[0]?.kind === "category" ? "category" : "item";
  return {
    id: promo.id,
    name: promo.name,
    promo_type: promo.promo_type,
    sales_type_scope: promo.sales_type_scope,
    sales_type_ids: promo.sales_type_ids,
    outlet_ids: [...promo.outlet_ids],
    requirement_kind: kind,
    requirements:
      promo.requirements.length > 0
        ? promo.requirements.map((req) => ({
            key: req.id ?? newRequirementDraft().key,
            quantity: String(req.quantity),
            product_id: req.product_id ?? "",
            category_id: req.category_id ?? "",
          }))
        : [newRequirementDraft()],
    reward_amount_unit: promo.reward_amount_unit === "percent" ? "percent" : "rp",
    reward_amount_display: formatAmountDisplay(
      promo.reward_amount_value,
      promo.reward_amount_unit === "percent" ? "percent" : "rp",
    ),
    reward_product_id: promo.reward_product_id ?? "",
    reward_quantity: String(promo.reward_quantity || 1),
    applies_in_multiple: promo.applies_in_multiple,
    time_period_enabled: promo.time_period_enabled,
    starts_on: promo.starts_on ?? "",
    ends_on: promo.ends_on ?? "",
    starts_at_time: promo.starts_at_time ?? "",
    ends_at_time: promo.ends_at_time ?? "",
  };
}

function isStep1Valid(draft: PromoDraft): boolean {
  if (!draft.name.trim()) return false;
  if (draft.outlet_ids.length < 1) return false;
  if (draft.sales_type_scope === "specific" && draft.sales_type_ids.length === 0) return false;
  return true;
}

function isStep2Valid(draft: PromoDraft): boolean {
  return draft.requirements.some((row) => {
    const qty = Number(row.quantity);
    if (!Number.isFinite(qty) || qty < 1) return false;
    return draft.requirement_kind === "item" ? Boolean(row.product_id) : Boolean(row.category_id);
  });
}

function isStep3Valid(draft: PromoDraft): boolean {
  if (draft.promo_type === "free_item") {
    const qty = Number(draft.reward_quantity);
    return Boolean(draft.reward_product_id) && Number.isFinite(qty) && qty >= 1;
  }
  const amount = Number(draft.reward_amount_display);
  if (!Number.isFinite(amount) || amount < 0) return false;
  if (draft.reward_amount_unit === "percent" && amount > 100) return false;
  return draft.reward_amount_display.trim().length > 0;
}

function isStep4Valid(draft: PromoDraft): boolean {
  if (!draft.time_period_enabled) return true;
  if (!draft.starts_on || !draft.ends_on) return false;
  return draft.ends_on >= draft.starts_on;
}

function toSavePayload(draft: PromoDraft): CatalogPromoSave {
  const amount = Number(draft.reward_amount_display);
  return {
    id: draft.id,
    name: draft.name.trim(),
    promo_type: draft.promo_type,
    sales_type_scope: draft.sales_type_scope,
    sales_type_ids: draft.sales_type_scope === "specific" ? draft.sales_type_ids : [],
    outlet_ids: draft.outlet_ids,
    applies_in_multiple: draft.applies_in_multiple,
    time_period_enabled: draft.time_period_enabled,
    starts_on: draft.time_period_enabled ? draft.starts_on : null,
    ends_on: draft.time_period_enabled ? draft.ends_on : null,
    starts_at_time: draft.time_period_enabled && draft.starts_at_time ? draft.starts_at_time : null,
    ends_at_time: draft.time_period_enabled && draft.ends_at_time ? draft.ends_at_time : null,
    reward_amount_unit: draft.promo_type === "discount_per_item" ? draft.reward_amount_unit : null,
    reward_amount_value: draft.promo_type === "discount_per_item" ? amount : null,
    reward_product_id: draft.promo_type === "free_item" ? draft.reward_product_id : null,
    reward_quantity: draft.promo_type === "free_item" ? Math.max(1, Number(draft.reward_quantity) || 1) : 1,
    requirements: draft.requirements
      .filter((row) => {
        const qty = Number(row.quantity);
        if (!Number.isFinite(qty) || qty < 1) return false;
        return draft.requirement_kind === "item" ? Boolean(row.product_id) : Boolean(row.category_id);
      })
      .map((row) => ({
        kind: draft.requirement_kind,
        quantity: Number(row.quantity),
        product_id: draft.requirement_kind === "item" ? row.product_id : null,
        category_id: draft.requirement_kind === "category" ? row.category_id : null,
      })),
  };
}

export function PromoWizard({ promo, onClose }: PromoWizardProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { save, isSaving } = useCatalogPromos();
  const { rows: catalogRows } = useDefaultPrices();
  const categories = useCatalogProductCategories();
  const salesTypes = useCatalogSalesTypes();
  const { rows: outlets } = usePosOutlets();
  const [draft, setDraft] = useState<PromoDraft>(() => (promo ? draftFromPromo(promo) : emptyPromoDraft()));
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const seededOutlets = useRef(false);

  useEffect(() => {
    setDraft(promo ? draftFromPromo(promo) : emptyPromoDraft());
    setStep(1);
    seededOutlets.current = Boolean(promo);
  }, [promo]);

  useEffect(() => {
    if (promo || seededOutlets.current) return;
    const ids = activePosOutletIds(outlets);
    if (ids.length === 0) return;
    seededOutlets.current = true;
    setDraft((prev) => (prev.outlet_ids.length > 0 ? prev : { ...prev, outlet_ids: ids }));
  }, [promo, outlets]);

  const patch = (next: Partial<PromoDraft>) => setDraft((prev) => ({ ...prev, ...next }));
  const stepValid = [
    isStep1Valid(draft),
    isStep2Valid(draft),
    isStep3Valid(draft),
    isStep4Valid(draft),
  ];
  const allValid = stepValid.every(Boolean);

  const steps = useMemo(
    () => [
      { id: 1, title: t("defaultPrices.promos.step1", "1. Promo information") },
      { id: 2, title: t("defaultPrices.promos.step2", "2. Purchase requirement") },
      { id: 3, title: t("defaultPrices.promos.step3", "3. Reward") },
      { id: 4, title: t("defaultPrices.promos.step4", "4. Promo configuration") },
    ],
    [t],
  );

  const handleSave = async () => {
    if (!allValid) return;
    setSaving(true);
    try {
      await save(toSavePayload(draft));
      toast({ title: t("defaultPrices.promos.saved", "Promo saved.") });
      onClose();
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
    <div className="space-y-3">
      {steps.map((item) => {
        const open = step === item.id;
        const valid = stepValid[item.id - 1];
        return (
          <section key={item.id} className="overflow-hidden rounded-lg border bg-card">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left"
              onClick={() => setStep(item.id)}
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {item.title}
              </span>
              <span className="flex items-center gap-2">
                {valid ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : open ? (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                ) : null}
                <ChevronUp className={cn("h-4 w-4 text-muted-foreground transition-transform", !open && "rotate-180")} />
              </span>
            </button>
            {open ? (
              <div className="border-t px-4 py-4">
                {item.id === 1 ? (
                  <PromoInformationStep
                    draft={draft}
                    onChange={patch}
                    salesTypes={salesTypes.rows.filter((row) => row.is_active)}
                    onNext={() => setStep(2)}
                    canNext={stepValid[0]}
                  />
                ) : null}
                {item.id === 2 ? (
                  <PromoRequirementStep
                    draft={draft}
                    onChange={patch}
                    products={catalogRows}
                    categories={categories.rows}
                    onPrevious={() => setStep(1)}
                    onNext={() => setStep(3)}
                    canNext={stepValid[1]}
                  />
                ) : null}
                {item.id === 3 ? (
                  <PromoRewardStep
                    draft={draft}
                    onChange={patch}
                    products={catalogRows}
                    onPrevious={() => setStep(2)}
                    onNext={() => setStep(4)}
                    canNext={stepValid[2]}
                  />
                ) : null}
                {item.id === 4 ? (
                  <PromoConfigurationStep
                    draft={draft}
                    onChange={patch}
                    onPrevious={() => setStep(3)}
                  />
                ) : null}
              </div>
            ) : null}
          </section>
        );
      })}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          {t("common.cancel", "Cancel")}
        </Button>
        <Button type="button" onClick={() => void handleSave()} disabled={busy || !allValid}>
          {promo
            ? t("common.save", "Save")
            : t("defaultPrices.promos.createAction", "Create")}
        </Button>
      </div>
    </div>
  );
}

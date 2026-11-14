import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useProductKnowledge, type ProductKnowledge } from "@/6-1-product-knowledge/hooks/useProductKnowledge";
import { isGeminiBillingNoticeError } from "@/shared/ai/geminiSpendCap";
import { askThinkingLab, parseModelJson } from "@/thinking-lab/shared/ai";
import {
  buildProductBeliefPrompt,
  parseProductBeliefDraft,
  type ProductBeliefDraft,
  type ProductBeliefSourceRow,
} from "@/thinking-lab/master-thought/productBrief";
import { buildProductReasonPool, type ProductReasonPool } from "@/thinking-lab/master-thought/productReasonPool";
import type { LabCatalog, MasterCatalogLink } from "@/thinking-lab/master-thought/catalog";

type Props = {
  link: MasterCatalogLink;
  catalogs: LabCatalog[];
  disabled?: boolean;
  onApply: (draft: ProductBeliefDraft) => void;
  onPoolChange?: (pool: ProductReasonPool | null) => void;
};

function plain(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
  if (Array.isArray(value)) return value.map((item) => plain(item)).filter(Boolean).join("; ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function sourceRow(row: ProductKnowledge): ProductBeliefSourceRow {
  return {
    category: plain(row.service_name),
    subCategory: plain(row.sub_service_name),
    feature: plain(row.feature_name),
    featureDescription: plain(row.feature_description),
    solution: plain(row.solusi),
    competitiveAdvantage: plain(row.competitive_advantage),
    customerPersona: plain(row.target_audience),
    problem: plain(row.problems_solved),
    impact: plain(row.impact),
    wants: plain(row.wants),
    needs: plain(row.needs),
    hiddenNeeds: plain(row.hidden_needs),
    falseBelief: plain(row.false_belief),
    falseBeliefImpact: plain(row.false_belief_impact),
    whatMakesThemStop: plain(row.what_makes_them_stop),
  };
}

/**
 * Reads the Product Knowledge behind the catalog features picked above: freezes them as the reason pool
 * for Big Thought and can fill the beliefs from them. No feature picked → Big Thought looks for general reasons.
 */
export function ProductBeliefSource({ link, catalogs, disabled, onApply, onPoolChange }: Props) {
  const { t } = useAppTranslation();
  const knowledge = useProductKnowledge();
  const [pending, setPending] = useState(false);
  const catalog = catalogs.find((item) => item.id === link.serviceId);
  const selected = useMemo(() => {
    if (!catalog || link.featureIds.length === 0) return [];
    const names = new Set(
      catalog.features
        .filter((feature) => link.featureIds.includes(feature.id))
        .map((feature) => feature.name.trim().toLowerCase()),
    );
    return (knowledge.data ?? []).filter(
      (row) =>
        row.service_id === catalog.id &&
        ((row.feature_id && link.featureIds.includes(row.feature_id)) ||
          names.has(plain(row.feature_name).toLowerCase())),
    );
  }, [catalog, knowledge.data, link.featureIds]);
  const pool = useMemo(
    () => (catalog && link.featureIds.length > 0 ? buildProductReasonPool(catalog.name, selected.map(sourceRow)) : null),
    [catalog, link.featureIds.length, selected],
  );

  useEffect(() => {
    onPoolChange?.(pool);
  }, [onPoolChange, pool]);

  useEffect(() => () => onPoolChange?.(null), [onPoolChange]);

  const onAnalyze = async () => {
    setPending(true);
    try {
      const script = await askThinkingLab(buildProductBeliefPrompt(selected.map(sourceRow)), 0.2);
      const draft = parseProductBeliefDraft(script ? parseModelJson(script) : null);
      if (!draft) {
        toast.error(t("thinkingLab.product.failed", "The analysis did not come back. Try again."));
        return;
      }
      onApply(draft);
      toast.success(
        t(
          "thinkingLab.product.applied",
          "Old belief, new belief, and target audience are filled from the selected features. You can still edit them.",
        ),
      );
    } catch (error) {
      if (isGeminiBillingNoticeError(error)) return;
      toast.error(t("thinkingLab.product.failed", "The analysis did not come back. Try again."));
    } finally {
      setPending(false);
    }
  };

  if (!catalog) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs font-normal text-muted-foreground">
        {pool && pool.items.length > 0
          ? t("thinkingLab.product.poolCount", "{{name}}: {{count}} alasan akan dibekukan untuk Big Thought.", {
              name: pool.serviceName,
              count: pool.items.length,
            })
          : pool
            ? t(
                "thinkingLab.product.poolEmpty",
                "{{name}} belum punya alasan tersimpan. Generate Big Thought akan berhenti.",
                { name: pool.serviceName },
              )
            : t("thinkingLab.product.poolGeneral", "Belum ada fitur dipilih. Generate Big Thought mencari alasan umum.")}
      </p>
      {selected.length > 0 ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || pending}
          onClick={() => void onAnalyze()}
        >
          {pending
            ? t("thinkingLab.product.analyzing", "Analyzing…")
            : t("thinkingLab.product.analyze", "Isi otomatis dari fitur")}
        </Button>
      ) : null}
    </div>
  );
}

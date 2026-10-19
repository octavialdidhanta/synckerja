import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useProductKnowledge, type ProductKnowledge } from "@/6-1-product-knowledge/hooks/useProductKnowledge";
import { isGeminiSpendCapError } from "@/shared/ai/geminiSpendCap";
import { askThinkingLab, parseModelJson } from "@/thinking-lab/shared/ai";
import {
  buildProductBeliefPrompt,
  parseProductBeliefDraft,
  type ProductBeliefDraft,
  type ProductBeliefSourceRow,
} from "@/thinking-lab/master-thought/productBrief";

type Props = {
  disabled?: boolean;
  onApply: (draft: ProductBeliefDraft) => void;
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

export function ProductBeliefSource({ disabled, onApply }: Props) {
  const { t } = useAppTranslation();
  const knowledge = useProductKnowledge();
  const [serviceId, setServiceId] = useState("");
  const [featureIds, setFeatureIds] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const rows = useMemo(
    () => (knowledge.data ?? []).filter((row) => row.service_id && row.service_name),
    [knowledge.data],
  );
  const services = useMemo(() => {
    const byId = new Map<string, string>();
    for (const row of rows) {
      if (row.service_id && row.service_name && !byId.has(row.service_id)) byId.set(row.service_id, row.service_name);
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [rows]);
  const features = useMemo(
    () => rows.filter((row) => row.service_id === serviceId),
    [rows, serviceId],
  );
  const selected = features.filter((row) => featureIds.includes(row.id));
  const allChecked = features.length > 0 && selected.length === features.length;

  const toggle = (id: string, checked: boolean) => {
    setFeatureIds((current) => {
      if (checked) return current.includes(id) ? current : [...current, id];
      return current.filter((item) => item !== id);
    });
  };

  const onAnalyze = async () => {
    if (selected.length === 0) {
      toast.error(t("thinkingLab.product.needFeature", "Select at least one feature."));
      return;
    }
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
      if (isGeminiSpendCapError(error)) return;
      toast.error(t("thinkingLab.product.failed", "The analysis did not come back. Try again."));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="shrink-0 space-y-2 rounded-md border border-border bg-muted/30 p-3">
      <label className="block space-y-1 text-sm font-medium text-foreground">
        {t("thinkingLab.product.source", "Product or service to sell")}
        <Select
          value={serviceId || undefined}
          onValueChange={(id) => {
            setServiceId(id);
            setFeatureIds([]);
          }}
          disabled={disabled || pending || services.length === 0}
        >
          <SelectTrigger className="mt-1 bg-background font-normal">
            <SelectValue placeholder={t("thinkingLab.product.sourcePlaceholder", "Choose from Product Knowledge")} />
          </SelectTrigger>
          <SelectContent>
            {services.map((service) => (
              <SelectItem key={service.id} value={service.id}>
                {service.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      {services.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("thinkingLab.product.empty", "No product knowledge yet. Add it on the Product Knowledge page first.")}
        </p>
      ) : null}
      {serviceId ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">{t("thinkingLab.product.features", "Features to analyze")}</p>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={allChecked}
                onCheckedChange={(checked) => setFeatureIds(checked ? features.map((row) => row.id) : [])}
                disabled={disabled || pending}
              />
              {t("thinkingLab.product.selectAll", "Select all")}
            </label>
          </div>
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border bg-background p-2">
            {features.map((row) => {
              const title = plain(row.feature_name) || plain(row.sub_service_name) || plain(row.service_name);
              const detail = [plain(row.sub_service_name), plain(row.false_belief)].filter(Boolean).join(" · ");
              return (
                <li key={row.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 hover:bg-muted/60">
                    <Checkbox
                      className="mt-0.5"
                      checked={featureIds.includes(row.id)}
                      onCheckedChange={(checked) => toggle(row.id, checked === true)}
                      disabled={disabled || pending}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm text-foreground">{title}</span>
                      {detail && detail !== title ? (
                        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <Button type="button" variant="secondary" disabled={disabled || pending || selected.length === 0} onClick={() => void onAnalyze()}>
            {pending
              ? t("thinkingLab.product.analyzing", "Analyzing…")
              : t("thinkingLab.product.analyze", "Analyze selected features")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

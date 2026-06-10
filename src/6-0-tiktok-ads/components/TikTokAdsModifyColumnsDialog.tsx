import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";
import {
  TIKTOK_ADS_COLUMN_SET_SELECT_ITEM_CLASS,
  TikTokAdsColumnSetOptionLabel,
} from "@/tiktok-ads/components/TikTokAdsColumnSetOptionLabel";
import type { TikTokAdsColumnSet } from "@/tiktok-ads/hooks/useTikTokAdsColumnSets";
import type { TikTokAdsMetricEntity } from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";
import type {
  TikTokAdsMetricCatalogItem,
  TikTokAdsMetricCatalogResponse,
} from "@/tiktok-ads/metrics/tiktokAdsMetricCatalog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: TikTokAdsMetricEntity;
  catalog: TikTokAdsMetricCatalogResponse;
  selectedKeys: string[];
  columnSets?: TikTokAdsColumnSet[];
  onApply: (keys: string[], options?: { saveColumnSetName?: string }) => void | Promise<void>;
  onDeleteColumnSet?: (id: string) => Promise<void>;
  isSaving?: boolean;
  isDeletingColumnSet?: boolean;
};

function modifyColumnsTitle(
  entity: TikTokAdsMetricEntity,
  t: (key: string, defaultValue: string) => string,
): string {
  if (entity === "adgroup") {
    return t("digitalMarketing.tiktokAds.modifyColumnsTitleAdgroup", "Modify columns — Ad groups");
  }
  if (entity === "ad") {
    return t("digitalMarketing.tiktokAds.modifyColumnsTitleAd", "Modify columns — Ads");
  }
  return t("digitalMarketing.tiktokAds.modifyColumnsTitle", "Modify columns — Campaigns");
}

export function TikTokAdsModifyColumnsDialog({
  open,
  onOpenChange,
  entity,
  catalog,
  selectedKeys,
  columnSets = [],
  onApply,
  onDeleteColumnSet,
  isSaving,
  isDeletingColumnSet,
}: Props) {
  const { t } = useTranslation();
  const maxMetrics = catalog.max_metrics;
  const [draftKeys, setDraftKeys] = useState<string[]>(selectedKeys);
  const [savePreset, setSavePreset] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [activeColumnSetId, setActiveColumnSetId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraftKeys(selectedKeys);
      setSavePreset(false);
      setPresetName("");
      setActiveColumnSetId(null);
    }
  }, [open, selectedKeys]);

  const resolveMetric = (m: TikTokAdsMetricCatalogItem) => ({
    key: m.key,
    label: t(m.labelKey, m.defaultLabel),
  });

  const allMetrics = useMemo(() => {
    const items: Array<{ key: string; label: string; category: string }> = [];
    for (const m of catalog.recommended.metrics) {
      items.push({ ...resolveMetric(m), category: "recommended" });
    }
    for (const cat of catalog.categories) {
      for (const m of cat.metrics) {
        if (!items.some((i) => i.key === m.key)) {
          items.push({
            ...resolveMetric(m),
            category: t(cat.labelKey, cat.defaultLabel),
          });
        }
      }
    }
    return items;
  }, [catalog, t]);

  const draftSet = useMemo(() => new Set(draftKeys), [draftKeys]);
  const atLimit = draftKeys.length >= maxMetrics;

  const toggleMetric = (key: string, checked: boolean) => {
    setDraftKeys((prev) => {
      if (checked) {
        if (prev.includes(key) || prev.length >= maxMetrics) return prev;
        return [...prev, key];
      }
      return prev.filter((k) => k !== key);
    });
  };

  const loadPreset = (setId: string) => {
    const preset = columnSets.find((s) => s.id === setId);
    if (!preset) return;
    setActiveColumnSetId(setId);
    const valid = new Set(allMetrics.map((m) => m.key));
    setDraftKeys(preset.metric_keys.filter((k) => valid.has(k)));
  };

  const handleApply = async () => {
    const trimmedName = presetName.trim();
    if (savePreset && !trimmedName) return;
    await onApply(draftKeys, savePreset ? { saveColumnSetName: trimmedName } : undefined);
    onOpenChange(false);
  };

  const activeColumnSet = columnSets.find((s) => s.id === activeColumnSetId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="text-lg font-normal">
            {modifyColumnsTitle(entity, t)}
          </DialogTitle>
        </DialogHeader>

        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {columnSets.length > 0 ? (
            <div className="mb-4 space-y-2">
              <Label className="text-xs text-muted-foreground">Saved column sets</Label>
              <div className="flex gap-2">
                <Select value={activeColumnSetId ?? undefined} onValueChange={loadPreset}>
                  <SelectTrigger className="h-9 flex-1">
                    <SelectValue placeholder="Choose a saved set" />
                  </SelectTrigger>
                  <SelectContent>
                    {columnSets.map((s) => (
                      <SelectItem
                        key={s.id}
                        value={s.id}
                        className={TIKTOK_ADS_COLUMN_SET_SELECT_ITEM_CLASS}
                      >
                        <TikTokAdsColumnSetOptionLabel set={s} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeColumnSet?.scope === "org" && onDeleteColumnSet && activeColumnSetId ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isDeletingColumnSet}
                    onClick={() => void onDeleteColumnSet(activeColumnSetId)}
                  >
                    Delete
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          <Accordion type="multiple" defaultValue={["metrics"]}>
            <AccordionItem value="metrics" className="border-none">
              <AccordionTrigger className="py-2 text-sm font-medium hover:no-underline">
                {t("digitalMarketing.tiktokAds.catalogPerformance", "Performance")}
              </AccordionTrigger>
              <AccordionContent className="pb-3 pt-0">
                <div className="space-y-2">
                  {allMetrics.map((m) => {
                    const checked = draftSet.has(m.key);
                    const disabled = !checked && atLimit;
                    return (
                      <label
                        key={m.key}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 text-sm",
                          disabled && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={(v) => toggleMetric(m.key, v === true)}
                        />
                        <span>{m.label}</span>
                      </label>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <p className="mt-3 text-xs text-muted-foreground">
            {draftKeys.length} / {maxMetrics} metrics selected
          </p>

          <div className="mt-4 rounded-md border p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={savePreset} onCheckedChange={(v) => setSavePreset(v === true)} />
              Save as new column set
            </label>
            {savePreset ? (
              <Input
                className="mt-2 h-9"
                placeholder="Set name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
              />
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t px-6 py-4">
          <Button
            type="button"
            className="bg-blue-600 hover:bg-blue-700"
            disabled={isSaving || draftKeys.length === 0 || (savePreset && !presetName.trim())}
            onClick={() => void handleApply()}
          >
            {t("digitalMarketing.tiktokAds.modifyColumnsApply", "Apply")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("digitalMarketing.tiktokAds.modifyColumnsCancel", "Cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

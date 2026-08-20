import { useEffect, useMemo, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useDefaultPrices } from "../../hooks/useDefaultPrices";
import { uploadCatalogBundlePhoto } from "../../lib/catalogProductPhoto";
import { useCatalogBundles } from "../hooks/useCatalogBundles";
import type { CatalogBundle } from "../types";
import { bundlePriceFromDraft, draftFromBundle, emptyBundleDraft, isBundleDraftValid, parsedSalesTypePrices } from "../types";
import { BundleInformationSection } from "./BundleInformationSection";
import { BundleOutletsSection } from "./BundleOutletsSection";
import { BundleItemsSection } from "./BundleItemsSection";
import { BundlePricingSection } from "./BundlePricingSection";

export type BundleFormProps = {
  bundle: CatalogBundle | null;
  onClose: () => void;
};

export function BundleForm({ bundle, onClose }: BundleFormProps) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { organizationId } = useCurrentOrg();
  const { rows: catalogRows } = useDefaultPrices();
  const { save, isSaving } = useCatalogBundles();
  const [draft, setDraft] = useState(() => (bundle ? draftFromBundle(bundle) : emptyBundleDraft()));
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(bundle?.photo_url ?? null);

  useEffect(() => {
    setDraft(bundle ? draftFromBundle(bundle) : emptyBundleDraft());
    setPhotoFile(null);
    setPhotoPreview(bundle?.photo_url ?? null);
  }, [bundle]);

  useEffect(() => {
    if (!photoFile) return;
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const products = useMemo(
    () => catalogRows.filter((row) => row.kind === "product"),
    [catalogRows],
  );

  const canSave = isBundleDraftValid(draft);
  const isEdit = Boolean(bundle);

  const patch = (next: Partial<typeof draft>) => {
    setDraft((prev) => ({ ...prev, ...next }));
  };

  const handleSave = async () => {
    if (!canSave || !organizationId) return;
    try {
      let photo_path = draft.photo_path;
      if (photoFile) {
        photo_path = await uploadCatalogBundlePhoto({
          organizationId,
          bundleId: draft.id,
          file: photoFile,
        });
      }
      await save({
        id: draft.id,
        name: draft.name.trim(),
        photo_path,
        bundle_price: bundlePriceFromDraft(draft),
        use_sales_type_prices: draft.use_sales_type_prices,
        sales_type_prices: draft.use_sales_type_prices ? parsedSalesTypePrices(draft) : [],
        is_active: draft.is_active,
        items: draft.items.map((item) => ({
          product_id: item.product_id,
          quantity: Math.max(1, Number(item.quantity) || 1),
        })),
        outlet_ids: draft.outlet_ids,
      });
      toast({ title: t("defaultPrices.bundles.saved", "Bundle saved.") });
      onClose();
    } catch {
      toast({
        title: t("defaultPrices.form.saveFailed", "Failed to save."),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-lg font-semibold">
            {isEdit
              ? t("defaultPrices.bundles.editTitle", "Edit Bundle Package")
              : t("defaultPrices.bundles.createTitle", "Create Bundle Package")}
          </h2>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t("defaultPrices.bundles.statusLabel", "Status:")}</span>
            <span className="font-medium">
              {draft.is_active
                ? t("defaultPrices.bundles.statusActive", "Active")
                : t("defaultPrices.bundles.statusInactive", "Inactive")}
            </span>
            <Switch
              checked={draft.is_active}
              onCheckedChange={(checked) => patch({ is_active: checked })}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={!canSave || isSaving}>
            {isEdit
              ? t("common.save", "Save")
              : t("defaultPrices.bundles.createAction", "Create Bundle")}
          </Button>
        </div>
      </div>

      <BundleInformationSection
        draft={draft}
        photoSrc={photoPreview}
        onChange={patch}
        onFileChange={setPhotoFile}
      />
      <BundleOutletsSection selectedIds={draft.outlet_ids} onChange={(ids) => patch({ outlet_ids: ids })} />
      <BundleItemsSection draft={draft} products={products} onChange={patch} />
      <BundlePricingSection draft={draft} products={products} onChange={patch} />
    </div>
  );
}

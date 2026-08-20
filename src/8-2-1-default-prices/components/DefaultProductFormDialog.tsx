import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useInventorySkusQuery } from "@/stock-management/hooks/useInventorySkusQuery";
import { createInventorySku } from "@/stock-management/lib/inventoryApi";
import {
  CATALOG_POS_STATUSES,
  CATALOG_PRODUCT_UNIT_CUSTOM,
  CATALOG_PRODUCT_UNITS,
  assertProductCatalogPayload,
  isCatalogProductUnitPreset,
  normalizeCatalogPosStatus,
  normalizeProductUnit,
  type CatalogPosStatus,
} from "../lib/catalogKind";
import { uploadCatalogProductPhoto } from "../lib/catalogProductPhoto";
import { ProductCategoriesDialog, useCatalogProductCategories } from "../categories";
import { useCatalogBrands } from "../brands";
import type { DefaultPriceCreate, DefaultPriceRow } from "../types/defaultPrices";
import { formatIdIntegerGrouping, parseGroupedIdInteger, stripToDigits } from "../utils/formatIdUnitPrice";
import { usePosOutlets } from "@/8-2-2-outlets/hooks/usePosOutlets";
import { activePosOutletIds } from "@/8-2-2-outlets/lib/assignedOutlets";
import { ProductOutletsSection } from "../product-outlets";
import {
  effectivePosStatus,
  effectiveUnitPrice,
  hasPriceOverride,
  hasStatusOverride,
} from "../product-outlets/lib/effectiveProductOutlet";

const NONE_CATEGORY = "__none__";
const NONE_BRAND = "__none__";

export type DefaultProductFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: DefaultPriceCreate) => Promise<void>;
  editingRow?: DefaultPriceRow | null;
  prefillRow?: DefaultPriceRow | null;
  selectedOutletId?: string | null;
  selectedOutletName?: string | null;
};

export function DefaultProductFormDialog({
  open,
  onOpenChange,
  onSubmit,
  editingRow,
  prefillRow,
  selectedOutletId,
  selectedOutletName,
}: DefaultProductFormDialogProps) {
  const { t } = useAppTranslation();
  const { organizationId } = useCurrentOrg();
  const { rows: outlets } = usePosOutlets();
  const skusQuery = useInventorySkusQuery(organizationId);
  const skuRows = skusQuery.data?.rows ?? [];
  const categories = useCatalogProductCategories();
  const brands = useCatalogBrands();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [unitPreset, setUnitPreset] = useState<string>("pcs");
  const [customUnit, setCustomUnit] = useState("");
  const [trackStock, setTrackStock] = useState(false);
  const [skuId, setSkuId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [existingPhotoPath, setExistingPhotoPath] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState(NONE_CATEGORY);
  const [brandId, setBrandId] = useState(NONE_BRAND);
  const [posStatus, setPosStatus] = useState<CatalogPosStatus>("available");
  const [outletIds, setOutletIds] = useState<string[]>([]);
  const [useDefaultPrice, setUseDefaultPrice] = useState(true);
  const [useDefaultStatus, setUseDefaultStatus] = useState(true);
  const [masterPrice, setMasterPrice] = useState(0);
  const [masterStatus, setMasterStatus] = useState<CatalogPosStatus>("available");
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [newSkuCode, setNewSkuCode] = useState("");
  const [newSkuQty, setNewSkuQty] = useState("0");
  const [creatingSku, setCreatingSku] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sourceRow = editingRow ?? prefillRow ?? null;
  const isEdit = Boolean(editingRow);
  const outletLabel = selectedOutletName?.trim() || t("outlets.filter.label", "Outlet");
  const categoryOptions = useMemo(
    () =>
      categories.rows.filter((row) => {
        if (categoryId !== NONE_CATEGORY && row.id === categoryId) return true;
        if (!selectedOutletId) return true;
        return (row.outlet_ids ?? []).includes(selectedOutletId);
      }),
    [categories.rows, categoryId, selectedOutletId],
  );

  useEffect(() => {
    if (!open) return;
    if (sourceRow) {
      setName(sourceRow.name ?? sourceRow.service_name ?? "");
      setDescription(sourceRow.description ?? "");
      const master = Number(sourceRow.unit_price) || 0;
      setMasterPrice(master);
      setMasterStatus(normalizeCatalogPosStatus(sourceRow.pos_status));
      const effectivePrice = effectiveUnitPrice(sourceRow, selectedOutletId ?? null);
      const raw = String(Math.round(effectivePrice));
      setUnitPrice(raw ? formatIdIntegerGrouping(stripToDigits(raw)) : "");
      const unit = normalizeProductUnit(sourceRow.unit);
      if (isCatalogProductUnitPreset(unit)) {
        setUnitPreset(unit);
        setCustomUnit("");
      } else {
        setUnitPreset(CATALOG_PRODUCT_UNIT_CUSTOM);
        setCustomUnit(unit);
      }
      setTrackStock(Boolean(sourceRow.track_stock));
      setSkuId(sourceRow.inventory_sku_id ?? "");
      setExistingPhotoPath(sourceRow.photo_path ?? null);
      setExistingPhotoUrl(sourceRow.photo_url ?? null);
      setCategoryId(sourceRow.product_category_id ?? NONE_CATEGORY);
      setBrandId(sourceRow.product_brand_id ?? NONE_BRAND);
      setPosStatus(effectivePosStatus(sourceRow, selectedOutletId ?? null));
      setOutletIds([...(sourceRow.outlet_ids ?? [])]);
      setUseDefaultPrice(!hasPriceOverride(sourceRow, selectedOutletId ?? null));
      setUseDefaultStatus(!hasStatusOverride(sourceRow, selectedOutletId ?? null));
    } else {
      setName("");
      setDescription("");
      setUnitPrice("");
      setUnitPreset("pcs");
      setCustomUnit("");
      setTrackStock(false);
      setSkuId("");
      setExistingPhotoPath(null);
      setExistingPhotoUrl(null);
      setCategoryId(NONE_CATEGORY);
      setBrandId(NONE_BRAND);
      setPosStatus("available");
      setOutletIds([]);
      setUseDefaultPrice(true);
      setUseDefaultStatus(true);
      setMasterPrice(0);
      setMasterStatus("available");
    }
    setFile(null);
    setPreviewUrl(null);
    setNewSkuCode("");
    setNewSkuQty("0");
    setError("");
  }, [open, sourceRow, selectedOutletId]);

  useEffect(() => {
    if (!open || sourceRow) return;
    setOutletIds((prev) => {
      if (prev.length > 0) return prev;
      if (selectedOutletId) return [selectedOutletId];
      return activePosOutletIds(outlets);
    });
  }, [open, sourceRow, outlets, selectedOutletId]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const resolvedUnit =
    unitPreset === CATALOG_PRODUCT_UNIT_CUSTOM ? normalizeProductUnit(customUnit) : unitPreset;

  const handleCreateSku = async () => {
    if (!organizationId || !newSkuCode.trim()) {
      setError(t("defaultPrices.product.skuCodeRequired", "Enter an internal SKU code."));
      return;
    }
    setCreatingSku(true);
    setError("");
    try {
      const created = await createInventorySku(organizationId, {
        internal_sku: newSkuCode.trim(),
        name: name.trim() || newSkuCode.trim(),
        product_name: name.trim() || newSkuCode.trim(),
        initial_qty: Math.max(0, Math.floor(Number(newSkuQty) || 0)),
        unit: resolvedUnit,
      });
      setSkuId(created.sku_id);
      setTrackStock(true);
      setNewSkuCode("");
      await skusQuery.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("defaultPrices.product.skuCreateFailed", "Could not create SKU."));
    } finally {
      setCreatingSku(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!organizationId) return;
    const price = parseGroupedIdInteger(unitPrice);
    if (Number.isNaN(price) || price < 0) {
      setError(t("defaultPrices.form.priceInvalid", "Unit price must be a non-negative number."));
      return;
    }
    const productId = editingRow?.id ?? crypto.randomUUID();
    let photoPath = existingPhotoPath;
    if (file) {
      try {
        photoPath = await uploadCatalogProductPhoto({
          organizationId,
          productId,
          file,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : t("defaultPrices.product.photoUploadFailed", "Could not upload photo."));
        return;
      }
    }
    const invalid = assertProductCatalogPayload({
      name,
      photoPath,
      trackStock,
      inventorySkuId: skuId,
    });
    if (invalid === "product_name_required") {
      setError(t("defaultPrices.product.nameRequired", "Enter a product name."));
      return;
    }
    if (invalid === "product_photo_required") {
      setError(t("defaultPrices.product.photoRequired", "Add a product photo."));
      return;
    }
    if (invalid === "product_sku_required") {
      setError(t("defaultPrices.product.skuRequired", "Select or create a SKU to track stock."));
      return;
    }
    if (outletIds.length < 1) {
      setError(t("outlets.assign.minOne", "Please select minimum one outlet"));
      return;
    }
    setLoading(true);
    try {
      await onSubmit({
        id: productId,
        organization_id: organizationId,
        kind: "product",
        service_id: null,
        sub_service_id: null,
        name: name.trim(),
        unit_price: price,
        description: description.trim() || null,
        photo_path: photoPath,
        unit: resolvedUnit,
        track_stock: trackStock,
        inventory_sku_id: trackStock ? skuId : null,
        product_category_id: categoryId === NONE_CATEGORY ? null : categoryId,
        product_brand_id: brandId === NONE_BRAND ? null : brandId,
        pos_status: posStatus,
        outlet_ids: outletIds,
        selected_outlet_id: selectedOutletId ?? null,
        use_default_price: !isEdit || useDefaultPrice,
        use_default_status: !isEdit || useDefaultStatus,
        outlet_overrides: sourceRow?.outlet_overrides,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("defaultPrices.form.saveFailed", "Failed to save."));
    } finally {
      setLoading(false);
    }
  };

  const photoSrc = previewUrl || existingPhotoUrl;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
          aria-describedby={undefined}
        >
          <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12 text-left">
            <SheetTitle>
              {editingRow
                ? t("defaultPrices.product.editTitle", "Edit product")
                : t("defaultPrices.product.addTitle", "Add product")}
            </SheetTitle>
          </SheetHeader>
          <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div>
              <Label htmlFor="product_name">{t("defaultPrices.product.name", "Name")} *</Label>
              <Input id="product_name" className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>{t("defaultPrices.product.photo", "Photo")} *</Label>
              <input
                ref={fileInputRef}
                id="product_photo"
                className="sr-only"
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className="mt-1 flex w-full items-center gap-3 rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-left hover:border-brand-blue"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const next = e.dataTransfer.files?.[0];
                  if (next) setFile(next);
                }}
              >
                {photoSrc ? (
                  <img src={photoSrc} alt="" className="h-16 w-16 shrink-0 rounded object-cover" />
                ) : (
                  <span className="h-16 w-16 shrink-0 rounded bg-gray-200" />
                )}
                <span className="min-w-0">
                  <span className="block text-sm text-gray-900">
                    {t("defaultPrices.product.photoDrop", "Drop a photo or click to choose")}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {file?.name || t("defaultPrices.product.photoHint", "Square photo works best in the catalog.")}
                  </span>
                </span>
              </button>
            </div>
            <div>
              <Label htmlFor="product_unit">{t("defaultPrices.product.unit", "Unit")}</Label>
              <Select value={unitPreset} onValueChange={setUnitPreset}>
                <SelectTrigger id="product_unit" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATALOG_PRODUCT_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                  <SelectItem value={CATALOG_PRODUCT_UNIT_CUSTOM}>
                    {t("defaultPrices.product.unitCustom", "Custom")}
                  </SelectItem>
                </SelectContent>
              </Select>
              {unitPreset === CATALOG_PRODUCT_UNIT_CUSTOM ? (
                <Input
                  className="mt-2"
                  maxLength={20}
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  placeholder={t("defaultPrices.product.unitCustomPlaceholder", "e.g. pack")}
                />
              ) : null}
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="product_category">{t("defaultPrices.product.category", "Category")}</Label>
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setCategoriesOpen(true)}>
                  {t("defaultPrices.product.manageCategories", "Manage")}
                </Button>
              </div>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="product_category" className="mt-1">
                  <SelectValue placeholder={t("defaultPrices.product.uncategorized", "Uncategorized")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_CATEGORY}>
                    {t("defaultPrices.product.uncategorized", "Uncategorized")}
                  </SelectItem>
                  {categoryOptions.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="product_brand">{t("defaultPrices.product.brand", "Brand")}</Label>
              <Select value={brandId} onValueChange={setBrandId}>
                <SelectTrigger id="product_brand" className="mt-1">
                  <SelectValue placeholder={t("defaultPrices.product.unbranded", "Unbranded")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_BRAND}>
                    {t("defaultPrices.product.unbranded", "Unbranded")}
                  </SelectItem>
                  {brands.rows.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(
                  "defaultPrices.product.brandHint",
                  "Optional. Use for retail items sold under a manufacturer or supplier brand.",
                )}
              </p>
            </div>
            <ProductOutletsSection selectedIds={outletIds} onChange={setOutletIds} />
            <div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="product_status">
                  {isEdit
                    ? t("defaultPrices.product.posStatusForOutlet", "POS status for {{outlet}}", { outlet: outletLabel })
                    : t("defaultPrices.product.posStatus", "POS status")}
                </Label>
                {isEdit && !useDefaultStatus ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => {
                      setUseDefaultStatus(true);
                      setPosStatus(masterStatus);
                    }}
                  >
                    {t("defaultPrices.product.useDefaultStatus", "Use default status")}
                  </Button>
                ) : null}
              </div>
              <Select
                value={posStatus}
                onValueChange={(value) => {
                  setUseDefaultStatus(false);
                  setPosStatus(normalizeCatalogPosStatus(value));
                }}
              >
                <SelectTrigger id="product_status" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATALOG_POS_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t(`defaultPrices.product.status.${status}`, status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isEdit && !useDefaultStatus ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("defaultPrices.product.outletStatusHint", "This status applies only to {{outlet}}.", {
                    outlet: outletLabel,
                  })}
                </p>
              ) : null}
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="product_price">
                  {isEdit
                    ? t("defaultPrices.product.priceForOutlet", "Unit Price (Rp) for {{outlet}}", { outlet: outletLabel })
                    : t("defaultPrices.form.unitPrice", "Unit Price (Rp)")}{" "}
                  *
                </Label>
                {isEdit && !useDefaultPrice ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => {
                      setUseDefaultPrice(true);
                      const raw = String(Math.round(masterPrice));
                      setUnitPrice(raw ? formatIdIntegerGrouping(stripToDigits(raw)) : "");
                    }}
                  >
                    {t("defaultPrices.product.useDefaultPrice", "Use default price")}
                  </Button>
                ) : null}
              </div>
              <Input
                id="product_price"
                className="mt-1"
                inputMode="numeric"
                value={unitPrice}
                onChange={(e) => {
                  const digits = stripToDigits(e.target.value);
                  setUseDefaultPrice(false);
                  setUnitPrice(digits ? formatIdIntegerGrouping(digits) : "");
                }}
              />
              {isEdit && !useDefaultPrice ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("defaultPrices.product.outletPriceHint", "This price applies only to {{outlet}}.", {
                    outlet: outletLabel,
                  })}
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="product_description">{t("defaultPrices.form.description", "Description")}</Label>
              <Textarea
                id="product_description"
                className="mt-1 resize-none"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={trackStock}
                onChange={(e) => setTrackStock(e.target.checked)}
              />
              {t("defaultPrices.product.trackStock", "Track stock in Stock Management")}
            </label>
            <p className="text-xs text-muted-foreground">
              {t(
                "defaultPrices.product.untrackedHint",
                "Menu / prepared F&B: sold without reducing inventory. Link a SKU only for packaged retail items.",
              )}
            </p>
            {trackStock ? (
              <div className="space-y-2 rounded-md border p-3">
                <Label>{t("defaultPrices.product.sku", "SKU")}</Label>
                <Select value={skuId || undefined} onValueChange={setSkuId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={t("defaultPrices.product.skuPlaceholder", "Select SKU")} />
                  </SelectTrigger>
                  <SelectContent>
                    {skuRows.map((row) => (
                      <SelectItem key={row.id} value={row.id}>
                        {row.internal_sku} · {row.name} ({row.available_qty})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t("defaultPrices.product.orCreateSku", "Or create a SKU (appears on Stock Management)")}
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder={t("defaultPrices.product.skuCode", "SKU code")}
                    value={newSkuCode}
                    onChange={(e) => setNewSkuCode(e.target.value)}
                  />
                  <Input
                    className="w-24"
                    inputMode="numeric"
                    placeholder="0"
                    value={newSkuQty}
                    onChange={(e) => setNewSkuQty(e.target.value)}
                  />
                  <Button type="button" variant="outline" disabled={creatingSku} onClick={() => void handleCreateSku()}>
                    {t("defaultPrices.product.createSku", "Create")}
                  </Button>
                </div>
              </div>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t px-6 py-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? t("common.saving", "Saving...") : editingRow ? t("common.update", "Update") : t("common.add", "Add")}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
      <ProductCategoriesDialog
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        onSelect={(row) => {
          setCategoryId(row.id);
          setCategoriesOpen(false);
        }}
      />
    </>
  );
}

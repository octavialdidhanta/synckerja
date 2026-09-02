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
import { useCatalogModifierGroups } from "../modifiers";
import type { DefaultPriceCreate, DefaultPriceRow } from "../types/defaultPrices";
import { formatIdIntegerGrouping, parseGroupedIdInteger, stripToDigits } from "../utils/formatIdUnitPrice";
import { usePosOutlets } from "@/8-2-2-outlets/hooks/usePosOutlets";
import { activePosOutletIds } from "@/8-2-2-outlets/lib/assignedOutlets";
import { ProductOutletsSection } from "../product-outlets";
import { FieldInfoTip } from "./FieldInfoTip";
import { ProductFormGroup } from "./ProductFormGroup";
import { ProductOrderPublishSection } from "@/synckerja-order/3-catalog/ProductOrderPublishSection";
import { useProductOrderPublish } from "@/synckerja-order/5-backoffice-shell/hooks/useProductOrderPublish";
import { canPublishToOrderOutlet } from "@/synckerja-order/shared/lib/orderCatalogPublish";
import { ProductSalesStockHint, useProductIdsWithBaseRecipe } from "../products";
import {
  effectivePosStatus,
  effectiveUnitPrice,
  hasPriceOverride,
  hasStatusOverride,
} from "../product-outlets/lib/effectiveProductOutlet";
import {
  ProductCogsSection,
  ProductInventorySection,
  ProductPricingSection,
  draftToOutletStock,
  masterUnitPriceFromVariants,
  persistableSalesTypePrices,
  persistableVariants,
  stockToInventoryDraft,
} from "../product-variants";
import type { CogsRowDraft, InventoryRowDraft, VariantDraft } from "../product-variants/types";

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
  const categories = useCatalogProductCategories();
  const brands = useCatalogBrands();
  const modifiers = useCatalogModifierGroups();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [unitPreset, setUnitPreset] = useState<string>("pcs");
  const [customUnit, setCustomUnit] = useState("");
  const [trackStock, setTrackStock] = useState(false);
  const [catalogSku, setCatalogSku] = useState("");
  const [useSalesTypePrices, setUseSalesTypePrices] = useState(false);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [productSalesTypeDisplays, setProductSalesTypeDisplays] = useState<Record<string, string>>({});
  const [variantSalesTypeDisplays, setVariantSalesTypeDisplays] = useState<Record<string, Record<string, string>>>({});
  const [inventoryRows, setInventoryRows] = useState<InventoryRowDraft[]>([
    { variantId: null, trackStock: false, inStock: "", alertEnabled: false, alertAt: "" },
  ]);
  const [cogsRows, setCogsRows] = useState<CogsRowDraft[]>([{ variantId: null, trackCogs: false, avgCost: "" }]);
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orderPublish, setOrderPublish] = useState(false);

  const sourceRow = editingRow ?? prefillRow ?? null;
  const isEdit = Boolean(editingRow);
  const orderPublishQuery = useProductOrderPublish(editingRow?.id ?? null, selectedOutletId ?? null);
  const canPublishOrder = canPublishToOrderOutlet({
    selectedOutletId,
    assignedOutletIds: outletIds,
  });
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
      setCatalogSku(sourceRow.catalog_sku ?? "");
      setUseSalesTypePrices(Boolean(sourceRow.use_sales_type_prices));
      const loadedVariants: VariantDraft[] = (sourceRow.variants ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        sku: row.sku ?? "",
        priceDisplay: row.price ? formatIdIntegerGrouping(String(Math.round(row.price))) : "",
      }));
      setVariants(loadedVariants);
      const productDisplays: Record<string, string> = {};
      const variantDisplays: Record<string, Record<string, string>> = {};
      for (const row of sourceRow.sales_type_prices ?? []) {
        const display = row.price ? formatIdIntegerGrouping(String(Math.round(row.price))) : "";
        if (!row.variant_id) productDisplays[row.sales_type_id] = display;
        else {
          variantDisplays[row.variant_id] = {
            ...(variantDisplays[row.variant_id] ?? {}),
            [row.sales_type_id]: display,
          };
        }
      }
      setProductSalesTypeDisplays(productDisplays);
      setVariantSalesTypeDisplays(variantDisplays);
      const outletStock = selectedOutletId ? sourceRow.outlet_stocks?.[selectedOutletId] : undefined;
      if (loadedVariants.length > 0) {
        setInventoryRows(
          loadedVariants.map((variant) => {
            const stock = (sourceRow.variant_outlet_stocks ?? []).find(
              (row) => row.variant_id === variant.id && row.outlet_id === selectedOutletId,
            );
            return stockToInventoryDraft(variant.id, stock, Boolean(sourceRow.track_stock));
          }),
        );
        setCogsRows(
          loadedVariants.map((variant) => {
            const stock = (sourceRow.variant_outlet_stocks ?? []).find(
              (row) => row.variant_id === variant.id && row.outlet_id === selectedOutletId,
            );
            return {
              variantId: variant.id,
              trackCogs: Boolean(stock?.track_cogs),
              avgCost: stock?.avg_cost ? String(Math.round(stock.avg_cost)) : "",
            };
          }),
        );
      } else {
        setInventoryRows([stockToInventoryDraft(null, outletStock, Boolean(sourceRow.track_stock))]);
        setCogsRows([
          {
            variantId: null,
            trackCogs: Boolean(outletStock?.track_cogs),
            avgCost: outletStock?.avg_cost ? String(Math.round(outletStock.avg_cost)) : "",
          },
        ]);
      }
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
      setCatalogSku("");
      setUseSalesTypePrices(false);
      setVariants([]);
      setProductSalesTypeDisplays({});
      setVariantSalesTypeDisplays({});
      setInventoryRows([{ variantId: null, trackStock: false, inStock: "", alertEnabled: false, alertAt: "" }]);
      setCogsRows([{ variantId: null, trackCogs: false, avgCost: "" }]);
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
    setError("");
    if (!editingRow) setOrderPublish(false);
  }, [open, sourceRow, selectedOutletId, editingRow]);

  useEffect(() => {
    if (!open || !editingRow) return;
    if (orderPublishQuery.isFetched) setOrderPublish(orderPublishQuery.optedIn);
  }, [open, editingRow, orderPublishQuery.isFetched, orderPublishQuery.optedIn]);

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
  const lockTracking = Boolean(editingRow?.track_stock);
  const { data: recipeProductIds } = useProductIdsWithBaseRecipe(
    editingRow?.id ? [editingRow.id] : [],
  );
  const hasBaseRecipe = Boolean(editingRow?.id && recipeProductIds?.has(editingRow.id));
  const lockCogs = Boolean(
    selectedOutletId &&
      (editingRow?.outlet_stocks?.[selectedOutletId]?.track_cogs ||
        editingRow?.variant_outlet_stocks?.some(
          (row) => row.outlet_id === selectedOutletId && row.track_cogs,
        )),
  );
  const linkedModifiers = useMemo(
    () =>
      editingRow
        ? modifiers.rows.filter((row) => row.product_ids.includes(editingRow.id))
        : [],
    [editingRow, modifiers.rows],
  );

  const syncVariantDependentRows = (nextVariants: VariantDraft[]) => {
    setVariants(nextVariants);
    if (nextVariants.length > 0 && variants.length === 0 && Object.keys(productSalesTypeDisplays).length > 0) {
      const seeded: Record<string, Record<string, string>> = {};
      for (const variant of nextVariants) {
        seeded[variant.id] = { ...productSalesTypeDisplays };
      }
      setVariantSalesTypeDisplays(seeded);
    }
    if (nextVariants.length === 0) {
      setInventoryRows((prev) => [
        prev.find((row) => row.variantId == null) ?? {
          variantId: null,
          trackStock,
          inStock: "",
          alertEnabled: false,
          alertAt: "",
        },
      ]);
      setCogsRows((prev) => [
        prev.find((row) => row.variantId == null) ?? { variantId: null, trackCogs: false, avgCost: "" },
      ]);
      return;
    }
    setInventoryRows((prev) =>
      nextVariants.map((variant) => {
        const existing = prev.find((row) => row.variantId === variant.id);
        return (
          existing ?? {
            variantId: variant.id,
            trackStock,
            inStock: "",
            alertEnabled: false,
            alertAt: "",
          }
        );
      }),
    );
    setCogsRows((prev) =>
      nextVariants.map((variant) => {
        const existing = prev.find((row) => row.variantId === variant.id);
        return existing ?? { variantId: variant.id, trackCogs: false, avgCost: "" };
      }),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!organizationId) return;
    const persistedVariants = persistableVariants(variants);
    const inventoryOn = lockTracking || inventoryRows.some((row) => row.trackStock);
    const price =
      persistedVariants.length > 0
        ? masterUnitPriceFromVariants(persistedVariants, 0)
        : parseGroupedIdInteger(unitPrice);
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
      trackStock: inventoryOn,
      inventorySkuId: null,
    });
    if (invalid === "product_name_required") {
      setError(t("defaultPrices.product.nameRequired", "Enter a product name."));
      return;
    }
    if (invalid === "product_photo_required") {
      setError(t("defaultPrices.product.photoRequired", "Add a product photo."));
      return;
    }
    if (outletIds.length < 1) {
      setError(t("outlets.assign.minOne", "Please select minimum one outlet"));
      return;
    }
    const salesTypePrices = persistableSalesTypePrices({
      useSalesTypePrices,
      variants: persistedVariants,
      productDisplays: productSalesTypeDisplays,
      variantDisplays: variantSalesTypeDisplays,
    });
    const selectedStock =
      persistedVariants.length === 0
        ? draftToOutletStock(inventoryRows[0], cogsRows[0], lockTracking)
        : null;
    const variantOutletStocks =
      persistedVariants.length > 0 && selectedOutletId
        ? persistedVariants.map((variant) => {
            const inv = inventoryRows.find((row) => row.variantId === variant.id);
            const cogs = cogsRows.find((row) => row.variantId === variant.id);
            return {
              variant_id: variant.id,
              outlet_id: selectedOutletId,
              ...draftToOutletStock(
                inv ?? {
                  variantId: variant.id,
                  trackStock: inventoryOn,
                  inStock: "",
                  alertEnabled: false,
                  alertAt: "",
                },
                cogs,
                lockTracking,
              ),
            };
          })
        : [];
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
        track_stock: inventoryOn,
        inventory_sku_id: editingRow?.inventory_sku_id ?? prefillRow?.inventory_sku_id ?? null,
        catalog_sku: persistedVariants.length > 0 ? null : catalogSku.trim() || null,
        use_sales_type_prices: useSalesTypePrices,
        variants: persistedVariants,
        sales_type_prices: salesTypePrices,
        selected_outlet_stock: selectedStock,
        variant_outlet_stocks: variantOutletStocks,
        product_category_id: categoryId === NONE_CATEGORY ? null : categoryId,
        product_brand_id: brandId === NONE_BRAND ? null : brandId,
        pos_status: posStatus,
        outlet_ids: outletIds,
        selected_outlet_id: selectedOutletId ?? null,
        use_default_price: !isEdit || useDefaultPrice,
        use_default_status: !isEdit || useDefaultStatus,
        outlet_overrides: sourceRow?.outlet_overrides,
        order_publish: canPublishOrder && orderPublish,
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
          className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-describedby={undefined}
        >
          <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12 text-left">
            <SheetTitle>
              {editingRow
                ? t("defaultPrices.product.editTitle", "Edit product")
                : t("defaultPrices.product.addTitle", "Add product")}
            </SheetTitle>
          </SheetHeader>
          <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-6 py-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ProductFormGroup title={t("defaultPrices.product.group.details", "Product")}>
            <div>
              <Label htmlFor="product_name">{t("defaultPrices.product.name", "Name")} *</Label>
              <Input id="product_name" className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <Label>{t("defaultPrices.product.photo", "Photo")} *</Label>
                <FieldInfoTip
                  text={`${t("defaultPrices.product.photoDrop", "Drop a photo or click to choose")} ${t(
                    "defaultPrices.product.photoHint",
                    "Square photo works best in the catalog.",
                  )}`}
                />
              </div>
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
                <span className="min-w-0 truncate text-sm text-gray-900">
                  {file?.name || t("defaultPrices.product.photoDrop", "Drop a photo or click to choose")}
                </span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <Label htmlFor="product_brand">{t("defaultPrices.product.brand", "Brand")}</Label>
                <FieldInfoTip
                  text={t(
                    "defaultPrices.product.brandHint",
                    "Optional. Use for retail items sold under a manufacturer or supplier brand.",
                  )}
                />
              </div>
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
            </ProductFormGroup>
            <ProductFormGroup title={t("defaultPrices.product.group.selling", "Selling")}>
            <ProductOutletsSection embedded selectedIds={outletIds} onChange={setOutletIds} />
            <ProductOrderPublishSection
              embedded
              checked={canPublishOrder && orderPublish}
              disabled={!canPublishOrder}
              outletName={selectedOutletName}
              onCheckedChange={setOrderPublish}
            />
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <Label htmlFor="product_status">
                    {isEdit
                      ? t("defaultPrices.product.posStatusForOutlet", "POS status for {{outlet}}", { outlet: outletLabel })
                      : t("defaultPrices.product.posStatus", "POS status")}
                  </Label>
                  {isEdit && !useDefaultStatus ? (
                    <FieldInfoTip
                      text={t("defaultPrices.product.outletStatusHint", "This status applies only to {{outlet}}.", {
                        outlet: outletLabel,
                      })}
                    />
                  ) : null}
                </div>
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
            </div>
            </ProductFormGroup>
            <ProductFormGroup title={t("defaultPrices.product.pricing.section", "Pricing")}>
            <ProductPricingSection
              hideHeading
              selectedOutletId={selectedOutletId ?? ""}
              useSalesTypePrices={useSalesTypePrices}
              onUseSalesTypePrices={setUseSalesTypePrices}
              catalogSku={catalogSku}
              onCatalogSku={setCatalogSku}
              unitPrice={unitPrice}
              onUnitPrice={(next) => {
                setUseDefaultPrice(false);
                setUnitPrice(next);
              }}
              variants={variants}
              onVariants={syncVariantDependentRows}
              productSalesTypeDisplays={productSalesTypeDisplays}
              onProductSalesTypeDisplays={setProductSalesTypeDisplays}
              variantSalesTypeDisplays={variantSalesTypeDisplays}
              onVariantSalesTypeDisplays={setVariantSalesTypeDisplays}
            />
            </ProductFormGroup>
            <ProductFormGroup
              title={t("defaultPrices.product.group.stock", "Stock")}
              tip={
                hasBaseRecipe
                  ? t(
                      "defaultPrices.product.inventory.recipeLocksTracking",
                      "Living stock comes from the ingredient recipe. Do not track finished-goods item stock for this menu.",
                    )
                  : t(
                      "defaultPrices.product.inventory.immutable",
                      "Item stock can not be changed after saving the item, so please make sure that it is correct!",
                    )
              }
            >
            <ProductInventorySection
              hideHeading
              productName={name.trim()}
              unit={resolvedUnit}
              variants={variants}
              rows={inventoryRows}
              onRowsChange={(rows) => {
                setInventoryRows(rows);
                setTrackStock(lockTracking || rows.some((row) => row.trackStock));
              }}
              lockTracking={lockTracking}
              hasBaseRecipe={hasBaseRecipe}
            />
            <ProductSalesStockHint
              trackStock={lockTracking || inventoryRows.some((row) => row.trackStock)}
              hasBaseRecipe={hasBaseRecipe}
            />
            <ProductCogsSection
              hideHeading
              productName={name.trim()}
              unit={resolvedUnit}
              variants={variants}
              inventoryOn={lockTracking || inventoryRows.some((row) => row.trackStock)}
              rows={cogsRows}
              onRowsChange={setCogsRows}
              lockCogs={lockCogs}
            />
            </ProductFormGroup>
            <ProductFormGroup
              title={t("defaultPrices.product.modifier.section", "Modifier")}
              tip={
                linkedModifiers.length === 0
                  ? t(
                      "defaultPrices.product.modifier.empty",
                      "No modifiers assigned. Assign groups from the Modifiers library.",
                    )
                  : undefined
              }
            >
              {linkedModifiers.length === 0 ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : (
                <ul className="space-y-2">
                  {linkedModifiers.map((row) => (
                    <li key={row.id} className="flex items-center gap-2 text-sm">
                      <span className="h-4 w-4 rounded-full border" />
                      {row.name}
                    </li>
                  ))}
                </ul>
              )}
            </ProductFormGroup>
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

import { useState, useCallback, useMemo, useEffect } from "react";
import { Plus } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useDefaultPrices } from "../hooks/useDefaultPrices";
import { useCatalogProductCategories, ProductCategoriesManager } from "../categories";
import {
  DefaultPricesTable,
  DefaultPriceFormDialog,
  DefaultProductFormDialog,
  DefaultProductsTable,
  SopWorkflowModal,
  LibraryItemNav,
} from "../components";
import { LibraryModifiersManager, useCatalogModifierGroups } from "../modifiers";
import { LibraryGratuityManager, useCatalogGratuities } from "../gratuity";
import { LibraryDiscountsManager, useCatalogDiscounts } from "../discounts";
import { LibraryPromosManager, useCatalogPromos } from "../promos";
import { LibraryBundlesManager, useCatalogBundles } from "../bundles";
import { LibrarySalesTypesManager, useCatalogSalesTypes } from "../sales-types";
import { LibraryBrandsManager, useCatalogBrands } from "../brands";
import { LibraryTaxesManager, useCatalogTaxes } from "../taxes";
import { DefaultPricesModuleShell } from "../layout/DefaultPricesModuleShell";
import { catalogTabFromPathname } from "../layout/DefaultPricesHeaderAndTab";
import { CATALOG_POS_STATUSES } from "../lib/catalogKind";
import type { DefaultPriceRow, DefaultPriceCreate, DefaultPriceUpdate } from "../types/defaultPrices";
import { OutletFilterSelect } from "@/8-2-2-outlets/components/OutletFilterSelect";
import { useSelectedPosOutlet } from "@/8-2-2-outlets/hooks/useSelectedPosOutlet";
import { effectivePosStatus } from "../product-outlets/lib/effectiveProductOutlet";

const FILTER_ALL = "__all__";

export default function DefaultPricesPage() {
  const { t } = useAppTranslation();
  const location = useLocation();
  const catalogTab = catalogTabFromPathname(location.pathname);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<DefaultPriceRow | null>(null);
  const [prefillRow, setPrefillRow] = useState<DefaultPriceRow | null>(null);
  const [sopModalRow, setSopModalRow] = useState<DefaultPriceRow | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(FILTER_ALL);
  const [brandFilter, setBrandFilter] = useState(FILTER_ALL);
  const [stockFilter, setStockFilter] = useState<"all" | "menu" | "tracked">("all");
  const [statusFilter, setStatusFilter] = useState(FILTER_ALL);

  const { organizationId, orgBootstrapPending } = useOrgBootstrapPending();
  const { rows, isLoading, create, update, delete: deleteRow, isCreating } = useDefaultPrices();
  const categories = useCatalogProductCategories();
  const brands = useCatalogBrands();
  const modifiers = useCatalogModifierGroups();
  const gratuities = useCatalogGratuities();
  const discounts = useCatalogDiscounts();
  const promos = useCatalogPromos();
  const bundles = useCatalogBundles();
  const salesTypes = useCatalogSalesTypes();
  const taxes = useCatalogTaxes();

  const isCategories = catalogTab === "categories";
  const isBrands = catalogTab === "brands";
  const isModifiers = catalogTab === "modifiers";
  const isGratuity = catalogTab === "gratuity";
  const isDiscounts = catalogTab === "discounts";
  const isPromos = catalogTab === "promos";
  const isBundles = catalogTab === "bundles";
  const isSalesTypes = catalogTab === "sales-types";
  const isTaxes = catalogTab === "taxes";
  const isProducts = catalogTab === "products";
  const {
    selectedOutletId,
    selectedOutletName,
    setSelectedOutletId,
    isLoading: outletsLoading,
  } = useSelectedPosOutlet(
    isProducts || isModifiers || isCategories || isBundles || isGratuity || isDiscounts || isSalesTypes || isBrands || isTaxes,
    { allowAll: isBundles || isDiscounts },
  );
  const isLibraryConfigView =
    isCategories ||
    isBrands ||
    isModifiers ||
    isGratuity ||
    isDiscounts ||
    isPromos ||
    isBundles ||
    isSalesTypes ||
    isTaxes;
  const hasPendingLoad =
    orgBootstrapPending ||
    (!!organizationId &&
      (isTaxes
        ? taxes.isLoading || outletsLoading
        : isSalesTypes
          ? salesTypes.isLoading || outletsLoading
          : isPromos
            ? promos.isLoading
            : isBundles
              ? bundles.isLoading || outletsLoading
              : isDiscounts
                ? discounts.isLoading || outletsLoading
                : isGratuity
                  ? gratuities.isLoading || outletsLoading
                  : isBrands
                    ? brands.isLoading || outletsLoading
                    : isModifiers
                      ? modifiers.isLoading || outletsLoading
                      : isCategories
                        ? categories.isLoading || outletsLoading
                        : isProducts
                          ? isLoading || outletsLoading
                          : isLoading));
  const showContent = useDebouncedReady(!hasPendingLoad, 200);

  const serviceRows = useMemo(() => rows.filter((row) => row.kind !== "product"), [rows]);
  const productRows = useMemo(() => rows.filter((row) => row.kind === "product"), [rows]);
  const filteredProductRows = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return productRows.filter((row) => {
      if (selectedOutletId && !(row.outlet_ids ?? []).includes(selectedOutletId)) return false;
      if (q) {
        const hay = `${row.name ?? ""} ${row.sku_code ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (categoryFilter === "__none__") {
        if (row.product_category_id) return false;
      } else if (categoryFilter !== FILTER_ALL && row.product_category_id !== categoryFilter) {
        return false;
      }
      if (brandFilter === "__none__") {
        if (row.product_brand_id) return false;
      } else if (brandFilter !== FILTER_ALL && row.product_brand_id !== brandFilter) {
        return false;
      }
      if (stockFilter === "tracked" && !row.track_stock) return false;
      if (stockFilter === "menu" && row.track_stock) return false;
      if (
        statusFilter !== FILTER_ALL &&
        effectivePosStatus(row, selectedOutletId || null) !== statusFilter
      ) {
        return false;
      }
      return true;
    });
  }, [
    productRows,
    productSearch,
    categoryFilter,
    brandFilter,
    stockFilter,
    statusFilter,
    selectedOutletId,
  ]);

  const handleAdd = useCallback(() => {
    setEditingRow(null);
    setPrefillRow(null);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((row: DefaultPriceRow) => {
    setPrefillRow(null);
    setEditingRow(row);
    setDialogOpen(true);
  }, []);

  const handleDuplicate = useCallback((row: DefaultPriceRow) => {
    setEditingRow(null);
    setPrefillRow(row);
    setDialogOpen(true);
  }, []);

  const handleOpenSop = useCallback((row: DefaultPriceRow) => {
    setSopModalRow(row);
  }, []);

  useEffect(() => {
    setDialogOpen(false);
    setEditingRow(null);
    setPrefillRow(null);
  }, [catalogTab]);

  const handleSubmitService = useCallback(
    async (payload: DefaultPriceCreate) => {
      if (editingRow) {
        await update({
          id: editingRow.id,
          payload: {
            unit_price: payload.unit_price,
            description: payload.description ?? null,
          } as DefaultPriceUpdate,
        });
      } else {
        await create({ ...payload, kind: "service" });
      }
      setDialogOpen(false);
      setEditingRow(null);
      setPrefillRow(null);
    },
    [editingRow, create, update],
  );

  const handleSubmitProduct = useCallback(
    async (payload: DefaultPriceCreate) => {
      if (editingRow) {
        await update({
          id: editingRow.id,
          payload: {
            description: payload.description ?? null,
            name: payload.name ?? null,
            photo_path: payload.photo_path ?? null,
            unit: payload.unit ?? "pcs",
            track_stock: payload.track_stock ?? false,
            inventory_sku_id: payload.inventory_sku_id ?? null,
            product_category_id: payload.product_category_id ?? null,
            product_brand_id: payload.product_brand_id ?? null,
            unit_price: payload.unit_price,
            pos_status: payload.pos_status ?? "available",
            outlet_ids: payload.outlet_ids,
            selected_outlet_id: payload.selected_outlet_id,
            use_default_price: payload.use_default_price,
            use_default_status: payload.use_default_status,
            outlet_overrides: payload.outlet_overrides,
          },
        });
      } else {
        await create(payload);
      }
      setDialogOpen(false);
      setEditingRow(null);
      setPrefillRow(null);
    },
    [editingRow, create, update],
  );

  return (
    <DefaultPricesModuleShell showContent={showContent}>
      <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch lg:max-h-[calc(100vh-120px)] lg:overflow-hidden">
        <div className="col-span-12 flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-row overflow-hidden">
            <LibraryItemNav />
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-4 py-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {isLibraryConfigView ? null : (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {isProducts
                        ? t("defaultPrices.product.heading", "Products")
                        : t("defaultPrices.service.heading", "Services")}
                    </h2>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {isProducts
                        ? t(
                            "defaultPrices.product.subtitle",
                            "Retail and F&B items with a photo. Tracked products use Stock Management SKUs.",
                          )
                        : t(
                            "defaultPrices.service.subtitle",
                            "Set default unit price per Service + Category for lead conversion.",
                          )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleAdd} disabled={!organizationId || isCreating}>
                      <Plus className="mr-2 h-4 w-4" />
                      {t("common.add", "Add")}
                    </Button>
                  </div>
                </div>
                )}
                {isTaxes ? (
                  <LibraryTaxesManager listClassName="max-h-[min(560px,calc(100vh-280px))]" />
                ) : isSalesTypes ? (
                  <LibrarySalesTypesManager listClassName="max-h-[min(560px,calc(100vh-280px))]" />
                ) : isPromos ? (
                  <LibraryPromosManager listClassName="max-h-[min(560px,calc(100vh-280px))]" />
                ) : isBundles ? (
                  <LibraryBundlesManager listClassName="max-h-[min(560px,calc(100vh-280px))]" />
                ) : isDiscounts ? (
                  <LibraryDiscountsManager listClassName="max-h-[min(560px,calc(100vh-280px))]" />
                ) : isGratuity ? (
                  <LibraryGratuityManager listClassName="max-h-[min(560px,calc(100vh-280px))]" />
                ) : isModifiers ? (
                  <LibraryModifiersManager listClassName="max-h-[min(560px,calc(100vh-280px))]" />
                ) : isBrands ? (
                  <LibraryBrandsManager listClassName="max-h-[min(560px,calc(100vh-280px))]" />
                ) : isCategories ? (
                  <ProductCategoriesManager listClassName="max-h-[min(560px,calc(100vh-280px))]" />
                ) : isProducts ? (
                  <>
                    <div className="mb-3 flex flex-wrap gap-2">
                      <OutletFilterSelect value={selectedOutletId} onChange={setSelectedOutletId} />
                      <Input
                        className="h-9 min-w-[160px] flex-1"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder={t("defaultPrices.product.search", "Search name or SKU…")}
                      />
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="h-9 w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={FILTER_ALL}>{t("defaultPrices.product.allCategories", "All categories")}</SelectItem>
                          <SelectItem value="__none__">{t("defaultPrices.product.uncategorized", "Uncategorized")}</SelectItem>
                          {categories.rows.map((row) => (
                            <SelectItem key={row.id} value={row.id}>
                              {row.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={brandFilter} onValueChange={setBrandFilter}>
                        <SelectTrigger className="h-9 w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={FILTER_ALL}>{t("defaultPrices.product.allBrands", "All brands")}</SelectItem>
                          <SelectItem value="__none__">{t("defaultPrices.product.unbranded", "Unbranded")}</SelectItem>
                          {brands.rows.map((row) => (
                            <SelectItem key={row.id} value={row.id}>
                              {row.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={stockFilter} onValueChange={(value) => setStockFilter(value as typeof stockFilter)}>
                        <SelectTrigger className="h-9 w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t("defaultPrices.product.allStock", "All stock")}</SelectItem>
                          <SelectItem value="menu">{t("defaultPrices.product.untracked", "Menu (no stock)")}</SelectItem>
                          <SelectItem value="tracked">{t("defaultPrices.product.tracked", "Tracked")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-9 w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={FILTER_ALL}>{t("defaultPrices.product.allStatus", "All status")}</SelectItem>
                          {CATALOG_POS_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {t(`defaultPrices.product.status.${status}`, status)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <DefaultProductsTable
                      rows={filteredProductRows}
                      isLoading={isLoading}
                      selectedOutletId={selectedOutletId}
                      onEdit={handleEdit}
                      onDuplicate={handleDuplicate}
                      onDelete={deleteRow}
                    />
                  </>
                ) : (
                  <DefaultPricesTable
                    rows={serviceRows}
                    isLoading={isLoading}
                    onEdit={handleEdit}
                    onDelete={deleteRow}
                    onOpenSop={handleOpenSop}
                  />
                )}
            </div>
          </div>
        </div>
      </div>
      <div className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4" aria-hidden />

      {isLibraryConfigView ? null : isProducts ? (
        <DefaultProductFormDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingRow(null);
              setPrefillRow(null);
            }
          }}
          onSubmit={handleSubmitProduct}
          editingRow={editingRow?.kind === "product" ? editingRow : null}
          prefillRow={prefillRow}
          selectedOutletId={selectedOutletId}
          selectedOutletName={selectedOutletName}
        />
      ) : (
        <DefaultPriceFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={handleSubmitService}
          editingRow={editingRow?.kind === "product" ? null : editingRow}
        />
      )}

      <SopWorkflowModal
        open={sopModalRow != null}
        onOpenChange={(open) => !open && setSopModalRow(null)}
        defaultPriceRow={sopModalRow}
      />
    </DefaultPricesModuleShell>
  );
}

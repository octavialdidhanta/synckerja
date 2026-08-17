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
import { useCatalogProductCategories } from "../hooks/useCatalogProductCategories";
import {
  DefaultPricesTable,
  DefaultPriceFormDialog,
  DefaultProductFormDialog,
  DefaultProductsTable,
  ProductCategoriesDialog,
  SopWorkflowModal,
} from "../components";
import { DefaultPricesModuleShell } from "../layout/DefaultPricesModuleShell";
import { catalogTabFromSearch } from "../layout/DefaultPricesHeaderAndTab";
import { CATALOG_POS_STATUSES, normalizeCatalogPosStatus } from "../lib/catalogKind";
import type { DefaultPriceRow, DefaultPriceCreate, DefaultPriceUpdate } from "../types/defaultPrices";

const FILTER_ALL = "__all__";

export default function DefaultPricesPage() {
  const { t } = useAppTranslation();
  const location = useLocation();
  const catalogTab = catalogTabFromSearch(location.search);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<DefaultPriceRow | null>(null);
  const [prefillRow, setPrefillRow] = useState<DefaultPriceRow | null>(null);
  const [sopModalRow, setSopModalRow] = useState<DefaultPriceRow | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(FILTER_ALL);
  const [stockFilter, setStockFilter] = useState<"all" | "menu" | "tracked">("all");
  const [statusFilter, setStatusFilter] = useState(FILTER_ALL);

  const { organizationId, orgBootstrapPending } = useOrgBootstrapPending();
  const { rows, isLoading, create, update, delete: deleteRow, isCreating } = useDefaultPrices();
  const categories = useCatalogProductCategories();

  const hasPendingLoad = orgBootstrapPending || (!!organizationId && isLoading);
  const showContent = useDebouncedReady(!hasPendingLoad, 200);

  const serviceRows = useMemo(() => rows.filter((row) => row.kind !== "product"), [rows]);
  const productRows = useMemo(() => rows.filter((row) => row.kind === "product"), [rows]);
  const filteredProductRows = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return productRows.filter((row) => {
      if (q) {
        const hay = `${row.name ?? ""} ${row.sku_code ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (categoryFilter === "__none__") {
        if (row.product_category_id) return false;
      } else if (categoryFilter !== FILTER_ALL && row.product_category_id !== categoryFilter) {
        return false;
      }
      if (stockFilter === "tracked" && !row.track_stock) return false;
      if (stockFilter === "menu" && row.track_stock) return false;
      if (statusFilter !== FILTER_ALL && normalizeCatalogPosStatus(row.pos_status) !== statusFilter) return false;
      return true;
    });
  }, [productRows, productSearch, categoryFilter, stockFilter, statusFilter]);

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
            unit_price: payload.unit_price,
            description: payload.description ?? null,
            name: payload.name ?? null,
            photo_path: payload.photo_path ?? null,
            unit: payload.unit ?? "pcs",
            track_stock: payload.track_stock ?? false,
            inventory_sku_id: payload.inventory_sku_id ?? null,
            product_category_id: payload.product_category_id ?? null,
            pos_status: payload.pos_status ?? "available",
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

  const isProducts = catalogTab === "products";

  return (
    <DefaultPricesModuleShell showContent={showContent}>
      <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
        <div className="col-span-12 flex min-h-0 flex-col">
          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card shadow-sm">
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-4 py-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                    {isProducts ? (
                      <Button type="button" variant="outline" onClick={() => setCategoriesOpen(true)}>
                        {t("defaultPrices.product.manageCategories", "Manage categories")}
                      </Button>
                    ) : null}
                    <Button onClick={handleAdd} disabled={!organizationId || isCreating}>
                      <Plus className="mr-2 h-4 w-4" />
                      {t("common.add", "Add")}
                    </Button>
                  </div>
                </div>
                {isProducts ? (
                  <>
                    <div className="mb-3 flex flex-wrap gap-2">
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
      </div>
      <div className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4" aria-hidden />

      {isProducts ? (
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
        />
      ) : (
        <DefaultPriceFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={handleSubmitService}
          editingRow={editingRow?.kind === "product" ? null : editingRow}
        />
      )}

      <ProductCategoriesDialog open={categoriesOpen} onOpenChange={setCategoriesOpen} />

      <SopWorkflowModal
        open={sopModalRow != null}
        onOpenChange={(open) => !open && setSopModalRow(null)}
        defaultPriceRow={sopModalRow}
      />
    </DefaultPricesModuleShell>
  );
}

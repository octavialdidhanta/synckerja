import { useState, useMemo, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import { StockManagementModuleShell } from "@/6-0-stock-management/layout/StockManagementModuleShell";
import { PlatformMappingDialog } from "@/6-0-stock-management/container/PlatformMappingDialog";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { DefaultProductFormDialog } from "@/8-2-1-default-prices/components/DefaultProductFormDialog";
import { useDefaultPrices } from "@/8-2-1-default-prices/hooks/useDefaultPrices";
import type { DefaultPriceCreate, DefaultPriceRow } from "@/8-2-1-default-prices/types/defaultPrices";
import {
  invalidateOrderCatalogQueries,
  syncProductOrderPublish,
} from "@/synckerja-order/5-backoffice-shell/hooks/useProductOrderPublish";
import { usePosOutlets } from "@/8-2-2-outlets/hooks/usePosOutlets";
import { defaultPosOutletId } from "@/8-2-2-outlets/lib/assignedOutlets";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { useInventorySkusQuery } from "@/stock-management/hooks/useInventorySkusQuery";
import { useOrphanInventorySkus } from "@/stock-management/hooks/useOrphanInventorySkus";
import { usePlatformSkuMappingsQuery } from "@/stock-management/hooks/usePlatformSkuMappingsQuery";
import { deletePlatformMapping, upsertPlatformMapping } from "@/stock-management/lib/inventoryApi";
import { formatInventoryQty } from "@/stock-management/lib/formatInventoryQty";
import { prefillProductFromInventorySku } from "@/stock-management/lib/prefillProductFromInventorySku";
import { INVENTORY_PLATFORMS } from "@/stock-management/types/inventory";
import type { InventoryPlatformMappingRow, InventorySkuRow } from "@/stock-management/types/inventory";
import { StockManagementDashboardSkeleton } from "@/6-0-stock-management/skeletons/StockManagementDashboardSkeleton";
import { useTikTokShopSettings } from "@/tiktok-shop/hooks/useTikTokShopSettings";

export default function StockPlatformMappingPage() {
  const { orgBootstrapPending } = useOrgBootstrapPending();
  if (orgBootstrapPending) return <StockManagementDashboardSkeleton />;
  return (
    <StockManagementModuleShell>
      <StockPlatformMappingContent />
    </StockManagementModuleShell>
  );
}

function platformLabel(platform: string, t: (key: string, fallback: string) => string) {
  const match = INVENTORY_PLATFORMS.find((p) => p.value === platform);
  return match ? t(match.labelKey, match.defaultLabel) : platform;
}

function mappingSkuLabel(mapping: InventoryPlatformMappingRow) {
  const skuRef = Array.isArray(mapping.inventory_skus)
    ? mapping.inventory_skus[0]
    : mapping.inventory_skus;
  return skuRef?.internal_sku ?? mapping.sku_id.slice(0, 8);
}

function StockPlatformMappingContent() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { create } = useDefaultPrices();
  const { rows: outlets } = usePosOutlets();
  const defaultOutletId = defaultPosOutletId(outlets);
  const defaultOutletName = outlets.find((row) => row.id === defaultOutletId)?.name ?? null;
  const { data: skusData } = useInventorySkusQuery(organizationId);
  const { orphans, isLoading: orphanLoading } = useOrphanInventorySkus(organizationId);
  const { data: mappingsData, isLoading } = usePlatformSkuMappingsQuery(organizationId);
  const { data: tiktokSettings } = useTikTokShopSettings(organizationId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productPrefill, setProductPrefill] = useState<DefaultPriceRow | null>(null);
  const [search, setSearch] = useState("");
  const [skuId, setSkuId] = useState("");
  const [platform, setPlatform] = useState("tiktok_shop");
  const [sellerSku, setSellerSku] = useState("");
  const [platformProductId, setPlatformProductId] = useState("");
  const [platformSkuId, setPlatformSkuId] = useState("");
  const [shopAccountId, setShopAccountId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const skus = skusData?.rows ?? [];
  const mappings = mappingsData?.rows ?? [];
  const shops = useMemo(
    () =>
      (tiktokSettings?.sellers ?? []).flatMap((seller) =>
        seller.shops.filter((shop) => shop.is_active),
      ),
    [tiktokSettings],
  );
  const shopById = useMemo(() => new Map(shops.map((shop) => [shop.id, shop])), [shops]);

  const filteredMappings = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return mappings;
    return mappings.filter((mapping) => {
      const sku = mappingSkuLabel(mapping).toLowerCase();
      const shop = shopById.get(mapping.shop_account_id ?? "");
      const shopLabel = (shop?.label || shop?.shop_name || shop?.shop_id || "").toLowerCase();
      const platformText = platformLabel(mapping.platform, t).toLowerCase();
      return (
        sku.includes(q) ||
        platformText.includes(q) ||
        mapping.platform.toLowerCase().includes(q) ||
        (mapping.seller_sku ?? "").toLowerCase().includes(q) ||
        (mapping.platform_product_id ?? "").toLowerCase().includes(q) ||
        (mapping.platform_sku_id ?? "").toLowerCase().includes(q) ||
        shopLabel.includes(q) ||
        (mapping.warehouse_id ?? "").toLowerCase().includes(q)
      );
    });
  }, [mappings, search, shopById, t]);

  useEffect(() => {
    if (!dialogOpen || editingId || shopAccountId || shops.length === 0) return;
    const preferred = shops.find((shop) => shop.is_default) ?? shops[0];
    if (preferred) setShopAccountId(preferred.id);
  }, [shops, shopAccountId, dialogOpen, editingId]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["inventory-mappings", organizationId] });
    void queryClient.invalidateQueries({ queryKey: ["inventory-sku-linked", organizationId] });
    void queryClient.invalidateQueries({ queryKey: ["inventory-skus", organizationId] });
    void queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
    void queryClient.invalidateQueries({ queryKey: ["default-prices", organizationId] });
  }, [organizationId, queryClient]);

  const openCreateProductFromSku = useCallback(
    (sku: InventorySkuRow) => {
      if (!organizationId || !defaultOutletId) {
        toast.error(t("operations.inventory.summary.migrateSkuNoOutlet", "Assign an active outlet first."));
        return;
      }
      setProductPrefill(
        prefillProductFromInventorySku({
          organizationId,
          sku,
          outletId: defaultOutletId,
        }),
      );
      setProductDialogOpen(true);
    },
    [defaultOutletId, organizationId, t],
  );

  const handleCreateProductFromSku = useCallback(
    async (payload: DefaultPriceCreate) => {
      if (!organizationId) return;
      const created = await create({
        ...payload,
        organization_id: organizationId,
        kind: "product",
        selected_outlet_id: defaultOutletId,
      });
      const productId = String(created?.id ?? payload.id ?? "");
      if (productId) {
        await syncProductOrderPublish({
          organizationId,
          productId,
          selectedOutletId: defaultOutletId,
          assignedOutletIds: payload.outlet_ids ?? (defaultOutletId ? [defaultOutletId] : []),
          wantPublish: Boolean(payload.order_publish),
        });
        invalidateOrderCatalogQueries(queryClient, organizationId);
      }
      toast.success(t("operations.inventory.orphanSku.productCreated", "Product created from SKU."));
      setProductDialogOpen(false);
      setProductPrefill(null);
      invalidate();
    },
    [create, defaultOutletId, invalidate, organizationId, queryClient, t],
  );

  if (gatePending || (isLoading && mappings.length === 0)) {
    return null;
  }

  const resetForm = () => {
    setEditingId(null);
    setSkuId("");
    setPlatform("tiktok_shop");
    setSellerSku("");
    setPlatformProductId("");
    setPlatformSkuId("");
    setShopAccountId("");
    setWarehouseId("");
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (mapping: InventoryPlatformMappingRow) => {
    setEditingId(mapping.id);
    setSkuId(mapping.sku_id);
    setPlatform(mapping.platform);
    setSellerSku(mapping.seller_sku ?? "");
    setPlatformProductId(mapping.platform_product_id ?? "");
    setPlatformSkuId(mapping.platform_sku_id ?? "");
    setShopAccountId(mapping.shop_account_id ?? "");
    const wh = mapping.warehouse_id?.trim() ?? "";
    setWarehouseId(wh === "default" ? "" : wh);
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) resetForm();
  };

  const handleSave = async () => {
    if (!organizationId || !skuId) return;
    setSaving(true);
    try {
      await upsertPlatformMapping(organizationId, {
        ...(editingId ? { id: editingId } : {}),
        sku_id: skuId,
        platform,
        seller_sku: sellerSku,
        platform_product_id: platformProductId,
        platform_sku_id: platformSkuId,
        shop_account_id: shopAccountId || null,
        warehouse_id: warehouseId.trim() || null,
      });
      toast.success(
        t(
          editingId
            ? "operations.stockManagement.mappingUpdated"
            : "operations.stockManagement.mappingSaved",
          editingId ? "Mapping updated" : "Mapping saved",
        ),
      );
      handleDialogOpenChange(false);
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {canManage && orphans.length > 0 ? (
        <div className="col-span-12 space-y-3 rounded-lg border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {t("operations.inventory.orphanSku.title", "SKUs not in Item Library")}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(
                "operations.inventory.orphanSku.desc",
                "Create an Item Library product to show legacy SKU stock on Summary. Photo is required.",
              )}
            </p>
          </div>
          <div className="min-h-0 overflow-x-auto rounded-md border border-amber-100 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("operations.stockManagement.colInternalSku", "Internal SKU")}</TableHead>
                  <TableHead>{t("operations.inventory.orphanSku.colName", "Name")}</TableHead>
                  <TableHead className="text-right">{t("operations.inventory.orphanSku.colQty", "Pool qty")}</TableHead>
                  <TableHead className="text-right">{t("operations.stockManagement.colActions", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orphans.map((sku) => (
                  <TableRow key={sku.id}>
                    <TableCell className="font-mono text-xs">{sku.internal_sku}</TableCell>
                    <TableCell>{sku.name || sku.product_name || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatInventoryQty(sku.available_qty)}</TableCell>
                    <TableCell className="text-right">
                      <Button type="button" size="sm" variant="outline" onClick={() => openCreateProductFromSku(sku)}>
                        {t("operations.inventory.orphanSku.createProduct", "Create product")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : orphanLoading && canManage ? (
        <div className="col-span-12 rounded-lg border border-gray-200 bg-white p-4 text-sm text-muted-foreground shadow-sm">
          {t("operations.inventory.orphanSku.loading", "Checking legacy SKUs…")}
        </div>
      ) : null}

      <div className="col-span-12 space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(
                "operations.stockManagement.searchMappings",
                "Search SKU, shop, or ID",
              )}
              className="pl-8"
            />
          </div>
          {canManage ? (
            <Button onClick={openAddDialog}>
              <Plus className="mr-1 h-4 w-4" />
              {t("operations.stockManagement.addMapping", "Add mapping")}
            </Button>
          ) : null}
        </div>

        {filteredMappings.length === 0 ? (
          <div className="flex min-h-[200px] items-center justify-center p-6 text-sm text-muted-foreground">
            {mappings.length === 0
              ? t("operations.stockManagement.noMappings", "No mappings yet.")
              : t("operations.stockManagement.noMappingsMatch", "No mappings match this search.")}
          </div>
        ) : (
          <div className="min-h-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("operations.stockManagement.colInternalSku", "Internal SKU")}</TableHead>
                  <TableHead>{t("operations.stockManagement.colPlatform", "Platform")}</TableHead>
                  <TableHead>{t("operations.stockManagement.colShop", "Shop")}</TableHead>
                  <TableHead>{t("operations.stockManagement.sellerSku", "Seller SKU")}</TableHead>
                  <TableHead>{t("operations.stockManagement.colProductId", "Product ID")}</TableHead>
                  <TableHead>{t("operations.stockManagement.colSkuId", "SKU ID")}</TableHead>
                  <TableHead>{t("operations.stockManagement.warehouseId", "Warehouse ID")}</TableHead>
                  {canManage ? (
                    <TableHead className="text-right">
                      {t("operations.stockManagement.colActions", "Actions")}
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMappings.map((mapping) => {
                  const shop = shopById.get(mapping.shop_account_id ?? "");
                  const warehouse =
                    mapping.warehouse_id && mapping.warehouse_id !== "default"
                      ? mapping.warehouse_id
                      : "—";
                  return (
                    <TableRow key={mapping.id}>
                      <TableCell className="font-mono text-xs">{mappingSkuLabel(mapping)}</TableCell>
                      <TableCell>{platformLabel(mapping.platform, t)}</TableCell>
                      <TableCell>
                        {shop?.label || shop?.shop_name || shop?.shop_id || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{mapping.seller_sku || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {mapping.platform_product_id || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {mapping.platform_sku_id || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{warehouse}</TableCell>
                      {canManage ? (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={t("common.edit", "Edit")}
                              onClick={() => openEditDialog(mapping)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={t("common.delete", "Delete")}
                              onClick={async () => {
                                if (!organizationId) return;
                                await deletePlatformMapping(organizationId, mapping.id);
                                invalidate();
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <div
        className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
        aria-hidden
      />

      {canManage ? (
        <PlatformMappingDialog
          open={dialogOpen}
          onOpenChange={handleDialogOpenChange}
          editing={Boolean(editingId)}
          skuId={skuId}
          onSkuIdChange={setSkuId}
          platform={platform}
          onPlatformChange={setPlatform}
          sellerSku={sellerSku}
          onSellerSkuChange={setSellerSku}
          platformProductId={platformProductId}
          onPlatformProductIdChange={setPlatformProductId}
          platformSkuId={platformSkuId}
          onPlatformSkuIdChange={setPlatformSkuId}
          shopAccountId={shopAccountId}
          onShopAccountIdChange={setShopAccountId}
          warehouseId={warehouseId}
          onWarehouseIdChange={setWarehouseId}
          skus={skus}
          shops={shops}
          saving={saving}
          onSave={handleSave}
        />
      ) : null}

      {canManage ? (
        <DefaultProductFormDialog
          open={productDialogOpen}
          onOpenChange={(open) => {
            setProductDialogOpen(open);
            if (!open) setProductPrefill(null);
          }}
          onSubmit={handleCreateProductFromSku}
          prefillRow={productPrefill}
          selectedOutletId={defaultOutletId}
          selectedOutletName={defaultOutletName}
        />
      ) : null}
    </>
  );
}

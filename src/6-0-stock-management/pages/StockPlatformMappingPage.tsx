import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { StockManagementModuleShell } from "@/6-0-stock-management/layout/StockManagementModuleShell";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useOmnichannelSurveySettingsAdmin } from "@/features/customer-survey/hooks/useOmnichannelSurveySettingsAdmin";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { useInventorySkusQuery } from "@/stock-management/hooks/useInventorySkusQuery";
import { usePlatformSkuMappingsQuery } from "@/stock-management/hooks/usePlatformSkuMappingsQuery";
import { deletePlatformMapping, upsertPlatformMapping } from "@/stock-management/lib/inventoryApi";
import { INVENTORY_PLATFORMS } from "@/stock-management/types/inventory";
import type { InventoryPlatformMappingRow } from "@/stock-management/types/inventory";
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

function StockPlatformMappingContent() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { organizationId, canManage, gatePending } = useOmnichannelSurveySettingsAdmin();
  const { data: skusData } = useInventorySkusQuery(organizationId);
  const { data: mappingsData, isLoading } = usePlatformSkuMappingsQuery(organizationId);
  const { data: tiktokSettings } = useTikTokShopSettings(organizationId);

  const [skuId, setSkuId] = useState("");
  const [platform, setPlatform] = useState("tiktok_shop");
  const [sellerSku, setSellerSku] = useState("");
  const [platformProductId, setPlatformProductId] = useState("");
  const [platformSkuId, setPlatformSkuId] = useState("");
  const [shopAccountId, setShopAccountId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const skus = skusData?.rows ?? [];
  const mappings = mappingsData?.rows ?? [];
  const shops = useMemo(
    () =>
      (tiktokSettings?.sellers ?? []).flatMap((seller) =>
        seller.shops.filter((shop) => shop.is_active),
      ),
    [tiktokSettings],
  );

  useEffect(() => {
    if (shopAccountId || shops.length === 0) return;
    const preferred = shops.find((shop) => shop.is_default) ?? shops[0];
    if (preferred) setShopAccountId(preferred.id);
  }, [shops, shopAccountId]);

  if (gatePending || (isLoading && mappings.length === 0)) {
    return null;
  }

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["inventory-mappings", organizationId] });
  };

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

  const loadMappingForEdit = (mapping: InventoryPlatformMappingRow) => {
    setEditingId(mapping.id);
    setSkuId(mapping.sku_id);
    setPlatform(mapping.platform);
    setSellerSku(mapping.seller_sku ?? "");
    setPlatformProductId(mapping.platform_product_id ?? "");
    setPlatformSkuId(mapping.platform_sku_id ?? "");
    setShopAccountId(mapping.shop_account_id ?? "");
    const wh = mapping.warehouse_id?.trim() ?? "";
    setWarehouseId(wh === "default" ? "" : wh);
  };

  const handleSave = async () => {
    if (!organizationId || !skuId) return;
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
      resetForm();
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
            <div className="col-span-12 space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              {canManage ? (
                <div className="space-y-2">
                  {editingId ? (
                    <p className="text-sm text-muted-foreground">
                      {t("operations.stockManagement.editingMapping", "Editing mapping — save or cancel")}
                    </p>
                  ) : null}
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <Label>{t("operations.stockManagement.colInternalSku", "Internal SKU")}</Label>
                    <Select value={skuId} onValueChange={setSkuId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select SKU" />
                      </SelectTrigger>
                      <SelectContent>
                        {skus.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.internal_sku}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("operations.stockManagement.colPlatform", "Platform")}</Label>
                    <Select value={platform} onValueChange={setPlatform}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INVENTORY_PLATFORMS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {t(p.labelKey, p.defaultLabel)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("operations.stockManagement.sellerSku", "Seller SKU")}</Label>
                    <Input value={sellerSku} onChange={(e) => setSellerSku(e.target.value)} />
                  </div>
                  <div>
                    <Label>{t("operations.stockManagement.platformProductId", "Platform product ID")}</Label>
                    <Input value={platformProductId} onChange={(e) => setPlatformProductId(e.target.value)} />
                  </div>
                  <div>
                    <Label>{t("operations.stockManagement.platformSkuId", "Platform SKU ID")}</Label>
                    <Input value={platformSkuId} onChange={(e) => setPlatformSkuId(e.target.value)} />
                  </div>
                  {platform === "tiktok_shop" ? (
                    <div>
                      <Label>{t("operations.stockManagement.tiktokShop", "TikTok shop")}</Label>
                      <Select value={shopAccountId} onValueChange={setShopAccountId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Shop" />
                        </SelectTrigger>
                        <SelectContent>
                          {shops.map((shop) => (
                            <SelectItem key={shop.id} value={shop.id}>
                              {shop.label || shop.shop_name || shop.shop_id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  <div>
                    <Label>{t("operations.stockManagement.warehouseId", "Warehouse ID")}</Label>
                    <Input
                      value={warehouseId}
                      onChange={(e) => setWarehouseId(e.target.value)}
                      placeholder={t(
                        "operations.stockManagement.warehouseIdPlaceholder",
                        "Leave empty — auto from TikTok",
                      )}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button onClick={handleSave} disabled={!skuId}>
                      {editingId ? (
                        t("operations.stockManagement.saveMapping", "Save mapping")
                      ) : (
                        <>
                          <Plus className="mr-1 h-4 w-4" />
                          {t("operations.stockManagement.addMapping", "Add mapping")}
                        </>
                      )}
                    </Button>
                    {editingId ? (
                      <Button type="button" variant="outline" onClick={resetForm}>
                        <X className="mr-1 h-4 w-4" />
                        {t("common.cancel", "Cancel")}
                      </Button>
                    ) : null}
                  </div>
                </div>
                </div>
              ) : null}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Seller SKU</TableHead>
                    <TableHead>Product / SKU ID</TableHead>
                    {canManage ? <TableHead /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((m) => {
                    const skuRef = Array.isArray(m.inventory_skus)
                      ? m.inventory_skus[0]
                      : m.inventory_skus;
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-xs">
                          {skuRef?.internal_sku ?? m.sku_id.slice(0, 8)}
                        </TableCell>
                        <TableCell>{m.platform}</TableCell>
                        <TableCell>{m.seller_sku || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.platform_product_id} / {m.platform_sku_id}
                        </TableCell>
                        {canManage ? (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={t("common.edit", "Edit")}
                                onClick={() => loadMappingForEdit(m)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={t("common.delete", "Delete")}
                                onClick={async () => {
                                  if (!organizationId) return;
                                  if (editingId === m.id) resetForm();
                                  await deletePlatformMapping(organizationId, m.id);
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
            <div className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4" aria-hidden />
    </>
  );
}

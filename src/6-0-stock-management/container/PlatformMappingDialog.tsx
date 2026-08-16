import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
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
import { INVENTORY_PLATFORMS } from "@/stock-management/types/inventory";

type ShopOption = {
  id: string;
  label: string | null;
  shop_name: string | null;
  shop_id: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  skuId: string;
  onSkuIdChange: (value: string) => void;
  platform: string;
  onPlatformChange: (value: string) => void;
  sellerSku: string;
  onSellerSkuChange: (value: string) => void;
  platformProductId: string;
  onPlatformProductIdChange: (value: string) => void;
  platformSkuId: string;
  onPlatformSkuIdChange: (value: string) => void;
  shopAccountId: string;
  onShopAccountIdChange: (value: string) => void;
  warehouseId: string;
  onWarehouseIdChange: (value: string) => void;
  skus: { id: string; internal_sku: string }[];
  shops: ShopOption[];
  saving?: boolean;
  onSave: () => void;
};

export function PlatformMappingDialog({
  open,
  onOpenChange,
  editing,
  skuId,
  onSkuIdChange,
  platform,
  onPlatformChange,
  sellerSku,
  onSellerSkuChange,
  platformProductId,
  onPlatformProductIdChange,
  platformSkuId,
  onPlatformSkuIdChange,
  shopAccountId,
  onShopAccountIdChange,
  warehouseId,
  onWarehouseIdChange,
  skus,
  shops,
  saving = false,
  onSave,
}: Props) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? t("operations.stockManagement.editMapping", "Edit mapping")
              : t("operations.stockManagement.addMapping", "Add mapping")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>{t("operations.stockManagement.colInternalSku", "Internal SKU")}</Label>
              <Select value={skuId} onValueChange={onSkuIdChange}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("operations.stockManagement.selectSku", "Select SKU")}
                  />
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
              <Select value={platform} onValueChange={onPlatformChange}>
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
            {platform === "tiktok_shop" ? (
              <div>
                <Label>{t("operations.stockManagement.tiktokShop", "TikTok shop")}</Label>
                <Select value={shopAccountId} onValueChange={onShopAccountIdChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("operations.stockManagement.colShop", "Shop")} />
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
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>{t("operations.stockManagement.sellerSku", "Seller SKU")}</Label>
              <Input value={sellerSku} onChange={(e) => onSellerSkuChange(e.target.value)} />
            </div>
            <div>
              <Label>{t("operations.stockManagement.platformProductId", "Platform product ID")}</Label>
              <Input
                value={platformProductId}
                onChange={(e) => onPlatformProductIdChange(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("operations.stockManagement.platformSkuId", "Platform SKU ID")}</Label>
              <Input
                value={platformSkuId}
                onChange={(e) => onPlatformSkuIdChange(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>{t("operations.stockManagement.warehouseId", "Warehouse ID")}</Label>
            <Input
              value={warehouseId}
              onChange={(e) => onWarehouseIdChange(e.target.value)}
              placeholder={t(
                "operations.stockManagement.warehouseIdPlaceholder",
                "Leave empty — auto from TikTok",
              )}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button onClick={onSave} disabled={!skuId || saving}>
            {t("operations.stockManagement.saveMapping", "Save mapping")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

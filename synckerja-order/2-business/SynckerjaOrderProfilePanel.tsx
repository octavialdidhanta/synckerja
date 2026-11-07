import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { useToast } from "@/shared/components/ui/use-toast";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { SYNCKERJA_ORDER_I18N } from "@/synckerja-order/shared/lib/orderCopy";
import type { SynckerjaOrderOrgSettings } from "@/synckerja-order/shared/lib/orderTypes";
import {
  resolveCatalogPhotoUrls,
  uploadSynckerjaOrderCover,
} from "@/synckerja-order/shared/lib/orderStorePhoto";
import {
  synckerjaOrderTabLocation,
  synckerjaOrderTabPath,
  type SynckerjaOrderSubTab,
} from "@/synckerja-order/5-backoffice-shell/lib/synckerjaOrderTabs";
import { SynckerjaOrderOutletSelect } from "./SynckerjaOrderOutletSelect";

type OutletOption = {
  id: string;
  name: string;
};

type Props = {
  settings: SynckerjaOrderOrgSettings;
  onChange: (patch: Partial<SynckerjaOrderOrgSettings>) => void;
  outlets: OutletOption[];
  outletId: string | null;
  onOutletChange: (outletId: string) => void;
  coverPath: string | null;
  coverLoading: boolean;
  onCoverChange: (coverPath: string | null) => Promise<void>;
};

const BRANCH_STEPS: SynckerjaOrderSubTab[] = ["hours", "catalog", "qr", "outlets"];

export function SynckerjaOrderProfilePanel({
  settings,
  onChange,
  outlets,
  outletId,
  onOutletChange,
  coverPath,
  coverLoading,
  onCoverChange,
}: Props) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { organizationId } = useCurrentOrg();
  const navigate = useNavigate();
  const location = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const previewPath = coverLoading ? null : coverPath || settings.cover_path;
  const coverQuery = useQuery({
    queryKey: ["synckerja-order-cover", previewPath],
    queryFn: async () => {
      const map = await resolveCatalogPhotoUrls([previewPath]);
      return previewPath ? map.get(previewPath) ?? null : null;
    },
    enabled: Boolean(previewPath) && !coverLoading,
  });
  const coverUrl = localPreview || coverQuery.data;
  const usingSharedCover = !coverPath && Boolean(settings.cover_path);

  useEffect(() => {
    setLocalPreview(null);
  }, [outletId]);

  const onPickCover = async (file: File | undefined) => {
    if (!file || !organizationId || !outletId) return;
    setUploading(true);
    try {
      const path = await uploadSynckerjaOrderCover({ organizationId, outletId, file });
      setLocalPreview(URL.createObjectURL(file));
      await onCoverChange(path);
      toast({ title: t("synckerjaOrder.saved", "Saved") });
    } catch (err) {
      toast({
        title: t("synckerjaOrder.saveError", "Failed to save"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onRemoveCover = async () => {
    setLocalPreview(null);
    try {
      await onCoverChange(null);
      toast({ title: t("synckerjaOrder.saved", "Saved") });
    } catch (err) {
      toast({
        title: t("synckerjaOrder.saveError", "Failed to save"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="grid content-start gap-3 p-3 xl:grid-cols-2">
      <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <SynckerjaOrderOutletSelect outlets={outlets} value={outletId} onChange={onOutletChange} />
        <div className="space-y-1">
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => void onPickCover(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={uploading || coverLoading || !organizationId || !outletId}
            className="relative block aspect-[12/5] w-full overflow-hidden rounded-xl border border-dashed border-border bg-muted/40 text-left disabled:opacity-60"
            onClick={() => fileRef.current?.click()}
          >
            {coverUrl ? (
              <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <span
              className={`absolute inset-x-0 bottom-0 px-3 py-3 text-sm ${
                coverUrl
                  ? "bg-gradient-to-t from-black/60 to-transparent text-white"
                  : "flex h-full items-end text-foreground"
              }`}
            >
              <span className="block">
                {uploading
                  ? t("synckerjaOrder.profile.coverUploading", "Uploading…")
                  : t("synckerjaOrder.profile.coverDrop", "Click to upload a banner photo")}
              </span>
              <span className={`mt-0.5 block text-xs ${coverUrl ? "text-white/80" : "text-muted-foreground"}`}>
                {t(
                  "synckerjaOrder.profile.coverHint",
                  "Wide photo, about 1200×500. Saved immediately for this branch.",
                )}
              </span>
            </span>
          </button>
          {!coverLoading && usingSharedCover && !localPreview ? (
            <p className="text-xs text-muted-foreground">
              {t(
                "synckerjaOrder.profile.coverInherited",
                "This branch is still using the shared banner. Upload a photo to replace it for this branch only.",
              )}
            </p>
          ) : null}
          {coverPath ? (
            <button
              type="button"
              className="text-xs text-muted-foreground underline"
              onClick={() => void onRemoveCover()}
            >
              {t("synckerjaOrder.profile.coverRemove", "Remove hero image")}
            </button>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t("synckerjaOrder.profile.branchNext", "Continue setting up this branch")}
          </p>
          <div className="flex flex-wrap gap-2">
          {BRANCH_STEPS.map((step) => (
            <button
              key={step}
              type="button"
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
              onClick={() =>
                navigate(synckerjaOrderTabLocation(synckerjaOrderTabPath(step), location.search), {
                  preventScrollReset: true,
                })
              }
            >
              {t(
                step === "hours"
                  ? SYNCKERJA_ORDER_I18N.tabHours
                  : step === "catalog"
                    ? SYNCKERJA_ORDER_I18N.tabCatalog
                    : step === "qr"
                      ? SYNCKERJA_ORDER_I18N.tabQr
                      : SYNCKERJA_ORDER_I18N.tabOutlets,
                step === "hours" ? "Hours" : step === "catalog" ? "Catalog" : step === "qr" ? "QR" : "Outlets",
              )}
            </button>
          ))}
          </div>
        </div>
      </section>
      <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <div className="space-y-1">
          <Label>{t("synckerjaOrder.profile.businessName", "Business name")}</Label>
          <Input
            className="h-10 w-full"
            value={settings.business_name}
            onChange={(e) => onChange({ business_name: e.target.value })}
          />
        </div>
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <div>
            <p className="text-sm font-medium">{t("synckerjaOrder.profile.pickup", "Take Away")}</p>
            <p className="text-xs text-muted-foreground">
              {t("synckerjaOrder.profile.pickupHint", "Allow Take Away on the table QR guest menu.")}
            </p>
          </div>
          <Switch
            checked={settings.pickup_enabled}
            onCheckedChange={(v) => onChange({ pickup_enabled: v })}
          />
        </div>
      </section>
    </div>
  );
}

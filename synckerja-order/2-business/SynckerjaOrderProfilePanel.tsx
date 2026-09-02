import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { useToast } from "@/shared/components/ui/use-toast";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { SynckerjaOrderOrgSettings } from "@/synckerja-order/shared/lib/orderTypes";
import {
  resolveCatalogPhotoUrls,
  uploadSynckerjaOrderCover,
} from "@/synckerja-order/shared/lib/orderStorePhoto";

type Props = {
  settings: SynckerjaOrderOrgSettings;
  onChange: (patch: Partial<SynckerjaOrderOrgSettings>) => void;
};

export function SynckerjaOrderProfilePanel({ settings, onChange }: Props) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { organizationId } = useCurrentOrg();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const coverQuery = useQuery({
    queryKey: ["synckerja-order-cover", settings.cover_path],
    queryFn: async () => {
      const map = await resolveCatalogPhotoUrls([settings.cover_path]);
      return settings.cover_path ? map.get(settings.cover_path) ?? null : null;
    },
    enabled: Boolean(settings.cover_path),
  });
  const coverUrl = localPreview || coverQuery.data;

  const onPickCover = async (file: File | undefined) => {
    if (!file || !organizationId) return;
    setUploading(true);
    try {
      const path = await uploadSynckerjaOrderCover({ organizationId, file });
      setLocalPreview(URL.createObjectURL(file));
      onChange({ cover_path: path });
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

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-1.5">
        <Label>{t("synckerjaOrder.profile.businessName", "Business name")}</Label>
        <Input
          value={settings.business_name}
          onChange={(e) => onChange({ business_name: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t("synckerjaOrder.profile.cover", "Hero image")}</Label>
        <input
          ref={fileRef}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => void onPickCover(e.target.files?.[0])}
        />
        <button
          type="button"
          disabled={uploading || !organizationId}
          className="flex w-full items-center gap-3 rounded-md border border-dashed border-border bg-muted/40 px-3 py-3 text-left disabled:opacity-60"
          onClick={() => fileRef.current?.click()}
        >
          {coverUrl ? (
            <img src={coverUrl} alt="" className="h-16 w-28 shrink-0 rounded object-cover" />
          ) : (
            <span className="h-16 w-28 shrink-0 rounded bg-neutral-200" />
          )}
          <span className="min-w-0">
            <span className="block text-sm">
              {uploading
                ? t("synckerjaOrder.profile.coverUploading", "Uploading…")
                : t("synckerjaOrder.profile.coverDrop", "Click to upload a banner photo")}
            </span>
            <span className="block text-xs text-muted-foreground">
              {t("synckerjaOrder.profile.coverHint", "Wide photo, about 1200×500. Then click Save and continue.")}
            </span>
          </span>
        </button>
        {settings.cover_path ? (
          <button
            type="button"
            className="text-xs text-muted-foreground underline"
            onClick={() => {
              setLocalPreview(null);
              onChange({ cover_path: null });
            }}
          >
            {t("synckerjaOrder.profile.coverRemove", "Remove hero image")}
          </button>
        ) : null}
      </div>
      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
        <div>
          <p className="text-sm font-medium">
            {t("synckerjaOrder.profile.pickup", "Take Away")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t(
              "synckerjaOrder.profile.pickupHint",
              "Allow Take Away on the table QR guest menu.",
            )}
          </p>
        </div>
        <Switch
          checked={settings.pickup_enabled}
          onCheckedChange={(v) => onChange({ pickup_enabled: v })}
        />
      </div>
    </div>
  );
}

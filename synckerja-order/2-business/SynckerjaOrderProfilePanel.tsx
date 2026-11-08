import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { useToast } from "@/shared/components/ui/use-toast";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { SYNCKERJA_ORDER_I18N } from "@/synckerja-order/shared/lib/orderCopy";
import {
  moveCoverPath,
  normalizeCoverPaths,
  ORDER_COVER_SLIDE_LIMIT,
} from "@/synckerja-order/shared/lib/orderCoverSlides";
import {
  OrderCoverSourceTooLargeError,
  OrderCoverTooHeavyError,
  prepareOrderCoverFile,
} from "@/synckerja-order/shared/lib/prepareOrderCoverFile";
import type { SynckerjaOrderOrgSettings } from "@/synckerja-order/shared/lib/orderTypes";
import {
  normalizeCatalogStoragePath,
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
  coverPaths: string[];
  coverLoading: boolean;
  onCoverPathsChange: (coverPaths: string[]) => Promise<unknown>;
};

const BRANCH_STEPS: SynckerjaOrderSubTab[] = ["hours", "catalog", "qr", "outlets"];

export function SynckerjaOrderProfilePanel({
  settings,
  onChange,
  outlets,
  outletId,
  onOutletChange,
  coverPaths,
  coverLoading,
  onCoverPathsChange,
}: Props) {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { organizationId } = useCurrentOrg();
  const navigate = useNavigate();
  const location = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const dragFrom = useRef<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(0);
  const [localPreviews, setLocalPreviews] = useState<Record<string, string>>({});
  const branchPaths = coverLoading ? [] : coverPaths;
  const sharedPath = settings.cover_path?.trim() || null;
  const usingSharedCover = !coverLoading && branchPaths.length === 0 && Boolean(sharedPath);
  const slidePaths = branchPaths.length > 0 ? branchPaths : usingSharedCover && sharedPath ? [sharedPath] : [];
  const selectedIndex = slidePaths.length === 0 ? 0 : Math.min(selected, slidePaths.length - 1);
  const previewPath = coverLoading ? null : slidePaths[selectedIndex] || sharedPath;
  const resolveList = coverLoading
    ? []
    : [...branchPaths, ...(settings.cover_path ? [settings.cover_path] : [])];
  const atLimit = slidePaths.length >= ORDER_COVER_SLIDE_LIMIT;
  const coverQuery = useQuery({
    queryKey: ["synckerja-order-cover", resolveList.join("|")],
    queryFn: () => resolveCatalogPhotoUrls(resolveList),
    enabled: resolveList.length > 0,
  });

  useEffect(() => {
    setSelected(0);
    setLocalPreviews((current) => {
      for (const url of Object.values(current)) URL.revokeObjectURL(url);
      return {};
    });
  }, [outletId]);

  const urlFor = (path: string | null | undefined) => {
    if (!path) return null;
    const local = localPreviews[path];
    if (local) return local;
    const map = coverQuery.data;
    if (!map) return null;
    return map.get(path) ?? map.get(normalizeCatalogStoragePath(path)) ?? null;
  };

  const fail = (err: unknown) => {
    toast({
      title: t("synckerjaOrder.saveError", "Failed to save"),
      description: err instanceof Error ? err.message : undefined,
      variant: "destructive",
    });
  };

  const persist = async (next: string[], previewIndex?: number) => {
    setBusy(true);
    try {
      const saved = normalizeCoverPaths(next);
      await onCoverPathsChange(saved);
      if (previewIndex != null) setSelected(previewIndex);
      toast({ title: t("synckerjaOrder.saved", "Saved") });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onPickCover = async (list: FileList | null) => {
    const files = [...(list ?? [])];
    if (files.length === 0 || !organizationId || !outletId) return;
    const basePaths = usingSharedCover && sharedPath ? [sharedPath] : branchPaths;
    const room = ORDER_COVER_SLIDE_LIMIT - basePaths.length;
    if (room <= 0) {
      toast({
        title: t("synckerjaOrder.profile.coverLimit", "A branch can have up to 8 banner photos."),
      });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const batch = files.slice(0, room);
    if (files.length > room) {
      toast({
        title: t("synckerjaOrder.profile.coverLimit", "A branch can have up to 8 banner photos."),
      });
    }
    setBusy(true);
    try {
      let next = basePaths;
      for (const file of batch) {
        const prepared = await prepareOrderCoverFile(file);
        const path = await uploadSynckerjaOrderCover({ organizationId, outletId, file: prepared });
        setLocalPreviews((current) => ({ ...current, [path]: URL.createObjectURL(prepared) }));
        next = normalizeCoverPaths([...next, path]);
        await onCoverPathsChange(next);
      }
      setSelected(Math.max(0, next.length - 1));
      toast({ title: t("synckerjaOrder.saved", "Saved") });
    } catch (err) {
      if (err instanceof OrderCoverTooHeavyError) {
        toast({
          title: t(
            "synckerjaOrder.profile.coverTooHeavy",
            "This photo stays above 200 KB after compressing. Choose another photo.",
          ),
          variant: "destructive",
        });
      } else if (err instanceof OrderCoverSourceTooLargeError) {
        toast({
          title: t("synckerjaOrder.profile.coverSourceTooLarge", "Use a photo under 15 MB."),
          variant: "destructive",
        });
      } else {
        fail(err);
      }
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const previewUrl = urlFor(previewPath);
  const overlayTitle = busy
    ? t("synckerjaOrder.profile.coverUploading", "Uploading…")
    : atLimit
      ? t("synckerjaOrder.profile.coverLimit", "A branch can have up to 8 banner photos.")
      : slidePaths.length > 0
        ? t("synckerjaOrder.profile.coverAdd", "Add a banner photo")
        : t("synckerjaOrder.profile.coverDrop", "Click to upload a banner photo");

  return (
    <div className="grid content-start gap-3 p-3 xl:grid-cols-2">
      <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <SynckerjaOrderOutletSelect outlets={outlets} value={outletId} onChange={onOutletChange} />
        <div className="space-y-2">
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => void onPickCover(e.target.files)}
          />
          <button
            type="button"
            disabled={busy || coverLoading || !organizationId || !outletId}
            className="relative block aspect-[12/5] w-full overflow-hidden rounded-xl border border-dashed border-border bg-muted/40 text-left disabled:opacity-60"
            onClick={() => {
              if (atLimit) return;
              fileRef.current?.click();
            }}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <span
              className={`absolute inset-x-0 bottom-0 px-3 py-3 text-sm ${
                previewUrl
                  ? "bg-gradient-to-t from-black/60 to-transparent text-white"
                  : "flex h-full items-end text-foreground"
              }`}
            >
              <span className="block">{overlayTitle}</span>
              <span className={`mt-0.5 block text-xs ${previewUrl ? "text-white/80" : "text-muted-foreground"}`}>
                {t(
                  "synckerjaOrder.profile.coverHint",
                  "Wide photo. Resized to about 1200 px and saved under 200 KB. More than one photo slides every 3 seconds.",
                )}
              </span>
            </span>
          </button>
          {slidePaths.length > 0 ? (
            <div className="flex flex-wrap gap-x-2 gap-y-3 pt-2">
              {slidePaths.map((path, index) => {
                const thumbUrl = urlFor(path);
                const isSelected = index === selectedIndex;
                return (
                  <div
                    key={path}
                    className="relative"
                    draggable={!busy && !usingSharedCover}
                    onDragStart={() => {
                      dragFrom.current = index;
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (usingSharedCover) return;
                      const from = dragFrom.current;
                      dragFrom.current = null;
                      if (from == null || from === index) return;
                      void persist(moveCoverPath(branchPaths, from, index), index);
                    }}
                  >
                    <button
                      type="button"
                      className={`relative block h-14 w-[134px] overflow-hidden rounded-md border bg-muted ${
                        isSelected ? "border-foreground" : "border-border"
                      }`}
                      onClick={() => setSelected(index)}
                    >
                      {thumbUrl ? <img src={thumbUrl} alt="" className="h-full w-full object-cover" /> : null}
                      <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[10px] font-medium text-white">
                        {index + 1}
                      </span>
                    </button>
                    {branchPaths.length > 1 && isSelected ? (
                      <>
                        <button
                          type="button"
                          aria-label={t("synckerjaOrder.profile.coverMoveEarlier", "Move earlier")}
                          className="absolute left-0.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30"
                          disabled={busy || index === 0}
                          onClick={() => void persist(moveCoverPath(branchPaths, index, index - 1), index - 1)}
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={t("synckerjaOrder.profile.coverMoveLater", "Move later")}
                          className="absolute right-0.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30"
                          disabled={busy || index === branchPaths.length - 1}
                          onClick={() => void persist(moveCoverPath(branchPaths, index, index + 1), index + 1)}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : null}
                    {usingSharedCover ? null : (
                    <button
                      type="button"
                      aria-label={t("synckerjaOrder.profile.coverRemoveOne", "Remove this photo")}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-white disabled:opacity-40"
                      disabled={busy}
                      onClick={() =>
                        void persist(
                          branchPaths.filter((_, item) => item !== index),
                          Math.max(0, index - 1),
                        )
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                    )}
                  </div>
                );
              })}
              {atLimit ? null : (
                <button
                  type="button"
                  aria-label={t("synckerjaOrder.profile.coverAdd", "Add a banner photo")}
                  className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
                  disabled={busy || coverLoading || !organizationId || !outletId}
                  onClick={() => fileRef.current?.click()}
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : null}
          {!coverLoading && usingSharedCover ? (
            <p className="text-xs text-muted-foreground">
              {t(
                "synckerjaOrder.profile.coverInherited",
                "This branch is still using the shared banner. Add a photo and this one stays as the first slide.",
              )}
            </p>
          ) : null}
          {branchPaths.length > 0 ? (
            <button
              type="button"
              className="text-xs text-muted-foreground underline disabled:opacity-50"
              disabled={busy}
              onClick={() => void persist([], 0)}
            >
              {t("synckerjaOrder.profile.coverRemove", "Remove banner photos")}
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

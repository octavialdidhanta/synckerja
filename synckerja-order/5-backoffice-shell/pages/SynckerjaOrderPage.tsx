import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Switch } from "@/shared/components/ui/switch";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  SynckerjaOrderActivateLanding,
  SYNCKERJA_ORDER_TERMS_VERSION,
} from "@/synckerja-order/1-activate/SynckerjaOrderActivateLanding";
import { SynckerjaOrderProfilePanel } from "@/synckerja-order/2-business/SynckerjaOrderProfilePanel";
import { SynckerjaOrderContactPanel } from "@/synckerja-order/2-business/SynckerjaOrderContactPanel";
import { SynckerjaOrderTermsPanel } from "@/synckerja-order/2-business/SynckerjaOrderTermsPanel";
import { SynckerjaOrderOutletsPanel } from "@/synckerja-order/2-business/SynckerjaOrderOutletsPanel";
import { SynckerjaOrderOutletSelect } from "@/synckerja-order/2-business/SynckerjaOrderOutletSelect";
import { SynckerjaOrderHoursPanel } from "@/synckerja-order/2-hours/SynckerjaOrderHoursPanel";
import { SynckerjaOrderCatalogPanel } from "@/synckerja-order/3-catalog/SynckerjaOrderCatalogPanel";
import { SynckerjaOrderQrPanel } from "@/synckerja-order/4-qr/SynckerjaOrderQrPanel";
import {
  useSynckerjaOrderOutletWhatsApp,
  type OutletWhatsAppPatch,
} from "@/synckerja-order/6-whatsapp";
import { useSynckerjaOrderOrgSettings } from "../hooks/useSynckerjaOrderOrgSettings";
import { useSynckerjaOrderOutlets } from "../hooks/useSynckerjaOrderOutlets";
import { useSynckerjaOrderHours } from "../hooks/useSynckerjaOrderHours";
import { useSynckerjaOrderOutletCover } from "../hooks/useSynckerjaOrderOutletCover";
import { useSynckerjaOrderCatalog } from "../hooks/useSynckerjaOrderCatalog";
import { useSynckerjaOrderCategoryLayouts } from "../hooks/useSynckerjaOrderCategoryLayouts";
import { useSynckerjaOrderCrossSell } from "../hooks/useSynckerjaOrderCrossSell";
import { useSynckerjaOrderTables } from "../hooks/useSynckerjaOrderTables";
import { SynckerjaOrderModuleShell } from "../layout/SynckerjaOrderModuleShell";
import {
  SYNCKERJA_ORDER_MAIN_GRID,
  SYNCKERJA_ORDER_PANEL_BODY,
  SYNCKERJA_ORDER_TABLE_SECTION,
} from "../layout/synckerjaOrderLayout";
import { SynckerjaOrderPanelFooter } from "../layout/SynckerjaOrderPanelFooter";
import {
  SYNCKERJA_ORDER_PROFILE_PATH,
  synckerjaOrderTabFromPathname,
} from "../lib/synckerjaOrderTabs";
import { defaultWeeklyHours, type WeeklyHourRule } from "@/synckerja-order/shared/lib/orderHours";
import type { CategoryLayout } from "@/synckerja-order/shared/lib/orderCategoryLayout";
import type { SynckerjaOrderOrgSettings } from "@/synckerja-order/shared/lib/orderTypes";

export default function SynckerjaOrderPage() {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const org = useSynckerjaOrderOrgSettings();
  const outlets = useSynckerjaOrderOutlets();
  const tab = synckerjaOrderTabFromPathname(location.pathname);
  const [orderOutletId, setOrderOutletId] = useState<string | null>(null);
  const configurableOutlets = outlets.rows.filter((row) => row.is_active);
  const orderOutlet =
    configurableOutlets.find((row) => row.id === orderOutletId) ?? configurableOutlets[0] ?? null;
  const catalog = useSynckerjaOrderCatalog(orderOutlet?.id ?? null);
  const categoryLayouts = useSynckerjaOrderCategoryLayouts(orderOutlet?.id ?? null);
  const crossSell = useSynckerjaOrderCrossSell();
  const tables = useSynckerjaOrderTables(orderOutlet?.id ?? null);
  const outletWhatsApp = useSynckerjaOrderOutletWhatsApp();

  const [draft, setDraft] = useState<Partial<SynckerjaOrderOrgSettings>>({});
  const [termsChecked, setTermsChecked] = useState(false);
  const [hoursForceClosed, setHoursForceClosed] = useState(false);
  const [hoursWeekly, setHoursWeekly] = useState<WeeklyHourRule[]>(defaultWeeklyHours());
  const [layoutDraft, setLayoutDraft] = useState<Record<string, CategoryLayout>>({});
  const [relatedDraft, setRelatedDraft] = useState<Record<string, string>>({});
  const [hoursHydrated, setHoursHydrated] = useState(false);
  const [catalogHydrated, setCatalogHydrated] = useState(false);

  const settings: SynckerjaOrderOrgSettings = useMemo(
    () => ({ ...org.settings, ...draft }),
    [org.settings, draft],
  );

  const activated = Boolean(org.settings.terms_accepted_at);
  const hours = useSynckerjaOrderHours(orderOutlet?.id ?? null);
  const outletCover = useSynckerjaOrderOutletCover(orderOutlet?.id ?? null);

  useEffect(() => {
    setHoursHydrated(false);
  }, [orderOutlet?.id]);

  useEffect(() => {
    if (!hours.row) return;
    setHoursForceClosed(hours.row.force_closed);
    setHoursWeekly(hours.row.weekly_hours);
    setHoursHydrated(true);
  }, [hours.row]);

  useEffect(() => {
    setLayoutDraft(categoryLayouts.layouts);
    setCatalogHydrated(!categoryLayouts.isLoading && !crossSell.isLoading);
  }, [categoryLayouts.layouts, categoryLayouts.isLoading, crossSell.isLoading]);

  useEffect(() => {
    setRelatedDraft(crossSell.pairings);
  }, [crossSell.pairings]);

  const orgDirty = (Object.keys(draft) as Array<keyof SynckerjaOrderOrgSettings>).some(
    (key) => draft[key] !== org.settings[key],
  );
  const hoursDirty = Boolean(
    hoursHydrated &&
      hours.row &&
      (hoursForceClosed !== hours.row.force_closed ||
        JSON.stringify(hoursWeekly) !== JSON.stringify(hours.row.weekly_hours)),
  );
  const catalogDirty =
    catalogHydrated &&
    (JSON.stringify(layoutDraft) !== JSON.stringify(categoryLayouts.layouts) ||
      JSON.stringify(relatedDraft) !== JSON.stringify(crossSell.pairings));
  const hasUnsavedChanges =
    tab === "hours"
      ? hoursDirty
      : tab === "catalog"
        ? catalogDirty
        : tab === "qr" || tab === "outlets"
          ? false
          : orgDirty;

  const filledContactFields = [
    settings.contact_phone,
    settings.contact_email,
    settings.contact_whatsapp,
    settings.contact_instagram,
  ].filter((value) => Boolean(value?.trim())).length;

  const showContent = useDebouncedReady(
    !(
      orgBootstrapPending ||
      org.isLoading ||
      outlets.isLoading ||
      outletWhatsApp.isLoading
    ),
    200,
  );

  const patch = (next: Partial<SynckerjaOrderOrgSettings>) => {
    setDraft((prev) => ({ ...prev, ...next }));
  };

  const onSave = async () => {
    try {
      if (tab === "hours") {
        if (!orderOutlet?.id) return;
        await hours.save.mutateAsync({ forceClosed: hoursForceClosed, weeklyHours: hoursWeekly });
      } else if (tab === "catalog") {
        const categoryIds = [
          ...new Set(
            catalog.rows
              .map((row) => row.product_category_id)
              .filter((id): id is string => Boolean(id)),
          ),
        ];
        await categoryLayouts.save.mutateAsync(
          categoryIds.map((category_id) => ({
            category_id,
            layout: layoutDraft[category_id] ?? "list",
          })),
        );
        await crossSell.save.mutateAsync(
          categoryIds.map((category_id) => ({
            from_category_id: category_id,
            to_category_id: relatedDraft[category_id] ?? null,
          })),
        );
      } else {
        await org.save.mutateAsync(draft);
        setDraft({});
      }
      toast({ title: t("synckerjaOrder.saved", "Saved") });
    } catch (err) {
      toast({
        title: t("synckerjaOrder.saveError", "Failed to save"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  const saveOutletWhatsApp = async (outletId: string, patch: OutletWhatsAppPatch) => {
    try {
      await outletWhatsApp.save.mutateAsync({ outletId, patch });
      toast({ title: t("synckerjaOrder.whatsapp.saved", "Saved ✓") });
    } catch (err) {
      toast({
        title: t("synckerjaOrder.saveError", "Failed to save"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  const onActivate = async () => {
    try {
      await org.save.mutateAsync({
        ...draft,
        terms_accepted_at: new Date().toISOString(),
        terms_version: SYNCKERJA_ORDER_TERMS_VERSION,
      });
      setDraft({});
      navigate({ pathname: SYNCKERJA_ORDER_PROFILE_PATH, search: location.search });
    } catch (err) {
      toast({
        title: t("synckerjaOrder.saveError", "Failed to save"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  return (
    <SynckerjaOrderModuleShell
      showContent={showContent}
      businessName={settings.business_name}
      onSave={
        activated &&
        hasUnsavedChanges &&
        tab !== "qr" &&
        (tab !== "hours" || Boolean(orderOutlet?.id))
          ? () => void onSave()
          : undefined
      }
      saveBusy={
        org.save.isPending ||
        hours.save.isPending ||
        categoryLayouts.save.isPending ||
        crossSell.save.isPending
      }
    >
      {org.isError || outlets.isError ? (
        <Alert variant="destructive" className="m-4">
          <AlertDescription>
            {t("synckerjaOrder.loadError", "Failed to load Synckerja Order.")}
          </AlertDescription>
        </Alert>
      ) : !activated ? (
        <SynckerjaOrderActivateLanding
          accepted={termsChecked}
          onAcceptedChange={setTermsChecked}
          onActivate={() => void onActivate()}
          busy={org.save.isPending}
        />
      ) : (
        <div className={SYNCKERJA_ORDER_MAIN_GRID}>
          <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch">
            <div className={SYNCKERJA_ORDER_TABLE_SECTION}>
              <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                <div className={tab === "qr" ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" : SYNCKERJA_ORDER_PANEL_BODY}>
                  {tab === "profile" ? (
                    <SynckerjaOrderProfilePanel
                      settings={settings}
                      onChange={patch}
                      outlets={configurableOutlets}
                      outletId={orderOutlet?.id ?? null}
                      onOutletChange={setOrderOutletId}
                      coverPath={outletCover.coverPath}
                      coverLoading={outletCover.isLoading}
                      onCoverChange={(coverPath) => outletCover.save.mutateAsync(coverPath)}
                    />
                  ) : null}
                  {tab === "contact" ? (
                    <SynckerjaOrderContactPanel settings={settings} onChange={patch} />
                  ) : null}
                  {tab === "terms" ? (
                    <SynckerjaOrderTermsPanel settings={settings} onChange={patch} />
                  ) : null}
                  {tab === "outlets" ? (
                    <SynckerjaOrderOutletsPanel
                      rows={outlets.rows}
                      busy={outlets.saveOutlet.isPending}
                      onToggle={(id, enabled) => void outlets.saveOutlet.mutateAsync({ outletId: id, enabled })}
                      whatsapp={{
                        accounts: outletWhatsApp.accounts,
                        settingsFor: outletWhatsApp.settingsFor,
                        onChange: (id, patch) => void saveOutletWhatsApp(id, patch),
                        onSaveMessage: async (id, message) => {
                          await outletWhatsApp.save.mutateAsync({
                            outletId: id,
                            patch: { prefillMessage: message },
                          });
                        },
                        onSaveMapsUrl: async (id, mapsUrl) => {
                          await outletWhatsApp.save.mutateAsync({
                            outletId: id,
                            patch: { mapsUrl },
                          });
                        },
                      }}
                    />
                  ) : null}
                  {tab === "hours" ? (
                    <div className="grid shrink-0 grid-cols-2 items-stretch gap-3 border-b border-border px-3 py-3">
                      <div className="flex min-w-0 items-end rounded-md border border-border px-3 py-2">
                        <SynckerjaOrderOutletSelect
                          className="max-w-none"
                          outlets={configurableOutlets}
                          value={orderOutlet?.id ?? null}
                          onChange={setOrderOutletId}
                        />
                      </div>
                      <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {t("synckerjaOrder.hours.forceClosed", "Temporarily closed")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t(
                              "synckerjaOrder.hours.forceClosedHint",
                              "Guests cannot add items or checkout until you reopen.",
                            )}
                          </p>
                        </div>
                        <Switch
                          checked={hoursForceClosed}
                          onCheckedChange={(value) => setHoursForceClosed(value)}
                        />
                      </div>
                    </div>
                  ) : null}
                  {tab === "hours" ? (
                    <SynckerjaOrderHoursPanel
                      weeklyHours={hoursWeekly}
                      onChange={(hourPatch) => {
                        if (hourPatch.weeklyHours) setHoursWeekly(hourPatch.weeklyHours);
                      }}
                    />
                  ) : null}
                  {tab === "catalog" ? (
                    <SynckerjaOrderCatalogPanel
                      outletSelect={
                        <SynckerjaOrderOutletSelect
                          className="max-w-none"
                          outlets={configurableOutlets}
                          value={orderOutlet?.id ?? null}
                          onChange={setOrderOutletId}
                        />
                      }
                      rows={catalog.rows}
                      layouts={layoutDraft}
                      relatedPairings={relatedDraft}
                      busy={catalog.toggle.isPending || categoryLayouts.save.isPending || crossSell.save.isPending}
                      onLayoutChange={(categoryId, layout) => {
                        setLayoutDraft((prev) => ({ ...prev, [categoryId]: layout }));
                      }}
                      onRelatedChange={(fromCategoryId, toCategoryId) => {
                        setRelatedDraft((prev) => {
                          if (!toCategoryId) {
                            const next = { ...prev };
                            delete next[fromCategoryId];
                            return next;
                          }
                          return { ...prev, [fromCategoryId]: toCategoryId };
                        });
                      }}
                      onToggle={(id, optedIn, kind) =>
                        void catalog.toggle.mutateAsync({ catalogItemId: id, optedIn, kind })
                      }
                    />
                  ) : null}
                  {tab === "qr" ? (
                    <SynckerjaOrderQrPanel
                      outletSelect={
                        <SynckerjaOrderOutletSelect
                          className="max-w-none"
                          outlets={configurableOutlets}
                          value={orderOutlet?.id ?? null}
                          onChange={setOrderOutletId}
                        />
                      }
                      publicCode={orderOutlet?.public_code ?? null}
                      outletId={orderOutlet?.id ?? null}
                      outletName={orderOutlet?.name ?? ""}
                      tables={tables.data ?? []}
                      orgSettings={settings}
                    />
                  ) : null}
                </div>
                <SynckerjaOrderPanelFooter tab={tab} filledContactFields={filledContactFields} />
              </div>
            </div>
          </div>
        </div>
      )}
    </SynckerjaOrderModuleShell>
  );
}

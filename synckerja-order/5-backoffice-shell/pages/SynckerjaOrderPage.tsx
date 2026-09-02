import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useToast } from "@/shared/components/ui/use-toast";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useSelectedPosOutlet } from "@/8-2-2-outlets/hooks/useSelectedPosOutlet";
import {
  SynckerjaOrderActivateLanding,
  SYNCKERJA_ORDER_TERMS_VERSION,
} from "@/synckerja-order/1-activate/SynckerjaOrderActivateLanding";
import { SynckerjaOrderProfilePanel } from "@/synckerja-order/2-business/SynckerjaOrderProfilePanel";
import { SynckerjaOrderContactPanel } from "@/synckerja-order/2-business/SynckerjaOrderContactPanel";
import { SynckerjaOrderTermsPanel } from "@/synckerja-order/2-business/SynckerjaOrderTermsPanel";
import { SynckerjaOrderOutletsPanel } from "@/synckerja-order/2-business/SynckerjaOrderOutletsPanel";
import { SynckerjaOrderHoursPanel } from "@/synckerja-order/2-hours/SynckerjaOrderHoursPanel";
import { SynckerjaOrderCatalogPanel } from "@/synckerja-order/3-catalog/SynckerjaOrderCatalogPanel";
import { SynckerjaOrderQrPanel } from "@/synckerja-order/4-qr/SynckerjaOrderQrPanel";
import { useSynckerjaOrderOrgSettings } from "../hooks/useSynckerjaOrderOrgSettings";
import { useSynckerjaOrderOutlets } from "../hooks/useSynckerjaOrderOutlets";
import { useSynckerjaOrderHours } from "../hooks/useSynckerjaOrderHours";
import { useSynckerjaOrderCatalog } from "../hooks/useSynckerjaOrderCatalog";
import { useSynckerjaOrderCategoryLayouts } from "../hooks/useSynckerjaOrderCategoryLayouts";
import { useSynckerjaOrderCrossSell } from "../hooks/useSynckerjaOrderCrossSell";
import { useSynckerjaOrderTables } from "../hooks/useSynckerjaOrderTables";
import { SynckerjaOrderModuleShell } from "../layout/SynckerjaOrderModuleShell";
import {
  SYNCKERJA_ORDER_PROFILE_PATH,
  synckerjaOrderTabFromPathname,
} from "../lib/synckerjaOrderTabs";
import { buildOrderStoreUrl } from "@/synckerja-order/shared/lib/orderUrls";
import { defaultWeeklyHours, type WeeklyHourRule } from "@/synckerja-order/shared/lib/orderHours";
import type { CategoryLayout } from "@/synckerja-order/shared/lib/orderCategoryLayout";
import type { SynckerjaOrderOrgSettings } from "@/synckerja-order/shared/lib/orderTypes";

export default function SynckerjaOrderPage() {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const { selectedOutletId, isLoading: outletsLoading } = useSelectedPosOutlet(true);
  const org = useSynckerjaOrderOrgSettings();
  const outlets = useSynckerjaOrderOutlets();
  const tab = synckerjaOrderTabFromPathname(location.pathname);
  const catalog = useSynckerjaOrderCatalog(selectedOutletId || null);
  const categoryLayouts = useSynckerjaOrderCategoryLayouts(selectedOutletId || null);
  const crossSell = useSynckerjaOrderCrossSell();
  const tables = useSynckerjaOrderTables(selectedOutletId || null);

  const [draft, setDraft] = useState<Partial<SynckerjaOrderOrgSettings>>({});
  const [termsChecked, setTermsChecked] = useState(false);
  const [hoursOutletId, setHoursOutletId] = useState<string | null>(null);
  const [hoursForceClosed, setHoursForceClosed] = useState(false);
  const [hoursWeekly, setHoursWeekly] = useState<WeeklyHourRule[]>(defaultWeeklyHours());
  const [layoutDraft, setLayoutDraft] = useState<Record<string, CategoryLayout>>({});
  const [relatedDraft, setRelatedDraft] = useState<Record<string, string>>({});

  const settings: SynckerjaOrderOrgSettings = useMemo(
    () => ({ ...org.settings, ...draft }),
    [org.settings, draft],
  );

  const activated = Boolean(org.settings.terms_accepted_at);
  const selectedOutlet = outlets.rows.find((r) => r.id === selectedOutletId) ?? outlets.rows[0];
  const hoursOutlet =
    outlets.rows.find((r) => r.id === hoursOutletId && r.enabled) ??
    outlets.rows.find((r) => r.enabled) ??
    null;
  const hours = useSynckerjaOrderHours(hoursOutlet?.id ?? null);

  useEffect(() => {
    if (!hoursOutletId && hoursOutlet?.id) setHoursOutletId(hoursOutlet.id);
  }, [hoursOutlet?.id, hoursOutletId]);

  useEffect(() => {
    if (!hours.row) return;
    setHoursForceClosed(hours.row.force_closed);
    setHoursWeekly(hours.row.weekly_hours);
  }, [hours.row]);

  useEffect(() => {
    setLayoutDraft(categoryLayouts.layouts);
  }, [categoryLayouts.layouts]);

  useEffect(() => {
    setRelatedDraft(crossSell.pairings);
  }, [crossSell.pairings]);
  const storeUrl = selectedOutlet?.public_code
    ? buildOrderStoreUrl(selectedOutlet.public_code)
    : null;

  const showContent = useDebouncedReady(
    !(
      orgBootstrapPending ||
      outletsLoading ||
      org.isLoading ||
      outlets.isLoading
    ),
    200,
  );

  const patch = (next: Partial<SynckerjaOrderOrgSettings>) => {
    setDraft((prev) => ({ ...prev, ...next }));
  };

  const onSave = async () => {
    try {
      if (tab === "hours") {
        if (!hoursOutlet?.id) return;
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

  const onViewStore = () => {
    if (!storeUrl) return;
    window.open(storeUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <SynckerjaOrderModuleShell
      showContent={showContent}
      businessName={settings.business_name}
      storeUrl={activated ? storeUrl : null}
      onSave={
        activated && (tab !== "hours" || Boolean(hoursOutlet?.id))
          ? () => void onSave()
          : undefined
      }
      saveBusy={
        org.save.isPending ||
        hours.save.isPending ||
        categoryLayouts.save.isPending ||
        crossSell.save.isPending
      }
      onViewStore={activated && storeUrl ? onViewStore : undefined}
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
        <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
          <div className="col-span-12 flex min-h-[560px] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            {tab === "profile" ? (
              <SynckerjaOrderProfilePanel settings={settings} onChange={patch} />
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
                onCodeChange={(id, code) => {
                  if (code.length === 6) {
                    void outlets.saveOutlet.mutateAsync({ outletId: id, publicCode: code });
                  }
                }}
              />
            ) : null}
            {tab === "hours" ? (
              <SynckerjaOrderHoursPanel
                outlets={outlets.rows}
                selectedOutletId={hoursOutlet?.id ?? null}
                onSelectOutlet={setHoursOutletId}
                forceClosed={hoursForceClosed}
                weeklyHours={hoursWeekly}
                onChange={(patch) => {
                  if (patch.forceClosed !== undefined) setHoursForceClosed(patch.forceClosed);
                  if (patch.weeklyHours) setHoursWeekly(patch.weeklyHours);
                }}
              />
            ) : null}
            {tab === "catalog" ? (
              <SynckerjaOrderCatalogPanel
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
                publicCode={selectedOutlet?.public_code ?? null}
                tables={tables.data ?? []}
              />
            ) : null}
          </div>
        </div>
      )}
      <div
        className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
        aria-hidden
      />
    </SynckerjaOrderModuleShell>
  );
}

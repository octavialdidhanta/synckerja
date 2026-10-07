import { useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ImageIcon, Loader2, Minus } from "lucide-react";
import { toast } from "sonner";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { MetaAdsAdsetAudienceSheet } from "@/6-0-meta-ads/components/MetaAdsAdsetAudienceSheet";
import { MetaAdsCreativePreviewSheet } from "@/6-0-meta-ads/components/MetaAdsCreativePreviewSheet";
import { MetaAdsDeliveryBadge } from "@/6-0-meta-ads/components/MetaAdsDeliveryBadge";
import {
  MetaAdsRunningDaysBadge,
  MetaAdsRunningDaysInfo,
} from "@/6-0-meta-ads/components/MetaAdsRunningDaysBadge";
import { Switch } from "@/shared/components/ui/switch";
import { useSetMetaAdStatus } from "@/meta-ads/hooks/useSetMetaAdStatus";
import { metaAdIsOn, metaAdStatusLocked } from "@/meta-ads/metrics/metaAdStatus";
import type { MetaAdCreativePreview } from "@/meta-ads/hooks/useMetaAdsAdCreatives";
import { useMetaAdsAdCreatives } from "@/meta-ads/hooks/useMetaAdsAdCreatives";
import type { MetaAdsMetricEntity } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import type { MetaAdsMetricsRow } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import { formatMetaBudgetCell, formatMetaMetricValue } from "@/meta-ads/metrics/formatMetaMetricValue";
import {
  metaAdsExtremeBounds,
  metaAdsExtremeCellStyle,
} from "@/meta-ads/metrics/metaAdsExtremeHighlights";
import { metaAdRunningDays } from "@/meta-ads/metrics/metaAdRunningDays";
import {
  getMetaAdsLockedTableColumns,
  isMetaAdsPinnedMetricKey,
  type MetaAdsMetricCatalogItem,
} from "@/meta-ads/metrics/metaAdsMetricCatalog";
import {
  metaAdsRowDisplayName,
  metaAdsRowReactKey,
  metaAdsRowSecondaryName,
} from "@/meta-ads/metrics/metaAdsRowIdentity";

export const metaAdsMetricsTableScrollClass = cn(
  "nested-scroll-touch-chain seamless-scroll scrollbar-hide min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto",
  "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
);

const thBase =
  "h-10 whitespace-nowrap bg-gray-50 px-3 text-left align-middle text-sm font-medium text-muted-foreground";

type ServiceOption = { id: string; name: string };

type IdentityCol = {
  key: string;
  label: string;
  headerTitle?: string;
  cellClassName?: string;
  render: (row: MetaAdsMetricsRow) => ReactNode;
};

const ADSET_AD_NAME_CELL_CLASS =
  "min-w-[9rem] max-w-[220px] min-w-0 overflow-hidden font-medium";

function renderTruncatedEntityName(
  row: MetaAdsMetricsRow,
  entity: MetaAdsMetricEntity,
  onOpenAudience?: (row: MetaAdsMetricsRow) => void,
) {
  const text = metaAdsRowDisplayName(row, entity);
  if (entity === "adset" && onOpenAudience && text !== "—") {
    return (
      <button
        type="button"
        className="block w-full truncate text-left hover:text-primary hover:underline"
        title={text}
        onClick={() => onOpenAudience(row)}
      >
        {text}
      </button>
    );
  }
  return (
    <span className="block truncate" title={text && text !== "—" ? text : undefined}>
      {text}
    </span>
  );
}

function renderTruncatedSecondaryName(row: MetaAdsMetricsRow, entity: MetaAdsMetricEntity) {
  const text = metaAdsRowSecondaryName(row, entity) ?? "—";
  return (
    <span className="block truncate" title={text !== "—" ? text : undefined}>
      {text}
    </span>
  );
}

function formatServiceCpa(value: unknown, currencyCode: string | null | undefined): string {
  return formatMetaMetricValue("spend", value, currencyCode);
}

type IdentityOpts = {
  canEditServiceMapping: boolean;
  services: ServiceOption[];
  onServiceMappingChange?: (row: MetaAdsMetricsRow, serviceId: string | null) => void;
  serviceMappingPending: boolean;
  currencyCode: string | null;
  creativesByAdId: Map<string, MetaAdCreativePreview>;
  creativesLoading: boolean;
  onOpenCreative: (row: MetaAdsMetricsRow) => void;
  onOpenAudience?: (row: MetaAdsMetricsRow) => void;
  onSetAdStatus?: (row: MetaAdsMetricsRow, status: "ACTIVE" | "PAUSED") => void;
  adStatusPendingId?: string | null;
};

function renderAdNameWithThumbnail(
  row: MetaAdsMetricsRow,
  t: (key: string, defaultValue?: string) => string,
  opts: IdentityOpts,
) {
  const label = metaAdsRowDisplayName(row, "ad");
  const adId = String((row as Record<string, unknown>).ad_id ?? "").trim();
  const creative = adId ? opts.creativesByAdId.get(adId) : undefined;
  const thumb = creative?.thumbnail_url || creative?.image_url || null;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <button
        type="button"
        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted"
        onClick={() => opts.onOpenCreative(row)}
        aria-label={t("digitalMarketing.metaAds.openCreativePreview", "Open ad creative")}
      >
        {thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : opts.creativesLoading ? (
          <span className="block h-full w-full animate-pulse bg-muted-foreground/15" />
        ) : (
          <ImageIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
        )}
      </button>
      <span className="min-w-0 flex-1 truncate" title={label !== "—" ? label : undefined}>
        {label}
      </span>
    </div>
  );
}

function identityColumnByKey(
  entity: MetaAdsMetricEntity,
  t: (key: string, defaultValue?: string) => string,
  opts: IdentityOpts,
): Record<string, IdentityCol> {
  const cpaTip = t(
    "digitalMarketing.metaAds.serviceAggregateTip",
    "CPA per campaign: spent campaign ini dibagi lead Converted yang UTM campaign-nya cocok dengan nama campaign Meta (wajib fbclid; converted_at dalam rentang tanggal). CPL untuk lead yang belum converted.",
  );

  return {
    service: {
      key: "service",
      label: t("digitalMarketing.metaAds.columnService", "Service/products"),
      cellClassName: "min-w-[9rem] max-w-[200px]",
      render: (row) => {
        const r = row as Record<string, unknown>;
        const displayName = String(r.service_name ?? "").trim();
        if (!opts.canEditServiceMapping) {
          return displayName || "—";
        }
        const currentId = String(r.service_id ?? "").trim();
        return (
          <Select
            value={currentId || "__none__"}
            disabled={opts.serviceMappingPending}
            onValueChange={(value) => {
              const next = value === "__none__" ? null : value;
              opts.onServiceMappingChange?.(row, next);
            }}
          >
            <SelectTrigger className="h-8 w-full max-w-[200px] text-xs">
              <SelectValue placeholder={t("digitalMarketing.metaAds.selectService", "Pilih service")}>
                {currentId ? displayName || currentId : "—"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {opts.services.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
    },
    service_cpl: {
      key: "service_cpl",
      label: t("digitalMarketing.metaAds.columnCostPerLead", "CPA"),
      headerTitle: cpaTip,
      cellClassName: "whitespace-nowrap text-right tabular-nums text-sm",
      render: (row) => {
        const r = row as Record<string, unknown>;
        const text = formatServiceCpa(r.service_cpl, opts.currencyCode);
        const converted = r.service_converted_leads;
        const convertedLabel =
          converted != null && Number.isFinite(Number(converted))
            ? String(Number(converted))
            : "0";
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help tabular-nums">{text}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              <p>{cpaTip}</p>
              <p className="mt-1 text-muted-foreground">
                {t("digitalMarketing.metaAds.convertedLeadsCount", "Lead converted")}: {convertedLabel}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    service_converted_leads: {
      key: "service_converted_leads",
      label: t("digitalMarketing.metaAds.columnConvertedLeads", "Conv. leads"),
      headerTitle: cpaTip,
      cellClassName: "whitespace-nowrap text-right tabular-nums text-sm",
      render: (row) => {
        const r = row as Record<string, unknown>;
        const n = r.service_converted_leads;
        if (n == null || !Number.isFinite(Number(n))) return "—";
        return String(Number(n));
      },
    },
    name: {
      key: "name",
      label: t("digitalMarketing.metaAds.name", entity === "campaign" ? "Campaign" : "Name"),
      cellClassName:
        entity === "campaign"
          ? "min-w-[10rem] max-w-[280px] font-medium"
          : entity === "ad"
            ? "min-w-[12rem] max-w-[280px] min-w-0 overflow-hidden font-medium"
            : ADSET_AD_NAME_CELL_CLASS,
      render: (row) =>
        entity === "campaign"
          ? metaAdsRowDisplayName(row, "campaign")
          : entity === "ad"
            ? renderAdNameWithThumbnail(row, t, opts)
            : renderTruncatedEntityName(row, entity, opts.onOpenAudience),
    },
    running_days: {
      key: "running_days",
      label: t("digitalMarketing.metaAds.runningDays", "Days"),
      cellClassName: "whitespace-nowrap text-center tabular-nums text-sm",
      render: (row) => {
        const record = row as Record<string, unknown>;
        const days = metaAdRunningDays(record.created_time);
        if (days == null) return "—";
        return <MetaAdsRunningDaysBadge days={days} ctr={record.ctr} />;
      },
    },
    ad_toggle: {
      key: "ad_toggle",
      label: t("digitalMarketing.metaAds.adToggle", "On"),
      headerTitle: t("digitalMarketing.metaAds.adToggleOff", "Turn this ad off"),
      cellClassName: "whitespace-nowrap text-center",
      render: (row) => {
        const record = row as Record<string, unknown>;
        const adId = String(record.ad_id ?? "").trim();
        const on = metaAdIsOn(record);
        const pending = opts.adStatusPendingId === adId;
        return (
          <Switch
            checked={on}
            disabled={!adId || pending || metaAdStatusLocked(record) || !opts.onSetAdStatus}
            aria-label={
              on
                ? t("digitalMarketing.metaAds.adToggleOff", "Turn this ad off")
                : t("digitalMarketing.metaAds.adToggleOn", "Turn this ad on")
            }
            onCheckedChange={(checked) => {
              opts.onSetAdStatus?.(row, checked ? "ACTIVE" : "PAUSED");
            }}
          />
        );
      },
    },
    spend: {
      key: "spend",
      label: t("digitalMarketing.metaAds.cost", "Cost"),
      cellClassName: "whitespace-nowrap text-right tabular-nums text-sm",
      render: (row) =>
        formatMetaMetricValue("spend", (row as Record<string, unknown>).spend, opts.currencyCode),
    },
    campaign_name: {
      key: "campaign_name",
      label: t("digitalMarketing.metaAds.campaignColumn", "Campaign"),
      cellClassName: "min-w-[6.5rem] max-w-[240px] min-w-0 overflow-hidden",
      render: (row) => renderTruncatedSecondaryName(row, "adset"),
    },
    adset_name: {
      key: "adset_name",
      label: t("digitalMarketing.metaAds.adsetColumn", "Ad set"),
      cellClassName: "min-w-[6.5rem] max-w-[240px] min-w-0 overflow-hidden",
      render: (row) => renderTruncatedSecondaryName(row, "ad"),
    },
  };
}

function lockedIdentityColumns(
  entity: MetaAdsMetricEntity,
  t: (key: string, defaultValue?: string) => string,
  opts: IdentityOpts,
): IdentityCol[] {
  const byKey = identityColumnByKey(entity, t, opts);
  return getMetaAdsLockedTableColumns(entity).flatMap((def) => {
    const col = byKey[def.key];
    if (!col) return [];
    return [{ ...col, label: t(def.labelKey, def.defaultLabel) }];
  });
}

export type MetaAdsTableSelection = {
  selectedIds: readonly string[];
  onChange: (ids: string[]) => void;
};

type Props = {
  entity: MetaAdsMetricEntity;
  rows: MetaAdsMetricsRow[];
  metricItems: MetaAdsMetricCatalogItem[];
  currencyCode: string | null;
  isLoading?: boolean;
  emptyMessage?: string;
  canEditServiceMapping?: boolean;
  organizationId?: string | null;
  adAccountId?: string | null;
  services?: ServiceOption[];
  onServiceMappingChange?: (row: MetaAdsMetricsRow, serviceId: string | null) => void;
  serviceMappingPending?: boolean;
  campaignIdsWithBudget?: ReadonlySet<string>;
  selection?: MetaAdsTableSelection;
};

function selectionRowId(row: MetaAdsMetricsRow, entity: MetaAdsMetricEntity): string {
  const record = row as Record<string, unknown>;
  if (entity === "campaign") return String(record.campaign_id ?? "").trim();
  if (entity === "adset") return String(record.adset_id ?? "").trim();
  if (entity === "ad") return String(record.ad_id ?? "").trim();
  return "";
}

function MetaAdsManagerCheckbox({
  checked,
  label,
  disabled,
  onToggle,
}: {
  checked: boolean | "indeterminate";
  label: string;
  disabled?: boolean;
  onToggle: (shiftKey: boolean) => void;
}) {
  const filled = checked === true || checked === "indeterminate";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked === "indeterminate" ? "mixed" : checked}
      aria-label={label}
      disabled={disabled}
      className="inline-flex h-10 w-12 items-center justify-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0064e0] disabled:cursor-not-allowed disabled:opacity-40"
      onMouseDown={(event) => {
        if (event.shiftKey) event.preventDefault();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!disabled) onToggle(event.shiftKey);
      }}
    >
      <span
        aria-hidden
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-[2px] border",
          filled
            ? "border-[#0064e0] bg-[#0064e0] text-white"
            : "border-[#8d949e] bg-[#ffffff]",
        )}
      >
        {checked === "indeterminate" ? (
          <Minus className="h-3 w-3" strokeWidth={3} />
        ) : checked ? (
          <Check className="h-3 w-3" strokeWidth={3} />
        ) : null}
      </span>
    </button>
  );
}

export function MetaAdsMetricsTable({
  entity,
  rows,
  metricItems,
  currencyCode,
  isLoading,
  emptyMessage,
  canEditServiceMapping = false,
  organizationId = null,
  adAccountId = null,
  services = [],
  onServiceMappingChange,
  serviceMappingPending = false,
  campaignIdsWithBudget,
  selection,
}: Props) {
  const { t } = useAppTranslation();
  const selectionAnchorRef = useRef<string | null>(null);
  const [previewRow, setPreviewRow] = useState<MetaAdsMetricsRow | null>(null);
  const [audienceRow, setAudienceRow] = useState<MetaAdsMetricsRow | null>(null);
  const adIds = useMemo(
    () =>
      entity === "ad"
        ? rows
            .map((row) => String((row as Record<string, unknown>).ad_id ?? "").trim())
            .filter((id) => /^\d+$/.test(id))
        : [],
    [entity, rows],
  );
  const adStatus = useSetMetaAdStatus();
  const creativesQuery = useMetaAdsAdCreatives({
    enabled: entity === "ad",
    organizationId,
    adAccountId,
    adIds,
  });

  const identityCols = lockedIdentityColumns(entity, t, {
    canEditServiceMapping,
    services,
    onServiceMappingChange,
    serviceMappingPending,
    currencyCode,
    creativesByAdId: creativesQuery.data ?? new Map(),
    creativesLoading: creativesQuery.isLoading || creativesQuery.isFetching,
    onOpenCreative: setPreviewRow,
    onOpenAudience: entity === "adset" ? setAudienceRow : undefined,
    adStatusPendingId: adStatus.isPending ? adStatus.variables?.adId ?? null : null,
    onSetAdStatus:
      entity === "ad" && organizationId && adAccountId
        ? (row, status) => {
            const adId = String((row as Record<string, unknown>).ad_id ?? "").trim();
            if (!adId) return;
            adStatus.mutate(
              { organizationId, adAccountId, adId, status },
              {
                onError: (error) => {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : t("digitalMarketing.metaAds.adToggleFailed", "Could not update the ad."),
                  );
                },
              },
            );
          }
        : undefined,
  });
  const previewAdId = previewRow
    ? String((previewRow as Record<string, unknown>).ad_id ?? "").trim()
    : "";
  const audienceAdsetId = audienceRow
    ? String((audienceRow as Record<string, unknown>).adset_id ?? "").trim()
    : "";
  const deliveryMetric =
    entity === "ad"
      ? (metricItems.find((item) => item.key === "delivery") ?? {
          key: "delivery",
          labelKey: "digitalMarketing.metaAds.delivery",
          defaultLabel: "Delivery",
        })
      : undefined;
  const visibleMetricItems = metricItems.filter(
    (item) => !isMetaAdsPinnedMetricKey(item.key) && !(entity === "ad" && item.key === "delivery"),
  );
  const identityBeforeDelivery = deliveryMetric
    ? identityCols.slice(0, identityCols.findIndex((col) => col.key === "ad_toggle") + 1)
    : identityCols;
  const identityAfterDelivery = deliveryMetric
    ? identityCols.slice(identityCols.findIndex((col) => col.key === "ad_toggle") + 1)
    : [];

  const extremeBounds = useMemo(() => metaAdsExtremeBounds(rows), [rows]);
  const selectable =
    Boolean(selection) && (entity === "campaign" || entity === "adset" || entity === "ad");
  const selectedSet = useMemo(
    () => new Set(selection?.selectedIds ?? []),
    [selection?.selectedIds],
  );
  const visibleIds = useMemo(
    () => (selectable ? rows.map((row) => selectionRowId(row, entity)).filter(Boolean) : []),
    [selectable, rows, entity],
  );
  const selectedVisibleCount = visibleIds.filter((id) => selectedSet.has(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const headerChecked: boolean | "indeterminate" = allVisibleSelected
    ? true
    : selectedVisibleCount > 0
      ? "indeterminate"
      : false;

  const toggleVisibleAll = (checked: boolean) => {
    if (!selection) return;
    const next = new Set(selectedSet);
    for (const id of visibleIds) {
      if (checked) next.add(id);
      else next.delete(id);
    }
    selectionAnchorRef.current = null;
    selection.onChange([...next]);
  };

  const toggleRow = (id: string, shiftKey: boolean) => {
    if (!selection || !id) return;
    const next = new Set(selectedSet);
    const anchor = selectionAnchorRef.current;
    if (shiftKey && anchor) {
      const start = visibleIds.indexOf(anchor);
      const end = visibleIds.indexOf(id);
      if (start >= 0 && end >= 0) {
        const [lo, hi] = start < end ? [start, end] : [end, start];
        for (const rangeId of visibleIds.slice(lo, hi + 1)) next.add(rangeId);
        selectionAnchorRef.current = id;
        selection.onChange([...next]);
        return;
      }
    }
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectionAnchorRef.current = id;
    selection.onChange([...next]);
  };

  const colSpan =
    (selectable ? 1 : 0) +
    identityCols.length +
    (deliveryMetric ? 1 : 0) +
    visibleMetricItems.length;
  const metricColClass = "min-w-[5.5rem] whitespace-nowrap px-3 text-right";

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full min-h-0 min-w-0 flex-col">
        <div className={metaAdsMetricsTableScrollClass}>
          <table className="w-max min-w-full caption-bottom border-collapse text-sm">
            <thead className="sticky top-0 z-20 bg-gray-50 shadow-sm">
              <tr className="border-b border-border hover:bg-transparent">
                {selectable ? (
                  <th className={cn(thBase, "sticky left-0 z-30 w-12 min-w-12 px-0 text-center")}>
                    <MetaAdsManagerCheckbox
                      checked={headerChecked}
                      disabled={visibleIds.length === 0}
                      label={t("digitalMarketing.metaAds.selectAllRows", "Select all")}
                      onToggle={() => toggleVisibleAll(!allVisibleSelected)}
                    />
                  </th>
                ) : null}
                {identityBeforeDelivery.map((h) => (
                  <th
                    key={h.key}
                    className={cn(thBase, h.cellClassName)}
                    title={h.key === "running_days" ? undefined : h.headerTitle}
                  >
                    <span className="inline-flex items-center gap-1">
                      {h.label}
                      {h.key === "running_days" ? <MetaAdsRunningDaysInfo /> : null}
                    </span>
                  </th>
                ))}
                {deliveryMetric ? (
                  <th className={cn(thBase, "text-left")}>
                    {t(deliveryMetric.labelKey, deliveryMetric.defaultLabel)}
                  </th>
                ) : null}
                {identityAfterDelivery.map((h) => (
                  <th
                    key={h.key}
                    className={cn(thBase, h.cellClassName)}
                    title={h.headerTitle}
                  >
                    {h.label}
                  </th>
                ))}
                {visibleMetricItems.map((m) => (
                  <th key={m.key} className={cn(thBase, metricColClass, "text-right")}>
                    {t(m.labelKey, m.defaultLabel)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={colSpan} className="py-16 text-center">
                    <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("digitalMarketing.metaAds.tableLoading", "Loading metrics…")}
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="py-16 text-center text-sm text-muted-foreground">
                    {emptyMessage ?? t("digitalMarketing.metaAds.noData", "No data for this period")}
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => {
                  const r = row as Record<string, unknown>;
                  const rowSelectionId = selectable ? selectionRowId(row, entity) : "";
                  const rowSelected = Boolean(rowSelectionId) && selectedSet.has(rowSelectionId);
                  return (
                    <tr
                      key={metaAdsRowReactKey(row, entity, i)}
                      className={cn(
                        "group border-b border-border transition-colors",
                        rowSelected ? "bg-[#e7f3ff] hover:bg-[#dcebfe]" : "hover:bg-[#f5f6f7]",
                      )}
                    >
                      {selectable ? (
                        <td
                          className={cn(
                            "sticky left-0 z-10 w-12 min-w-12 bg-clip-padding p-0 align-middle",
                            rowSelected
                              ? "bg-[#e7f3ff] group-hover:bg-[#dcebfe]"
                              : "bg-[#ffffff] group-hover:bg-[#f5f6f7]",
                          )}
                        >
                          <MetaAdsManagerCheckbox
                            checked={rowSelected}
                            disabled={!rowSelectionId}
                            label={t("digitalMarketing.metaAds.selectRow", "Select {{name}}", {
                              name: metaAdsRowDisplayName(row, entity),
                            })}
                            onToggle={(shiftKey) => toggleRow(rowSelectionId, shiftKey)}
                          />
                        </td>
                      ) : null}
                      {identityBeforeDelivery.map((col) => (
                        <td
                          key={col.key}
                          className={cn("p-2 align-middle", col.cellClassName)}
                        >
                          {col.render(row)}
                        </td>
                      ))}
                      {deliveryMetric ? (
                        <td className="p-2 align-middle">
                          <MetaAdsDeliveryBadge value={r.delivery} />
                        </td>
                      ) : null}
                      {identityAfterDelivery.map((col) => (
                        <td
                          key={col.key}
                          className={cn("p-2 align-middle", col.cellClassName)}
                        >
                          {col.render(row)}
                        </td>
                      ))}
                      {visibleMetricItems.map((m) => (
                        <td
                          key={m.key}
                          className={cn("p-2 align-middle tabular-nums", metricColClass)}
                          style={metaAdsExtremeCellStyle(m.key, r[m.key], extremeBounds) ?? undefined}
                        >
                          {m.key === "delivery" ? (
                            <MetaAdsDeliveryBadge value={r[m.key]} />
                          ) : m.key === "budget"
                              ? formatMetaBudgetCell({
                                  budget: r.budget,
                                  usesCampaignBudget:
                                    r.budget_uses_campaign === true ||
                                    ((entity === "adset" || entity === "ad") &&
                                      campaignIdsWithBudget?.has(String(r.campaign_id ?? "").trim()) ===
                                        true),
                                  currencyCode,
                                  usesCampaignLabel: t(
                                    "digitalMarketing.metaAds.budgetUsesCampaign",
                                    "Using campaign budget",
                                  ),
                                })
                              : formatMetaMetricValue(m.key, r[m.key], currencyCode, {
                                  ctrSource: m.key === "ctr" ? "api" : undefined,
                                })}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {entity === "ad" ? (
          <MetaAdsCreativePreviewSheet
            open={previewRow != null}
            onOpenChange={(open) => {
              if (!open) setPreviewRow(null);
            }}
            name={previewRow ? metaAdsRowDisplayName(previewRow, "ad") : ""}
            adId={previewAdId}
            adsetId={
              previewRow
                ? String((previewRow as Record<string, unknown>).adset_id ?? "").trim()
                : null
            }
            organizationId={organizationId}
            adAccountId={adAccountId}
            creative={previewAdId ? creativesQuery.data?.get(previewAdId) ?? null : null}
            loading={creativesQuery.isLoading || creativesQuery.isFetching}
            errorMessage={
              creativesQuery.isError ? (creativesQuery.error as Error).message : null
            }
          />
        ) : null}
        {entity === "adset" ? (
          <MetaAdsAdsetAudienceSheet
            open={audienceRow != null}
            onOpenChange={(open) => {
              if (!open) setAudienceRow(null);
            }}
            name={audienceRow ? metaAdsRowDisplayName(audienceRow, "adset") : ""}
            adsetId={audienceAdsetId}
            organizationId={organizationId}
            adAccountId={adAccountId}
          />
        ) : null}
      </div>
    </TooltipProvider>
  );
}

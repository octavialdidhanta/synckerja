import { useEffect, useMemo, useRef, useState } from "react";
import {
  useMetaAdsMetricsQuery,
  type MetaAdsAccountSummary,
  type MetaAdsMetricEntity,
  type MetaAdsMetricsRow,
} from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import {
  filterMetaAdsRowsByParent,
  metaAdsActiveAdsetOptions,
  metaAdsCampaignOptions,
  summarizeMetaAdsFilteredRows,
  summaryFromMetaAdsRow,
  applyParentReach,
} from "@/meta-ads/metrics/metaAdsParentFilters";

type Args = {
  organizationId: string | null | undefined;
  adAccountId: string;
  entity: MetaAdsMetricEntity;
  dateStart: string;
  dateEnd: string;
  enabled: boolean;
  rows: MetaAdsMetricsRow[];
  rowsLoading: boolean;
  summary: MetaAdsAccountSummary | null | undefined;
};

export function useMetaAdsParentScope({
  organizationId,
  adAccountId,
  entity,
  dateStart,
  dateEnd,
  enabled,
  rows,
  rowsLoading,
  summary,
}: Args) {
  const [campaignFilterId, setCampaignFilterId] = useState<string | null>(null);
  const [adsetFilterId, setAdsetFilterId] = useState<string | null>(null);

  const adsetCatalogQuery = useMetaAdsMetricsQuery({
    organizationId,
    adAccountId,
    entity: "adset",
    dateStart,
    dateEnd,
    enabled: enabled && entity === "ad",
  });

  const campaignMetricsQuery = useMetaAdsMetricsQuery({
    organizationId,
    adAccountId,
    entity: "campaign",
    dateStart,
    dateEnd,
    enabled: enabled && (entity === "adset" || entity === "ad"),
  });

  useEffect(() => {
    setCampaignFilterId(null);
    setAdsetFilterId(null);
  }, [adAccountId]);

  const catalogRows = entity === "ad" ? (adsetCatalogQuery.data?.rows ?? []) : rows;
  const catalogReady =
    entity === "adset" ? !rowsLoading : entity === "ad" ? adsetCatalogQuery.isSuccess : false;

  const loadedCampaignOptions = useMemo(() => metaAdsCampaignOptions(catalogRows), [catalogRows]);
  const campaignNamesRef = useRef(new Map<string, string>());
  useEffect(() => {
    for (const option of loadedCampaignOptions) {
      campaignNamesRef.current.set(option.id, option.name);
    }
  }, [loadedCampaignOptions]);
  const campaignOptions = useMemo(() => {
    if (!campaignFilterId || loadedCampaignOptions.some((option) => option.id === campaignFilterId)) {
      return loadedCampaignOptions;
    }
    return [
      {
        id: campaignFilterId,
        name: campaignNamesRef.current.get(campaignFilterId) ?? campaignFilterId,
      },
      ...loadedCampaignOptions,
    ];
  }, [loadedCampaignOptions, campaignFilterId]);
  const adsetOptions = useMemo(
    () => metaAdsActiveAdsetOptions(catalogRows, campaignFilterId),
    [catalogRows, campaignFilterId],
  );

  useEffect(() => {
    if (!campaignFilterId || !catalogReady) return;
    if (!loadedCampaignOptions.some((option) => option.id === campaignFilterId)) {
      setCampaignFilterId(null);
    }
  }, [campaignFilterId, loadedCampaignOptions, catalogReady]);

  useEffect(() => {
    if (!adsetFilterId) return;
    if (!campaignFilterId) {
      setAdsetFilterId(null);
      return;
    }
    if (entity === "ad" && !adsetCatalogQuery.isSuccess) return;
    if (!adsetOptions.some((option) => option.id === adsetFilterId)) {
      setAdsetFilterId(null);
    }
  }, [adsetFilterId, adsetOptions, campaignFilterId, entity, adsetCatalogQuery.isSuccess]);

  const adsScopeReady = entity !== "ad" || adsetCatalogQuery.isSuccess;
  const parentFilterActive = Boolean(campaignFilterId) && (entity === "adset" || entity === "ad") && adsScopeReady;

  const scopedRows = useMemo(
    () =>
      parentFilterActive
        ? filterMetaAdsRowsByParent({
            entity,
            rows,
            campaignId: campaignFilterId,
            adsetId: entity === "ad" ? adsetFilterId : null,
            activeAdsetIds: adsetOptions.map((option) => option.id),
          })
        : rows,
    [parentFilterActive, entity, rows, campaignFilterId, adsetFilterId, adsetOptions],
  );

  const campaignRows = campaignMetricsQuery.data?.rows ?? [];

  const campaignIdsWithBudget = useMemo(() => {
    const ids = new Set<string>();
    for (const row of campaignRows) {
      const id = String(row.campaign_id ?? "").trim();
      const budget = typeof row.budget === "number" ? row.budget : parseFloat(String(row.budget ?? ""));
      if (id && Number.isFinite(budget) && budget > 0) ids.add(id);
    }
    return ids;
  }, [campaignRows]);

  const scopedSummary = useMemo(() => {
    if (!parentFilterActive || !summary) return summary;
    const currency = summary.currency ?? "IDR";
    if (entity === "adset" && campaignFilterId) {
      const campaignRow = campaignRows.find(
        (row) => String(row.campaign_id ?? "").trim() === campaignFilterId,
      );
      if (campaignRow) return summaryFromMetaAdsRow(campaignRow, currency);
    }
    if (entity === "ad") {
      const summed = summarizeMetaAdsFilteredRows(scopedRows, currency);
      if (adsetFilterId) {
        const adsetRow = catalogRows.find(
          (row) => String(row.adset_id ?? "").trim() === adsetFilterId,
        );
        return applyParentReach(summed, adsetRow);
      }
      const campaignRow = campaignRows.find(
        (row) => String(row.campaign_id ?? "").trim() === campaignFilterId,
      );
      return applyParentReach(summed, campaignRow);
    }
    return summarizeMetaAdsFilteredRows(scopedRows, currency);
  }, [
    parentFilterActive,
    summary,
    entity,
    campaignFilterId,
    adsetFilterId,
    campaignRows,
    catalogRows,
    scopedRows,
  ]);

  return {
    campaignFilterId,
    adsetFilterId,
    campaignOptions,
    adsetOptions,
    adsetOptionsLoading: entity === "ad" && adsetCatalogQuery.isFetching && !adsetCatalogQuery.data,
    onCampaignChange: (id: string | null) => {
      setCampaignFilterId(id);
      setAdsetFilterId(null);
    },
    onAdsetChange: setAdsetFilterId,
    scopedRows,
    scopedSummary,
    campaignIdsWithBudget,
    summaryPending:
      ((entity === "adset" || (entity === "ad" && !adsetFilterId)) &&
        Boolean(campaignFilterId) &&
        campaignMetricsQuery.isFetching &&
        !campaignRows.some((row) => String(row.campaign_id ?? "").trim() === campaignFilterId)) ||
      (entity === "ad" &&
        Boolean(adsetFilterId) &&
        adsetCatalogQuery.isFetching &&
        !catalogRows.some((row) => String(row.adset_id ?? "").trim() === adsetFilterId)),
    parentFilterActive,
    refetchAdsetCatalog: () => adsetCatalogQuery.refetch(),
  };
}

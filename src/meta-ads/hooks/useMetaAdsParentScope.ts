import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useMetaAdsMetricsQuery,
  type MetaAdsAccountSummary,
  type MetaAdsMetricEntity,
  type MetaAdsMetricsRow,
} from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import {
  applyParentReach,
  filterMetaAdsRowsByParent,
  metaAdsAdsetOptions,
  summarizeMetaAdsFilteredRows,
  summaryFromMetaAdsRow,
  uniqueMetaAdsIds,
  type MetaAdsParentOption,
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

function rowId(row: MetaAdsMetricsRow, field: string): string {
  return String(row[field] ?? "").trim();
}

function rememberNames(
  target: Map<string, string>,
  rows: MetaAdsMetricsRow[],
  idField: string,
  nameField: string,
) {
  for (const row of rows) {
    const id = rowId(row, idField);
    const name = String(row[nameField] ?? "").trim();
    if (id && name) target.set(id, name);
  }
}

function namedSelection(
  ids: readonly string[],
  names: Map<string, string>,
  remembered: Map<string, string>,
): MetaAdsParentOption[] {
  return ids.map((id) => ({
    id,
    name: names.get(id) ?? remembered.get(id) ?? id,
  }));
}

export function useMetaAdsParentScope({
  organizationId,
  adAccountId,
  entity,
  dateStart,
  dateEnd,
  enabled,
  rows,
  summary,
}: Args) {
  const [campaignFilterIds, setCampaignFilterIdsState] = useState<string[]>([]);
  const [adsetFilterIds, setAdsetFilterIdsState] = useState<string[]>([]);
  const [adFilterIds, setAdFilterIdsState] = useState<string[]>([]);
  const campaignNamesRef = useRef(new Map<string, string>());
  const adsetNamesRef = useRef(new Map<string, string>());
  const adNamesRef = useRef(new Map<string, string>());
  const adsetCampaignRef = useRef(new Map<string, string>());
  const adCampaignRef = useRef(new Map<string, string>());
  const adAdsetRef = useRef(new Map<string, string>());

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
    setCampaignFilterIdsState([]);
    setAdsetFilterIdsState([]);
    setAdFilterIdsState([]);
    campaignNamesRef.current.clear();
    adsetNamesRef.current.clear();
    adNamesRef.current.clear();
    adsetCampaignRef.current.clear();
    adCampaignRef.current.clear();
    adAdsetRef.current.clear();
  }, [adAccountId]);

  const catalogRows = entity === "ad" ? (adsetCatalogQuery.data?.rows ?? []) : rows;
  const campaignRows = campaignMetricsQuery.data?.rows ?? [];

  const campaignNameById = useMemo(() => {
    const map = new Map<string, string>();
    const sources = entity === "campaign" ? [rows] : [campaignRows, catalogRows, rows];
    for (const source of sources) rememberNames(map, source, "campaign_id", "campaign_name");
    return map;
  }, [entity, rows, campaignRows, catalogRows]);

  const adsetNameById = useMemo(() => {
    const map = new Map<string, string>();
    const sources = entity === "ad" ? [catalogRows] : entity === "adset" ? [rows] : [];
    for (const source of sources) rememberNames(map, source, "adset_id", "adset_name");
    return map;
  }, [entity, rows, catalogRows]);

  const adsetCampaignPairs = useMemo(() => {
    const pairs: Array<[string, string]> = [];
    const source = entity === "ad" ? catalogRows : entity === "adset" ? rows : [];
    for (const row of source) {
      const adsetId = rowId(row, "adset_id");
      const campaignId = rowId(row, "campaign_id");
      if (adsetId && campaignId) pairs.push([adsetId, campaignId]);
    }
    return pairs;
  }, [entity, catalogRows, rows]);

  useEffect(() => {
    for (const [id, name] of campaignNameById) campaignNamesRef.current.set(id, name);
  }, [campaignNameById]);

  useEffect(() => {
    for (const [id, name] of adsetNameById) adsetNamesRef.current.set(id, name);
  }, [adsetNameById]);

  useEffect(() => {
    for (const [adsetId, campaignId] of adsetCampaignPairs) {
      adsetCampaignRef.current.set(adsetId, campaignId);
    }
  }, [adsetCampaignPairs]);

  const adNameById = useMemo(() => {
    const map = new Map<string, string>();
    if (entity === "ad") rememberNames(map, rows, "ad_id", "ad_name");
    return map;
  }, [entity, rows]);

  const adParentPairs = useMemo(() => {
    if (entity !== "ad") return [] as Array<[string, string, string]>;
    const pairs: Array<[string, string, string]> = [];
    for (const row of rows) {
      const adId = rowId(row, "ad_id");
      if (!adId) continue;
      pairs.push([adId, rowId(row, "campaign_id"), rowId(row, "adset_id")]);
    }
    return pairs;
  }, [entity, rows]);

  useEffect(() => {
    for (const [id, name] of adNameById) adNamesRef.current.set(id, name);
  }, [adNameById]);

  useEffect(() => {
    for (const [adId, campaignId, adsetId] of adParentPairs) {
      if (campaignId) adCampaignRef.current.set(adId, campaignId);
      if (adsetId) adAdsetRef.current.set(adId, adsetId);
    }
  }, [adParentPairs]);

  useEffect(() => {
    if (campaignFilterIds.length === 0) return;
    const allowed = new Set(campaignFilterIds);
    const known = new Map(adsetCampaignPairs);
    setAdsetFilterIdsState((prev) => {
      const next = prev.filter((id) => {
        const campaignId = known.get(id) ?? adsetCampaignRef.current.get(id);
        return !campaignId || allowed.has(campaignId);
      });
      if (next.length === prev.length && next.every((id, index) => id === prev[index])) return prev;
      return next;
    });
  }, [campaignFilterIds, adsetCampaignPairs]);

  useEffect(() => {
    if (adFilterIds.length === 0) return;
    const campaignAllowed = campaignFilterIds.length > 0 ? new Set(campaignFilterIds) : null;
    const adsetAllowed = adsetFilterIds.length > 0 ? new Set(adsetFilterIds) : null;
    if (!campaignAllowed && !adsetAllowed) return;
    setAdFilterIdsState((prev) => {
      const next = prev.filter((id) => {
        const campaignId = adCampaignRef.current.get(id);
        const adsetId = adAdsetRef.current.get(id);
        if (campaignAllowed && campaignId && !campaignAllowed.has(campaignId)) return false;
        if (adsetAllowed && adsetId && !adsetAllowed.has(adsetId)) return false;
        return true;
      });
      if (next.length === prev.length && next.every((id, index) => id === prev[index])) return prev;
      return next;
    });
  }, [campaignFilterIds, adsetFilterIds, adFilterIds.length, adParentPairs]);

  const setCampaignFilterIds = useCallback((ids: readonly string[]) => {
    setCampaignFilterIdsState(uniqueMetaAdsIds(ids));
  }, []);

  const setAdsetFilterIds = useCallback((ids: readonly string[]) => {
    setAdsetFilterIdsState(uniqueMetaAdsIds(ids));
  }, []);

  const setAdFilterIds = useCallback((ids: readonly string[]) => {
    setAdFilterIdsState(uniqueMetaAdsIds(ids));
  }, []);

  const removeCampaign = useCallback((id: string) => {
    setCampaignFilterIdsState((prev) => prev.filter((item) => item !== id));
  }, []);

  const removeAdset = useCallback((id: string) => {
    setAdsetFilterIdsState((prev) => prev.filter((item) => item !== id));
  }, []);

  const removeAd = useCallback((id: string) => {
    setAdFilterIdsState((prev) => prev.filter((item) => item !== id));
  }, []);

  const clearCampaigns = useCallback(() => {
    setCampaignFilterIdsState([]);
  }, []);

  const clearAdsets = useCallback(() => {
    setAdsetFilterIdsState([]);
  }, []);

  const clearAds = useCallback(() => {
    setAdFilterIdsState([]);
  }, []);

  const selectedCampaigns = useMemo(
    () => namedSelection(campaignFilterIds, campaignNameById, campaignNamesRef.current),
    [campaignFilterIds, campaignNameById],
  );
  const selectedAdsets = useMemo(
    () => namedSelection(adsetFilterIds, adsetNameById, adsetNamesRef.current),
    [adsetFilterIds, adsetNameById],
  );
  const selectedAds = useMemo(
    () => namedSelection(adFilterIds, adNameById, adNamesRef.current),
    [adFilterIds, adNameById],
  );

  const campaignOptions = useMemo(() => {
    const options = [...campaignNameById.entries()].map(([id, name]) => ({ id, name }));
    for (const item of selectedCampaigns) {
      if (!campaignNameById.has(item.id)) options.push(item);
    }
    options.sort((a, b) => a.name.localeCompare(b.name));
    return options;
  }, [campaignNameById, selectedCampaigns]);

  const adsetOptions = useMemo(
    () => metaAdsAdsetOptions(catalogRows, campaignFilterIds),
    [catalogRows, campaignFilterIds],
  );

  const parentFilterActive =
    (entity === "adset" && campaignFilterIds.length > 0) ||
    (entity === "ad" && (campaignFilterIds.length > 0 || adsetFilterIds.length > 0));

  const scopedRows = useMemo(
    () =>
      parentFilterActive
        ? filterMetaAdsRowsByParent({
            entity,
            rows,
            campaignIds: campaignFilterIds,
            adsetIds: entity === "ad" ? adsetFilterIds : [],
          })
        : rows,
    [parentFilterActive, entity, rows, campaignFilterIds, adsetFilterIds],
  );

  const campaignIdsWithBudget = useMemo(() => {
    const ids = new Set<string>();
    const source = entity === "campaign" ? rows : campaignRows;
    for (const row of source) {
      const id = rowId(row, "campaign_id");
      const budget = typeof row.budget === "number" ? row.budget : parseFloat(String(row.budget ?? ""));
      if (id && Number.isFinite(budget) && budget > 0) ids.add(id);
    }
    return ids;
  }, [entity, rows, campaignRows]);

  const scopedSummary = useMemo(() => {
    if (!parentFilterActive || !summary) return summary ?? null;
    const currency = summary.currency ?? "IDR";
    if (entity === "adset") {
      const selected = campaignRows.filter((row) =>
        campaignFilterIds.includes(rowId(row, "campaign_id")),
      );
      if (campaignFilterIds.length === 1 && selected[0]) {
        return summaryFromMetaAdsRow(selected[0], currency);
      }
      if (selected.length > 0) return summarizeMetaAdsFilteredRows(selected, currency);
    }
    if (entity === "ad") {
      const summed = summarizeMetaAdsFilteredRows(scopedRows, currency);
      if (adsetFilterIds.length === 1) {
        const adsetRow = catalogRows.find((row) => rowId(row, "adset_id") === adsetFilterIds[0]);
        return applyParentReach(summed, adsetRow);
      }
      if (adsetFilterIds.length === 0 && campaignFilterIds.length === 1) {
        const campaignRow = campaignRows.find(
          (row) => rowId(row, "campaign_id") === campaignFilterIds[0],
        );
        return applyParentReach(summed, campaignRow);
      }
      return summed;
    }
    return summarizeMetaAdsFilteredRows(scopedRows, currency);
  }, [
    parentFilterActive,
    summary,
    entity,
    campaignFilterIds,
    adsetFilterIds,
    campaignRows,
    catalogRows,
    scopedRows,
  ]);

  const oneCampaignId = campaignFilterIds.length === 1 ? campaignFilterIds[0] : null;
  const oneAdsetId = adsetFilterIds.length === 1 ? adsetFilterIds[0] : null;
  const summaryPending =
    (entity === "adset" &&
      campaignFilterIds.length > 0 &&
      campaignMetricsQuery.isFetching &&
      !campaignRows.some((row) => campaignFilterIds.includes(rowId(row, "campaign_id")))) ||
    (entity === "ad" &&
      Boolean(oneAdsetId) &&
      adsetCatalogQuery.isFetching &&
      !catalogRows.some((row) => rowId(row, "adset_id") === oneAdsetId)) ||
    (entity === "ad" &&
      adsetFilterIds.length === 0 &&
      Boolean(oneCampaignId) &&
      campaignMetricsQuery.isFetching &&
      !campaignRows.some((row) => rowId(row, "campaign_id") === oneCampaignId));

  return {
    campaignFilterIds,
    adsetFilterIds,
    adFilterIds,
    selectedCampaigns,
    selectedAdsets,
    selectedAds,
    campaignOptions,
    adsetOptions,
    adsetOptionsLoading: entity === "ad" && adsetCatalogQuery.isFetching && !adsetCatalogQuery.data,
    setCampaignFilterIds,
    setAdsetFilterIds,
    setAdFilterIds,
    removeCampaign,
    removeAdset,
    removeAd,
    clearCampaigns,
    clearAdsets,
    clearAds,
    scopedRows,
    scopedSummary,
    campaignIdsWithBudget,
    summaryPending,
    parentFilterActive,
    refetchAdsetCatalog: () => adsetCatalogQuery.refetch(),
  };
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";

export const DEFAULT_PURCHASE_ROAS_COLOR_THRESHOLD = 10;
export const DEFAULT_COST_PER_PURCHASE_COLOR_THRESHOLD = 50000;
export const DEFAULT_ATC_TO_PURCHASE_COLOR_THRESHOLD = 20;
export const DEFAULT_AOV_COLOR_THRESHOLD = 150000;
export const DEFAULT_VIEW_TO_ATC_COLOR_THRESHOLD = 10;
export const DEFAULT_CTR_COLOR_THRESHOLD = 1;
export const DEFAULT_CPM_COLOR_THRESHOLD = 10000;

export type MetaAdsColorThresholds = {
  purchaseRoasThreshold: number;
  costPerPurchaseThreshold: number;
  atcToPurchaseThreshold: number;
  aovThreshold: number;
  viewToAtcThreshold: number;
  ctrThreshold: number;
  cpmThreshold: number;
  purchaseRoasColorEnabled: boolean;
  costPerPurchaseColorEnabled: boolean;
  atcToPurchaseColorEnabled: boolean;
  aovColorEnabled: boolean;
  viewToAtcColorEnabled: boolean;
  ctrColorEnabled: boolean;
  cpmColorEnabled: boolean;
};

export function metaAdsRoasColorThresholdQueryKey(organizationId: string | null | undefined) {
  return ["meta-ads-roas-color-threshold", organizationId] as const;
}

function positiveThreshold(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const DEFAULT_THRESHOLDS: MetaAdsColorThresholds = {
  purchaseRoasThreshold: DEFAULT_PURCHASE_ROAS_COLOR_THRESHOLD,
  costPerPurchaseThreshold: DEFAULT_COST_PER_PURCHASE_COLOR_THRESHOLD,
  atcToPurchaseThreshold: DEFAULT_ATC_TO_PURCHASE_COLOR_THRESHOLD,
  aovThreshold: DEFAULT_AOV_COLOR_THRESHOLD,
  viewToAtcThreshold: DEFAULT_VIEW_TO_ATC_COLOR_THRESHOLD,
  ctrThreshold: DEFAULT_CTR_COLOR_THRESHOLD,
  cpmThreshold: DEFAULT_CPM_COLOR_THRESHOLD,
  purchaseRoasColorEnabled: true,
  costPerPurchaseColorEnabled: true,
  atcToPurchaseColorEnabled: true,
  aovColorEnabled: true,
  viewToAtcColorEnabled: true,
  ctrColorEnabled: true,
  cpmColorEnabled: true,
};

function enabledFlag(value: unknown): boolean {
  return typeof value === "boolean" ? value : true;
}

export function useMetaAdsRoasColorThreshold(organizationId: string | null | undefined) {
  const queryClient = useQueryClient();
  const queryKey = metaAdsRoasColorThresholdQueryKey(organizationId);

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<MetaAdsColorThresholds> => {
      if (!organizationId) return DEFAULT_THRESHOLDS;
      const { data, error } = await supabase
        .from("organization_meta_ads_display_settings")
        .select(
          "purchase_roas_threshold, cost_per_purchase_threshold, atc_to_purchase_rate_threshold, aov_threshold, view_to_atc_rate_threshold, ctr_threshold, purchase_roas_color_enabled, cost_per_purchase_color_enabled, atc_to_purchase_color_enabled, aov_color_enabled, view_to_atc_color_enabled, ctr_color_enabled, cpm_threshold, cpm_color_enabled",
        )
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error) throw error;
      const row = data as {
        purchase_roas_threshold?: unknown;
        cost_per_purchase_threshold?: unknown;
        atc_to_purchase_rate_threshold?: unknown;
        aov_threshold?: unknown;
        view_to_atc_rate_threshold?: unknown;
        ctr_threshold?: unknown;
        cpm_threshold?: unknown;
        purchase_roas_color_enabled?: unknown;
        cost_per_purchase_color_enabled?: unknown;
        atc_to_purchase_color_enabled?: unknown;
        aov_color_enabled?: unknown;
        view_to_atc_color_enabled?: unknown;
        ctr_color_enabled?: unknown;
        cpm_color_enabled?: unknown;
      } | null;
      return {
        purchaseRoasThreshold:
          positiveThreshold(row?.purchase_roas_threshold) ?? DEFAULT_PURCHASE_ROAS_COLOR_THRESHOLD,
        costPerPurchaseThreshold:
          positiveThreshold(row?.cost_per_purchase_threshold) ??
          DEFAULT_COST_PER_PURCHASE_COLOR_THRESHOLD,
        atcToPurchaseThreshold:
          positiveThreshold(row?.atc_to_purchase_rate_threshold) ??
          DEFAULT_ATC_TO_PURCHASE_COLOR_THRESHOLD,
        aovThreshold: positiveThreshold(row?.aov_threshold) ?? DEFAULT_AOV_COLOR_THRESHOLD,
        viewToAtcThreshold:
          positiveThreshold(row?.view_to_atc_rate_threshold) ?? DEFAULT_VIEW_TO_ATC_COLOR_THRESHOLD,
        ctrThreshold: positiveThreshold(row?.ctr_threshold) ?? DEFAULT_CTR_COLOR_THRESHOLD,
        cpmThreshold: positiveThreshold(row?.cpm_threshold) ?? DEFAULT_CPM_COLOR_THRESHOLD,
        purchaseRoasColorEnabled: enabledFlag(row?.purchase_roas_color_enabled),
        costPerPurchaseColorEnabled: enabledFlag(row?.cost_per_purchase_color_enabled),
        atcToPurchaseColorEnabled: enabledFlag(row?.atc_to_purchase_color_enabled),
        aovColorEnabled: enabledFlag(row?.aov_color_enabled),
        viewToAtcColorEnabled: enabledFlag(row?.view_to_atc_color_enabled),
        ctrColorEnabled: enabledFlag(row?.ctr_color_enabled),
        cpmColorEnabled: enabledFlag(row?.cpm_color_enabled),
      };
    },
    enabled: Boolean(organizationId),
    staleTime: 30_000,
  });

  const thresholds = query.data ?? DEFAULT_THRESHOLDS;

  const savePurchaseRoasThreshold = useMutation({
    mutationFn: (threshold: number) =>
      saveDisplayThreshold(organizationId, "purchase_roas_threshold", threshold),
    onSuccess: (value) => {
      queryClient.setQueryData<MetaAdsColorThresholds>(queryKey, (current) => ({
        ...(current ?? DEFAULT_THRESHOLDS),
        purchaseRoasThreshold: value,
      }));
    },
  });

  const saveCostPerPurchaseThreshold = useMutation({
    mutationFn: (threshold: number) =>
      saveDisplayThreshold(organizationId, "cost_per_purchase_threshold", threshold),
    onSuccess: (value) => {
      queryClient.setQueryData<MetaAdsColorThresholds>(queryKey, (current) => ({
        ...(current ?? DEFAULT_THRESHOLDS),
        costPerPurchaseThreshold: value,
      }));
    },
  });

  const savePurchaseRoasColorEnabled = useMutation({
    mutationFn: (enabled: boolean) =>
      saveDisplayFlag(organizationId, "purchase_roas_color_enabled", enabled),
    onSuccess: (value) => {
      queryClient.setQueryData<MetaAdsColorThresholds>(queryKey, (current) => ({
        ...(current ?? DEFAULT_THRESHOLDS),
        purchaseRoasColorEnabled: value,
      }));
    },
  });

  const saveCostPerPurchaseColorEnabled = useMutation({
    mutationFn: (enabled: boolean) =>
      saveDisplayFlag(organizationId, "cost_per_purchase_color_enabled", enabled),
    onSuccess: (value) => {
      queryClient.setQueryData<MetaAdsColorThresholds>(queryKey, (current) => ({
        ...(current ?? DEFAULT_THRESHOLDS),
        costPerPurchaseColorEnabled: value,
      }));
    },
  });

  const saveAtcToPurchaseThreshold = useMutation({
    mutationFn: (threshold: number) =>
      saveDisplayThreshold(organizationId, "atc_to_purchase_rate_threshold", threshold),
    onSuccess: (value) => {
      queryClient.setQueryData<MetaAdsColorThresholds>(queryKey, (current) => ({
        ...(current ?? DEFAULT_THRESHOLDS),
        atcToPurchaseThreshold: value,
      }));
    },
  });

  const saveAovThreshold = useMutation({
    mutationFn: (threshold: number) => saveDisplayThreshold(organizationId, "aov_threshold", threshold),
    onSuccess: (value) => {
      queryClient.setQueryData<MetaAdsColorThresholds>(queryKey, (current) => ({
        ...(current ?? DEFAULT_THRESHOLDS),
        aovThreshold: value,
      }));
    },
  });

  const saveViewToAtcThreshold = useMutation({
    mutationFn: (threshold: number) =>
      saveDisplayThreshold(organizationId, "view_to_atc_rate_threshold", threshold),
    onSuccess: (value) => {
      queryClient.setQueryData<MetaAdsColorThresholds>(queryKey, (current) => ({
        ...(current ?? DEFAULT_THRESHOLDS),
        viewToAtcThreshold: value,
      }));
    },
  });

  const saveCtrThreshold = useMutation({
    mutationFn: (threshold: number) => saveDisplayThreshold(organizationId, "ctr_threshold", threshold),
    onSuccess: (value) => {
      queryClient.setQueryData<MetaAdsColorThresholds>(queryKey, (current) => ({
        ...(current ?? DEFAULT_THRESHOLDS),
        ctrThreshold: value,
      }));
    },
  });

  const saveCpmThreshold = useMutation({
    mutationFn: (threshold: number) => saveDisplayThreshold(organizationId, "cpm_threshold", threshold),
    onSuccess: (value) => {
      queryClient.setQueryData<MetaAdsColorThresholds>(queryKey, (current) => ({
        ...(current ?? DEFAULT_THRESHOLDS),
        cpmThreshold: value,
      }));
    },
  });

  const saveCpmColorEnabled = useMutation({
    mutationFn: (enabled: boolean) => saveDisplayFlag(organizationId, "cpm_color_enabled", enabled),
    onSuccess: (value) => {
      queryClient.setQueryData<MetaAdsColorThresholds>(queryKey, (current) => ({
        ...(current ?? DEFAULT_THRESHOLDS),
        cpmColorEnabled: value,
      }));
    },
  });

  const saveCtrColorEnabled = useMutation({
    mutationFn: (enabled: boolean) => saveDisplayFlag(organizationId, "ctr_color_enabled", enabled),
    onSuccess: (value) => {
      queryClient.setQueryData<MetaAdsColorThresholds>(queryKey, (current) => ({
        ...(current ?? DEFAULT_THRESHOLDS),
        ctrColorEnabled: value,
      }));
    },
  });

  const saveViewToAtcColorEnabled = useMutation({
    mutationFn: (enabled: boolean) =>
      saveDisplayFlag(organizationId, "view_to_atc_color_enabled", enabled),
    onSuccess: (value) => {
      queryClient.setQueryData<MetaAdsColorThresholds>(queryKey, (current) => ({
        ...(current ?? DEFAULT_THRESHOLDS),
        viewToAtcColorEnabled: value,
      }));
    },
  });

  const saveAovColorEnabled = useMutation({
    mutationFn: (enabled: boolean) => saveDisplayFlag(organizationId, "aov_color_enabled", enabled),
    onSuccess: (value) => {
      queryClient.setQueryData<MetaAdsColorThresholds>(queryKey, (current) => ({
        ...(current ?? DEFAULT_THRESHOLDS),
        aovColorEnabled: value,
      }));
    },
  });

  const saveAtcToPurchaseColorEnabled = useMutation({
    mutationFn: (enabled: boolean) =>
      saveDisplayFlag(organizationId, "atc_to_purchase_color_enabled", enabled),
    onSuccess: (value) => {
      queryClient.setQueryData<MetaAdsColorThresholds>(queryKey, (current) => ({
        ...(current ?? DEFAULT_THRESHOLDS),
        atcToPurchaseColorEnabled: value,
      }));
    },
  });

  return {
    threshold: thresholds.purchaseRoasThreshold,
    costPerPurchaseThreshold: thresholds.costPerPurchaseThreshold,
    atcToPurchaseThreshold: thresholds.atcToPurchaseThreshold,
    aovThreshold: thresholds.aovThreshold,
    viewToAtcThreshold: thresholds.viewToAtcThreshold,
    ctrThreshold: thresholds.ctrThreshold,
    cpmThreshold: thresholds.cpmThreshold,
    purchaseRoasColorEnabled: thresholds.purchaseRoasColorEnabled,
    costPerPurchaseColorEnabled: thresholds.costPerPurchaseColorEnabled,
    atcToPurchaseColorEnabled: thresholds.atcToPurchaseColorEnabled,
    aovColorEnabled: thresholds.aovColorEnabled,
    viewToAtcColorEnabled: thresholds.viewToAtcColorEnabled,
    ctrColorEnabled: thresholds.ctrColorEnabled,
    cpmColorEnabled: thresholds.cpmColorEnabled,
    isLoading: query.isLoading,
    saveThreshold: savePurchaseRoasThreshold,
    saveCostPerPurchaseThreshold,
    saveAtcToPurchaseThreshold,
    saveAovThreshold,
    saveViewToAtcThreshold,
    saveCtrThreshold,
    saveCpmThreshold,
    savePurchaseRoasColorEnabled,
    saveCostPerPurchaseColorEnabled,
    saveAtcToPurchaseColorEnabled,
    saveAovColorEnabled,
    saveViewToAtcColorEnabled,
    saveCtrColorEnabled,
    saveCpmColorEnabled,
  };
}

async function saveDisplayThreshold(
  organizationId: string | null | undefined,
  column:
    | "purchase_roas_threshold"
    | "cost_per_purchase_threshold"
    | "atc_to_purchase_rate_threshold"
    | "aov_threshold"
    | "view_to_atc_rate_threshold"
    | "ctr_threshold"
    | "cpm_threshold",
  threshold: number,
): Promise<number> {
  if (!organizationId) throw new Error("No organization");
  const value = positiveThreshold(threshold);
  if (value == null) throw new Error("Invalid threshold");
  const { error } = await supabase.from("organization_meta_ads_display_settings").upsert(
    {
      organization_id: organizationId,
      [column]: value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );
  if (error) throw error;
  return value;
}

async function saveDisplayFlag(
  organizationId: string | null | undefined,
  column:
    | "purchase_roas_color_enabled"
    | "cost_per_purchase_color_enabled"
    | "atc_to_purchase_color_enabled"
    | "aov_color_enabled"
    | "view_to_atc_color_enabled"
    | "ctr_color_enabled"
    | "cpm_color_enabled",
  enabled: boolean,
): Promise<boolean> {
  if (!organizationId) throw new Error("No organization");
  const { error } = await supabase.from("organization_meta_ads_display_settings").upsert(
    {
      organization_id: organizationId,
      [column]: enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );
  if (error) throw error;
  return enabled;
}

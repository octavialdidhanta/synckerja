import { useEffect, useState } from "react";
import type { GoogleAdsMetricEntity } from "@/google-ads/metrics/types";

export type GoogleAdsStatusFilter = "all" | "enabled_only";

/**
 * Shared Delivery (onlyRunning) + Enabled (enabledOnly) filters for Google Ads metrics.
 * Keywords force Delivery off — same behavior on desktop and mobile.
 */
export function useGoogleAdsDeliveryEnabledFilters(entity: GoogleAdsMetricEntity) {
  const [onlyRunning, setOnlyRunning] = useState(true);
  const [enabledOnly, setEnabledOnly] = useState(false);

  /** Keywords tab lists all criteria; Delivery filter hides zero-metric rows. */
  useEffect(() => {
    if (entity === "keyword") {
      setOnlyRunning(false);
    }
  }, [entity]);

  const statusFilter: GoogleAdsStatusFilter = enabledOnly ? "enabled_only" : "all";

  return {
    onlyRunning,
    setOnlyRunning,
    enabledOnly,
    setEnabledOnly,
    statusFilter,
  };
}

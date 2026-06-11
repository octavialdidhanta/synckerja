import { useQuery } from "@tanstack/react-query";
import { actualValueForAccount } from "@/6-0-digital-marketing-shared/dmReportTargetActuals";
import {
  parseMetricDirectionsFromSettings,
  type DmReportMetricDirectionsMap,
} from "@/6-0-digital-marketing-shared/dmReportMetricDirections";
import type { DmReportMetricProgressInput } from "@/6-0-digital-marketing-shared/components/DmReportMetricProgressDisplay";
import {
  computeDmReportTargetDeviationPercentage,
  computeDmReportTargetOkrPercentage,
} from "@/6-0-digital-marketing-shared/dmReportTargetProgressMath";
import { periodKeyToDateRangePayload, periodKeyToQueryFilter } from "@/6-0-digital-marketing-shared/dmReportTargetPeriod";
import { dmReportTargetQueryKeys } from "@/6-0-digital-marketing-shared/dmReportTargetQueryKeys";
import {
  channelMetricsForAccount,
  emptyChannelMetricsMap,
  type DmReportChannelMetricsMap,
} from "@/6-0-digital-marketing-shared/dmReportTargetMetricsByChannel";
import {
  dmTargetAccountKey,
  type DmReportTargetPeriodKey,
  type DmReportTargetRow,
} from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import { fetchDmReportAccountActuals } from "@/6-0-digital-marketing-shared/hooks/useDmReportPeriodActuals";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";

export type DmObjectiveProgressDisplay = DmReportMetricProgressInput & {
  objectiveId: string;
  deviationPercentage: number;
  okrScore: number;
};

function rowToPeriodKey(row: DmReportTargetRow): DmReportTargetPeriodKey {
  if (row.period_type === "monthly" && row.month != null) {
    return { periodType: "monthly", year: row.year, month: row.month };
  }
  return { periodType: "quarterly", year: row.year, quarter: row.quarter ?? 1 };
}

function periodKeyId(period: DmReportTargetPeriodKey): string {
  if (period.periodType === "monthly") return `m:${period.year}:${period.month}`;
  return `q:${period.year}:${period.quarter}`;
}

export function useDmReportObjectiveProgressByObjectiveId(enabled = true) {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: dmReportTargetQueryKeys.objectiveProgress(organizationId),
    queryFn: async (): Promise<Map<string, DmObjectiveProgressDisplay>> => {
      if (!organizationId) return new Map();

      const { data: rows, error } = await supabase
        .from("digital_marketing_report_targets")
        .select("*")
        .eq("organization_id", organizationId)
        .not("individual_objective_id", "is", null);

      if (error) throw error;

      const linked = (rows ?? []) as DmReportTargetRow[];
      if (linked.length === 0) return new Map();

      const periodGroups = new Map<string, { period: DmReportTargetPeriodKey; rows: DmReportTargetRow[] }>();
      for (const row of linked) {
        const period = rowToPeriodKey(row);
        const id = periodKeyId(period);
        const group = periodGroups.get(id);
        if (group) {
          group.rows.push(row);
        } else {
          periodGroups.set(id, { period, rows: [row] });
        }
      }

      const result = new Map<string, DmObjectiveProgressDisplay>();

      for (const { period, rows: periodRows } of periodGroups.values()) {
        const filter = periodKeyToQueryFilter(period);
        let settingsQuery = supabase
          .from("digital_marketing_report_target_period_settings")
          .select("metric_directions")
          .eq("organization_id", organizationId)
          .eq("period_type", filter.period_type)
          .eq("year", filter.year);

        if (filter.period_type === "monthly" && filter.month != null) {
          settingsQuery = settingsQuery.eq("month", filter.month);
        }
        if (filter.period_type === "quarterly" && filter.quarter != null) {
          settingsQuery = settingsQuery.eq("quarter", filter.quarter);
        }

        const { data: settingsRow } = await settingsQuery.maybeSingle();
        const metricDirections: DmReportMetricDirectionsMap = parseMetricDirectionsFromSettings(
          settingsRow?.metric_directions,
        );

        const metricsByChannel: DmReportChannelMetricsMap = { ...emptyChannelMetricsMap() };
        for (const row of periodRows) {
          const list = metricsByChannel[row.channel] ?? [];
          if (!list.includes(row.metric_key)) {
            metricsByChannel[row.channel] = [...list, row.metric_key];
          }
        }

        const datePayload = periodKeyToDateRangePayload(period);
        if (!datePayload) continue;

        const accountActualsCache = new Map<string, Awaited<ReturnType<typeof fetchDmReportAccountActuals>>>();

        for (const row of periodRows) {
          if (!row.individual_objective_id) continue;
          const accountKey = dmTargetAccountKey(row.channel, row.account_id);

          if (!accountActualsCache.has(accountKey)) {
            const actuals = await fetchDmReportAccountActuals(
              organizationId,
              {
                channel: row.channel,
                accountId: row.account_id,
                accountLabel: row.account_id,
                currencyCode: null,
                sortOrder: 0,
              },
              datePayload.start,
              datePayload.end,
              channelMetricsForAccount(metricsByChannel, row.channel),
            );
            accountActualsCache.set(accountKey, actuals);
          }

          const actuals = accountActualsCache.get(accountKey)!;
          const actual = actualValueForAccount(actuals, row.metric_key);
          const target = Number(row.target_value);
          const input: DmReportMetricProgressInput = {
            metricKey: row.metric_key,
            channel: row.channel,
            actual,
            target,
            metricDirections,
          };

          result.set(row.individual_objective_id, {
            ...input,
            objectiveId: row.individual_objective_id,
            deviationPercentage:
              actual != null
                ? computeDmReportTargetDeviationPercentage(
                    actual,
                    target,
                    row.metric_key,
                    metricDirections,
                  )
                : 0,
            okrScore:
              actual != null
                ? computeDmReportTargetOkrPercentage(
                    actual,
                    target,
                    row.metric_key,
                    metricDirections,
                  )
                : 0,
          });
        }
      }

      return result;
    },
    enabled: Boolean(organizationId && enabled),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

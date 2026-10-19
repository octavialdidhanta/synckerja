import { computeFunnelStats, type FunnelStats } from "@/6-1-dashboard/lib/contentPillarTracker";
import type { PillarData } from "@/6-1-dashboard/types/social-media";
import type { ContentPillarFunnel, LabContentPillar } from "@/thinking-lab/execution/pillars";

export type LabPillarWithUsage = LabContentPillar & { count: number };

function sameName(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function pillarMonthCount(pillar: LabContentPillar, usage: PillarData[]): number {
  const byId = usage.find((row) => row.pillar_id === pillar.id);
  if (byId) return byId.count;
  const byName = usage.find((row) => sameName(row.pillar_name, pillar.name));
  return byName?.count ?? 0;
}

export function monthFunnelStats(usage: PillarData[]): FunnelStats {
  return computeFunnelStats(usage);
}

export function pillarsInFunnel(
  pillars: LabContentPillar[],
  usage: PillarData[],
  funnel: ContentPillarFunnel,
): LabPillarWithUsage[] {
  return pillars
    .filter((pillar) => pillar.funnel === funnel)
    .map((pillar) => ({ ...pillar, count: pillarMonthCount(pillar, usage) }))
    .sort((left, right) => left.count - right.count || left.name.localeCompare(right.name));
}

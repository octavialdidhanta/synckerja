import type { QueryClient } from '@tanstack/react-query';
import type { FunnelStage, PillarData } from '../types/social-media';

export type { FunnelStage };

export const FUNNEL_CONFIG = {
  top: {
    label: 'TOP FUNNEL',
    name: 'Awareness',
    color: '#10B981',
    bgColor: '#ECFDF5',
    emoji: '🟢',
  },
  middle: {
    label: 'MIDDLE FUNNEL',
    name: 'Consideration',
    color: '#F59E0B',
    bgColor: '#FFFBEB',
    emoji: '🟡',
  },
  bottom: {
    label: 'BOTTOM FUNNEL',
    name: 'Conversion',
    color: '#EF4444',
    bgColor: '#FEF2F2',
    emoji: '🔴',
  },
} as const satisfies Record<
  FunnelStage,
  { label: string; name: string; color: string; bgColor: string; emoji: string }
>;

export interface FunnelStageStat {
  count: number;
  percentage: number;
}

export interface FunnelStats {
  total: number;
  top: FunnelStageStat;
  middle: FunnelStageStat;
  bottom: FunnelStageStat;
}

function stagePercentage(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

export function computeFunnelStats(pillarData: PillarData[]): FunnelStats {
  const totalContent = pillarData.reduce((sum, p) => sum + p.count, 0);
  const funnelCounts: Record<FunnelStage, number> = { top: 0, middle: 0, bottom: 0 };
  pillarData.forEach((p) => {
    funnelCounts[p.funnel] += p.count;
  });
  return {
    total: totalContent,
    top: {
      count: funnelCounts.top,
      percentage: stagePercentage(funnelCounts.top, totalContent),
    },
    middle: {
      count: funnelCounts.middle,
      percentage: stagePercentage(funnelCounts.middle, totalContent),
    },
    bottom: {
      count: funnelCounts.bottom,
      percentage: stagePercentage(funnelCounts.bottom, totalContent),
    },
  };
}

export function filterPillarsByFunnel(pillarData: PillarData[], stage: FunnelStage): PillarData[] {
  return pillarData.filter((pillar) => pillar.funnel === stage);
}

/** Desktop scale: count / 10, capped at 100%. */
export function pillarBarWidth(count: number): number {
  return Math.min((count / 10) * 100, 100);
}

export function buildPillarTrackerCsv(pillarData: PillarData[]): string {
  return [
    ['Pillar Name', 'Count', 'Funnel', 'Type'].join(','),
    ...pillarData.map((p) =>
      [`"${p.pillar_name}"`, p.count, p.funnel, p.isDefault ? 'Default' : 'Custom'].join(','),
    ),
  ].join('\n');
}

export function pillarTrackerCsvFilename(date = new Date()): string {
  return `content-pillar-tracker-${date.toISOString().split('T')[0]}.csv`;
}

export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function invalidateContentPillarQueries(
  queryClient: QueryClient,
  organizationId: string | null | undefined,
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: ['contentPillarData', organizationId],
  });
  await queryClient.invalidateQueries({
    queryKey: ['social-media-plans', organizationId],
  });
}

/** Same sequence as the Funnel "Refresh Data" menu: invalidate tracker + plans, then refetch. */
export async function refreshContentPillarTrackerQueries(
  queryClient: QueryClient,
  organizationId: string | null | undefined,
): Promise<void> {
  await invalidateContentPillarQueries(queryClient, organizationId);
  await queryClient.refetchQueries({
    queryKey: ['contentPillarData', organizationId],
  });
}

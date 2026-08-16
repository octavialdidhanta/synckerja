import type { QueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import type {
  ContentBalanceStats,
  ContentPlan,
  ContentType,
  PICProductionStats,
} from '../types/social-media';
import { downloadCsv } from './contentPillarTracker';

export type ContentTypeCategory = 'image' | 'video' | 'excluded';

export const VIDEO_TYPES = ['Youtube', 'Reel'] as const;
export const IMAGE_TYPES = ['Post', 'Carousel'] as const;
export const EXCLUDED_TYPES = ['Story'] as const;

export function getContentTypeCategory(
  contentTypeName: string | null | undefined,
): ContentTypeCategory {
  if (!contentTypeName) return 'excluded';
  const name = contentTypeName.trim();
  if ((VIDEO_TYPES as readonly string[]).includes(name)) return 'video';
  if ((IMAGE_TYPES as readonly string[]).includes(name)) return 'image';
  if ((EXCLUDED_TYPES as readonly string[]).includes(name)) return 'excluded';
  return 'excluded';
}

function matchesMonthAndService(
  plan: ContentPlan,
  selectedMonth: Date,
  serviceFilter?: string,
  requirePicProduction = false,
): boolean {
  if (!plan?.post_date) return false;
  if (requirePicProduction && !plan.pic_production_id) return false;
  try {
    const planDate = new Date(plan.post_date);
    const matchesMonth =
      planDate.getFullYear() === selectedMonth.getFullYear() &&
      planDate.getMonth() === selectedMonth.getMonth();
    if (!matchesMonth) return false;
    if (serviceFilter && serviceFilter !== 'all') {
      return plan.service_id === serviceFilter;
    }
    return true;
  } catch {
    return false;
  }
}

function resolveContentTypeName(
  plan: ContentPlan,
  contentTypes: Pick<ContentType, 'id' | 'name'>[],
): string | undefined {
  return contentTypes.find((type) => type.id === plan?.content_type_id)?.name;
}

export function calculateContentBalance(
  contentPlans: ContentPlan[],
  contentTypes: Pick<ContentType, 'id' | 'name'>[],
  selectedMonth: Date,
  serviceFilter?: string,
): ContentBalanceStats {
  const monthContent = contentPlans.filter((plan) =>
    matchesMonthAndService(plan, selectedMonth, serviceFilter),
  );

  let imageCount = 0;
  let videoCount = 0;
  let completedImageCount = 0;
  let completedVideoCount = 0;

  monthContent.forEach((plan) => {
    const category = getContentTypeCategory(resolveContentTypeName(plan, contentTypes));
    const isCompleted = plan?.production_approved === true;

    if (category === 'image') {
      imageCount++;
      if (isCompleted) completedImageCount++;
    } else if (category === 'video') {
      videoCount++;
      if (isCompleted) completedVideoCount++;
    }
  });

  const total = imageCount + videoCount;
  const completedTotal = completedImageCount + completedVideoCount;

  return {
    total,
    image: {
      count: imageCount,
      percentage: total > 0 ? Math.round((imageCount / total) * 100) : 0,
    },
    video: {
      count: videoCount,
      percentage: total > 0 ? Math.round((videoCount / total) * 100) : 0,
    },
    completed: {
      total: completedTotal,
      image: completedImageCount,
      video: completedVideoCount,
    },
  };
}

export function calculatePICProductionStats(
  contentPlans: ContentPlan[],
  contentTypes: Pick<ContentType, 'id' | 'name'>[],
  selectedMonth: Date,
  serviceFilter?: string,
): PICProductionStats[] {
  const monthContent = contentPlans.filter((plan) =>
    matchesMonthAndService(plan, selectedMonth, serviceFilter, true),
  );

  const picStatsMap = new Map<
    string,
    {
      picName: string;
      imageCount: number;
      videoCount: number;
      completedImageCount: number;
      completedVideoCount: number;
    }
  >();

  monthContent.forEach((plan) => {
    const picId = plan.pic_production_id!;
    const picName = plan.pic_production?.full_name || `PIC ${picId}`;
    const category = getContentTypeCategory(resolveContentTypeName(plan, contentTypes));
    const isCompleted = plan?.production_approved === true;

    if (!picStatsMap.has(picId)) {
      picStatsMap.set(picId, {
        picName,
        imageCount: 0,
        videoCount: 0,
        completedImageCount: 0,
        completedVideoCount: 0,
      });
    }

    const stats = picStatsMap.get(picId)!;
    if (category === 'image') {
      stats.imageCount++;
      if (isCompleted) stats.completedImageCount++;
    } else if (category === 'video') {
      stats.videoCount++;
      if (isCompleted) stats.completedVideoCount++;
    }
  });

  const picStatsArray: PICProductionStats[] = Array.from(picStatsMap.entries()).map(
    ([picId, stats]) => ({
      picId,
      picName: stats.picName,
      imageCount: stats.imageCount,
      videoCount: stats.videoCount,
      totalCount: stats.imageCount + stats.videoCount,
      completedImageCount: stats.completedImageCount,
      completedVideoCount: stats.completedVideoCount,
      completedTotalCount: stats.completedImageCount + stats.completedVideoCount,
    }),
  );

  return picStatsArray.sort((a, b) => b.totalCount - a.totalCount);
}

export function buildContentBalanceCsv(
  selectedMonth: Date,
  contentBalance: ContentBalanceStats,
  picProductionStats: PICProductionStats[],
): string {
  return [
    ['Month', 'Total Content', 'Image Count', 'Image %', 'Video Count', 'Video %'].join(','),
    [
      format(selectedMonth, 'MMM yyyy'),
      contentBalance.total,
      contentBalance.image.count,
      `${contentBalance.image.percentage}%`,
      contentBalance.video.count,
      `${contentBalance.video.percentage}%`,
    ].join(','),
    '',
    ['PIC Name', 'Image Count', 'Video Count', 'Total Count'].join(','),
    ...picProductionStats.map((pic) =>
      [`"${pic.picName}"`, pic.imageCount, pic.videoCount, pic.totalCount].join(','),
    ),
  ].join('\n');
}

export function contentBalanceCsvFilename(selectedMonth: Date): string {
  return `content-balance-${format(selectedMonth, 'yyyy-MM')}.csv`;
}

export function downloadContentBalanceCsv(
  selectedMonth: Date,
  contentBalance: ContentBalanceStats,
  picProductionStats: PICProductionStats[],
): void {
  downloadCsv(
    contentBalanceCsvFilename(selectedMonth),
    buildContentBalanceCsv(selectedMonth, contentBalance, picProductionStats),
  );
}

export async function invalidateContentBalanceQueries(
  queryClient: QueryClient,
  organizationId: string | null | undefined,
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: ['social-media-plans', organizationId],
  });
  await queryClient.invalidateQueries({
    queryKey: ['social-media-master', organizationId],
  });
}

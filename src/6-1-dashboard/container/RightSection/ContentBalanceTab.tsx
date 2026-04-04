import React, { useMemo } from 'react';
import { MoreVertical, Download, RefreshCw, Wifi, Image, Video, CheckCircle2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useOptimizedSocialMedia } from '../../hook/useOptimizedSocialMediaState';
import { format, startOfMonth } from 'date-fns';

// Content type mapping - exact match dari content_type.name
const VIDEO_TYPES = ['Youtube', 'Reel'];
const IMAGE_TYPES = ['Post', 'Carousel'];
const EXCLUDED_TYPES = ['Story'];

interface ContentBalanceStats {
  total: number;
  image: {
    count: number;
    percentage: number;
  };
  video: {
    count: number;
    percentage: number;
  };
  completed: {
    total: number;
    image: number;
    video: number;
  };
}

interface PICProductionStats {
  picId: string;
  picName: string;
  imageCount: number;
  videoCount: number;
  totalCount: number;
  completedImageCount: number;
  completedVideoCount: number;
  completedTotalCount: number;
}

interface ContentBalanceTabProps {
  selectedMonth?: Date;
  serviceFilter?: string;
}

export const ContentBalanceTab: React.FC<ContentBalanceTabProps> = ({ selectedMonth: propSelectedMonth, serviceFilter }) => {
  // Use prop selectedMonth if provided, otherwise default to current month
  const selectedMonth = propSelectedMonth || startOfMonth(new Date());
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { contentPlans, contentTypes, isLoading } = useOptimizedSocialMedia();

  const handleManualRefresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['contentPlans', organizationId]
    });
    await queryClient.invalidateQueries({
      queryKey: ['social-media-master', organizationId]
    });
    toast.success('Data refreshed');
  };

  const exportToCSV = () => {
    const monthStats = calculateContentBalance();
    const picStats = calculatePICProductionStats();
    
    const csvContent = [
      ['Month', 'Total Content', 'Image Count', 'Image %', 'Video Count', 'Video %'].join(','),
      [
        format(selectedMonth, 'MMM yyyy'),
        monthStats.total,
        monthStats.image.count,
        `${monthStats.image.percentage}%`,
        monthStats.video.count,
        `${monthStats.video.percentage}%`
      ].join(','),
      '',
      ['PIC Name', 'Image Count', 'Video Count', 'Total Count'].join(','),
      ...picStats.map(pic => [
        `"${pic.picName}"`,
        pic.imageCount,
        pic.videoCount,
        pic.totalCount
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `content-balance-${format(selectedMonth, 'yyyy-MM')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Content balance data exported successfully');
  };

  // Helper function to determine if content type is image or video
  const getContentTypeCategory = (contentTypeName: string | null | undefined): 'image' | 'video' | 'excluded' => {
    if (!contentTypeName) return 'excluded';
    const name = contentTypeName.trim();
    if (VIDEO_TYPES.includes(name)) return 'video';
    if (IMAGE_TYPES.includes(name)) return 'image';
    if (EXCLUDED_TYPES.includes(name)) return 'excluded';
    return 'excluded';
  };

  // Calculate content balance for selected month
  const calculateContentBalance = (): ContentBalanceStats => {
    const selectedYear = selectedMonth.getFullYear();
    const selectedMonthIndex = selectedMonth.getMonth();

    // Filter content plans for selected month and service
    const monthContent = contentPlans.filter(plan => {
      if (!plan?.post_date) return false;
      try {
        const planDate = new Date(plan.post_date);
        const matchesMonth = planDate.getFullYear() === selectedYear && planDate.getMonth() === selectedMonthIndex;
        
        // Apply service filter if provided
        if (serviceFilter && serviceFilter !== 'all') {
          return matchesMonth && plan.service_id === serviceFilter;
        }
        
        return matchesMonth;
      } catch {
        return false;
      }
    });

    let imageCount = 0;
    let videoCount = 0;
    let completedImageCount = 0;
    let completedVideoCount = 0;

    monthContent.forEach(plan => {
      const contentTypeName = contentTypes.find(type => type.id === plan?.content_type_id)?.name;
      const category = getContentTypeCategory(contentTypeName);
      
      // Check if production_approved = true for completed tracking
      const isCompleted = plan?.production_approved === true;
      
      if (category === 'image') {
        imageCount++;
        if (isCompleted) {
          completedImageCount++;
        }
      } else if (category === 'video') {
        videoCount++;
        if (isCompleted) {
          completedVideoCount++;
        }
      }
      // Excluded types are not counted
    });

    const total = imageCount + videoCount;
    const completedTotal = completedImageCount + completedVideoCount;

    return {
      total,
      image: {
        count: imageCount,
        percentage: total > 0 ? Math.round((imageCount / total) * 100) : 0
      },
      video: {
        count: videoCount,
        percentage: total > 0 ? Math.round((videoCount / total) * 100) : 0
      },
      completed: {
        total: completedTotal,
        image: completedImageCount,
        video: completedVideoCount
      }
    };
  };

  // Calculate PIC Production stats for selected month
  const calculatePICProductionStats = (): PICProductionStats[] => {
    const selectedYear = selectedMonth.getFullYear();
    const selectedMonthIndex = selectedMonth.getMonth();

    // Filter content plans for selected month with PIC Production and service
    const monthContent = contentPlans.filter(plan => {
      if (!plan?.post_date || !plan?.pic_production_id) return false;
      try {
        const planDate = new Date(plan.post_date);
        const matchesMonth = planDate.getFullYear() === selectedYear && planDate.getMonth() === selectedMonthIndex;
        
        // Apply service filter if provided
        if (serviceFilter && serviceFilter !== 'all') {
          return matchesMonth && plan.service_id === serviceFilter;
        }
        
        return matchesMonth;
      } catch {
        return false;
      }
    });

    // Group by PIC Production with completed tracking
    const picStatsMap = new Map<string, { 
      picName: string; 
      imageCount: number; 
      videoCount: number;
      completedImageCount: number;
      completedVideoCount: number;
    }>();

    monthContent.forEach(plan => {
      const picId = plan.pic_production_id!;
      const picName = plan.pic_production?.full_name || `PIC ${picId}`;
      const contentTypeName = contentTypes.find(type => type.id === plan?.content_type_id)?.name;
      const category = getContentTypeCategory(contentTypeName);
      
      // Check if production_approved = true for completed tracking
      const isCompleted = plan?.production_approved === true;

      if (!picStatsMap.has(picId)) {
        picStatsMap.set(picId, {
          picName,
          imageCount: 0,
          videoCount: 0,
          completedImageCount: 0,
          completedVideoCount: 0
        });
      }

      const stats = picStatsMap.get(picId)!;
      if (category === 'image') {
        stats.imageCount++;
        if (isCompleted) {
          stats.completedImageCount++;
        }
      } else if (category === 'video') {
        stats.videoCount++;
        if (isCompleted) {
          stats.completedVideoCount++;
        }
      }
    });

    // Convert to array and sort by total count (descending)
    const picStatsArray: PICProductionStats[] = Array.from(picStatsMap.entries()).map(([picId, stats]) => ({
      picId,
      picName: stats.picName,
      imageCount: stats.imageCount,
      videoCount: stats.videoCount,
      totalCount: stats.imageCount + stats.videoCount,
      completedImageCount: stats.completedImageCount,
      completedVideoCount: stats.completedVideoCount,
      completedTotalCount: stats.completedImageCount + stats.completedVideoCount
    }));

    return picStatsArray.sort((a, b) => b.totalCount - a.totalCount);
  };

  const contentBalance = useMemo(() => calculateContentBalance(), [contentPlans, contentTypes, selectedMonth, serviceFilter]);
  const picProductionStats = useMemo(() => calculatePICProductionStats(), [contentPlans, contentTypes, selectedMonth, serviceFilter]);

  if (isLoading) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col rounded-[5px] border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900">Content Balance</h3>
          <p className="text-sm text-gray-600">Loading...</p>
        </div>
        <div className="p-4">
          <div className="animate-pulse space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col rounded-[5px] border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-gray-200 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">Content Balance</h3>
            <div className="flex items-center gap-1 rounded-[5px] bg-success-muted px-2 py-1 text-xs text-success-foreground">
              <Wifi className="h-3 w-3 shrink-0 text-success" />
              Live
            </div>
          </div>
          <div className="text-sm text-gray-600 mb-2">
            Month Distribution - Total: {contentBalance.total} content
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleManualRefresh} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh Data
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportToCSV} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content Balance Stats */}
      <div className="p-2 border-b border-gray-100 flex-shrink-0">
        <div className="grid grid-cols-2 gap-2">
          {/* Image Stats */}
          <div className="flex flex-col items-center rounded-[5px] border border-primary/25 bg-accent px-1 py-2">
            <div className="mb-1 flex items-center gap-1">
              <Image className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-primary">Image</span>
            </div>
            <div className="mb-1 text-lg font-semibold tabular-nums text-primary">
              {contentBalance.image.percentage}% ({contentBalance.image.count})
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-primary/20">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${contentBalance.image.percentage}%` }}
              />
            </div>
          </div>

          {/* Video Stats — merah brand (warning / aksen) */}
          <div className="flex flex-col items-center rounded-[5px] border border-warning/30 bg-warning-muted px-1 py-2">
            <div className="mb-1 flex items-center gap-1">
              <Video className="h-4 w-4 text-warning" />
              <span className="text-xs font-medium text-warning-foreground">Video</span>
            </div>
            <div className="mb-1 text-lg font-semibold tabular-nums text-warning">
              {contentBalance.video.percentage}% ({contentBalance.video.count})
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-warning/25">
              <div
                className="h-full rounded-full bg-warning transition-all duration-300"
                style={{ width: `${contentBalance.video.percentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* PIC Production Tracking — scroll di TabsContent (sama seperti tab Reminders), satu scroll per panel */}
      <div className="px-2 pb-2">
        <div className="mb-3 mt-3 rounded-[5px] border border-gray-200 px-3 py-2 text-sm font-medium">
          PIC Production Distribution
          <span className="ml-2 text-gray-600">{picProductionStats.length} PICs</span>
        </div>

        <div className="space-y-3">
          {picProductionStats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No PIC Production data for {format(selectedMonth, 'MMM yyyy')}</p>
            </div>
          ) : (
            picProductionStats.map((pic) => (
              <div key={pic.picId} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {pic.picName}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                    <div className="flex items-center gap-1">
                      <Image className="h-3 w-3 text-primary" />
                      <span className="text-sm font-medium tabular-nums text-primary">{pic.imageCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Video className="h-3 w-3 text-warning" />
                      <span className="text-sm font-medium tabular-nums text-warning">{pic.videoCount}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">({pic.totalCount})</span>
                    {pic.completedTotalCount > 0 && (
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 shrink-0 text-primary" />
                        <span className="text-sm font-medium tabular-nums text-primary">{pic.completedTotalCount}</span>
                        <span className="text-xs text-gray-900">
                          completed ({pic.completedImageCount} image, {pic.completedVideoCount} video)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="flex h-full">
                    {pic.imageCount > 0 && (
                      <div
                        className="bg-primary transition-all duration-300"
                        style={{ width: `${pic.totalCount > 0 ? (pic.imageCount / pic.totalCount) * 100 : 0}%` }}
                      />
                    )}
                    {pic.videoCount > 0 && (
                      <div
                        className="bg-warning transition-all duration-300"
                        style={{ width: `${pic.totalCount > 0 ? (pic.videoCount / pic.totalCount) * 100 : 0}%` }}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};


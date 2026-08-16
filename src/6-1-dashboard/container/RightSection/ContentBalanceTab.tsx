import { MoreVertical, Download, RefreshCw, Wifi, Image, Video, CheckCircle2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { format } from 'date-fns';
import { useContentBalanceStats } from '../../hook/useContentBalanceStats';
import {
  downloadContentBalanceCsv,
  invalidateContentBalanceQueries,
} from '../../lib/contentBalance';

interface ContentBalanceTabProps {
  selectedMonth?: Date;
  serviceFilter?: string;
}

export const ContentBalanceTab = ({ selectedMonth: propSelectedMonth, serviceFilter }: ContentBalanceTabProps) => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { selectedMonth, contentBalance, picProductionStats, isLoading } = useContentBalanceStats(
    propSelectedMonth,
    serviceFilter,
  );

  const handleManualRefresh = async () => {
    await invalidateContentBalanceQueries(queryClient, organizationId);
    toast.success('Data refreshed');
  };

  const exportToCSV = () => {
    downloadContentBalanceCsv(selectedMonth, contentBalance, picProductionStats);
    toast.success('Content balance data exported successfully');
  };

  if (isLoading) {
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-[5px] border border-gray-200 bg-white shadow-sm">
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
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-[5px] border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-gray-200 p-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">Content Balance</h3>
            <div className="flex items-center gap-1 rounded-[5px] bg-success-muted px-2 py-1 text-xs text-success-foreground">
              <Wifi className="h-3 w-3 shrink-0 text-success" />
              Live
            </div>
          </div>
          <div className="mb-2 text-sm text-gray-600">
            Month Distribution - Total: {contentBalance.total} content
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0">
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
      <div className="shrink-0 border-b border-gray-100 p-2">
        <div className="grid grid-cols-2 gap-2">
          {/* Image Stats */}
          <div className="flex min-w-0 flex-col items-center rounded-[5px] border border-primary/25 bg-accent px-1 py-2">
            <div className="mb-1 flex items-center gap-1">
              <Image className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-xs font-medium text-primary">Image</span>
            </div>
            <div className="mb-1 text-center text-lg font-semibold tabular-nums text-primary">
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
          <div className="flex min-w-0 flex-col items-center rounded-[5px] border border-warning/30 bg-warning-muted px-1 py-2">
            <div className="mb-1 flex items-center gap-1">
              <Video className="h-4 w-4 shrink-0 text-warning" />
              <span className="text-xs font-medium text-warning-foreground">Video</span>
            </div>
            <div className="mb-1 text-center text-lg font-semibold tabular-nums text-warning">
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

      {/* PIC list scrolls inside the panel — header + tiles stay visible, same as Funnel / content-calendar */}
      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
                    {pic.picName}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                      <Image className="h-3 w-3 text-primary" />
                      <span className="text-sm font-medium tabular-nums text-primary">{pic.imageCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Video className="h-3 w-3 text-warning" />
                      <span className="text-sm font-medium tabular-nums text-warning">{pic.videoCount}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">({pic.totalCount})</span>
                  </div>
                </div>
                {pic.completedTotalCount > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-primary" />
                    <span className="text-sm font-medium tabular-nums text-primary">{pic.completedTotalCount}</span>
                    <span className="text-xs text-gray-900">
                      completed ({pic.completedImageCount} image, {pic.completedVideoCount} video)
                    </span>
                  </div>
                )}
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

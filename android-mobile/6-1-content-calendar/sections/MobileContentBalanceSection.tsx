import { Download, MoreVertical, RefreshCw, Wifi, Image, Video, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useContentBalanceStats } from "@/6-1-dashboard/hook/useContentBalanceStats";
import {
  downloadContentBalanceCsv,
  invalidateContentBalanceQueries,
} from "@/6-1-dashboard/lib/contentBalance";

interface MobileContentBalanceSectionProps {
  selectedMonth: Date;
  serviceFilter?: string;
}

export function MobileContentBalanceSection({
  selectedMonth: propSelectedMonth,
  serviceFilter,
}: MobileContentBalanceSectionProps) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { selectedMonth, contentBalance, picProductionStats, isLoading } = useContentBalanceStats(
    propSelectedMonth,
    serviceFilter,
  );

  const handleManualRefresh = async () => {
    await invalidateContentBalanceQueries(queryClient, organizationId);
    toast.success("Data refreshed");
  };

  const exportToCSV = () => {
    downloadContentBalanceCsv(selectedMonth, contentBalance, picProductionStats);
    toast.success("Content balance data exported successfully");
  };

  if (isLoading) {
    return <MobileContentBalanceSectionPulse />;
  }

  return (
    <div className="-mx-2 border-y border-border bg-card">
      <div className="flex items-start justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-base font-semibold text-gray-900">Content Balance</h3>
            <div className="flex items-center gap-1 rounded-[5px] bg-success-muted px-2 py-0.5 text-[10px] text-success-foreground">
              <Wifi className="h-3 w-3 shrink-0 text-success" />
              Live
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-600">
            Month Distribution - Total: {contentBalance.total} content
          </p>
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

      <div className="border-b border-border px-2 py-2">
        <div className="grid grid-cols-2 gap-2">
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

      <div className="px-3 pb-3">
        <div className="mb-3 mt-3 rounded-[5px] border border-gray-200 px-3 py-2 text-sm font-medium">
          PIC Production Distribution
          <span className="ml-2 text-gray-600">{picProductionStats.length} PICs</span>
        </div>

        <div className="space-y-3">
          {picProductionStats.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <p className="text-sm">No PIC Production data for {format(selectedMonth, "MMM yyyy")}</p>
            </div>
          ) : (
            picProductionStats.map((pic) => (
              <div key={pic.picId} className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="min-w-0 flex-1 text-sm font-medium text-gray-900">{pic.picName}</span>
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
                    <span className="text-sm font-medium tabular-nums text-primary">
                      {pic.completedTotalCount}
                    </span>
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
                        style={{
                          width: `${pic.totalCount > 0 ? (pic.imageCount / pic.totalCount) * 100 : 0}%`,
                        }}
                      />
                    )}
                    {pic.videoCount > 0 && (
                      <div
                        className="bg-warning transition-all duration-300"
                        style={{
                          width: `${pic.totalCount > 0 ? (pic.videoCount / pic.totalCount) * 100 : 0}%`,
                        }}
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
}

export function MobileContentBalanceSectionPulse() {
  return (
    <div className="-mx-2 border-y border-border bg-card">
      <div className="border-b border-border px-3 py-2">
        <div className="h-4 w-36 animate-pulse rounded bg-muted/60" />
        <div className="mt-2 h-3 w-48 animate-pulse rounded bg-muted/40" />
      </div>
      <div className="grid grid-cols-2 gap-2 border-b border-border px-2 py-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-[5px] bg-muted/40" />
        ))}
      </div>
      <div className="space-y-3 px-3 py-3">
        <div className="h-8 animate-pulse rounded-[5px] bg-muted/30" />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-4 w-40 animate-pulse rounded bg-muted/50" />
            <div className="h-2 w-full animate-pulse rounded-full bg-muted/40" />
          </div>
        ))}
      </div>
    </div>
  );
}

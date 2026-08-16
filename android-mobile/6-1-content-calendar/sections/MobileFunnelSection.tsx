import { useState } from "react";
import { cn } from "@/shared/lib/utils";
import { Download, MoreVertical, RefreshCw } from "lucide-react";
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
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useContentPillarData } from "@/6-1-dashboard/hook/useContentPillarData";
import {
  buildPillarTrackerCsv,
  downloadCsv,
  refreshContentPillarTrackerQueries,
  pillarTrackerCsvFilename,
  type FunnelStage,
} from "@/6-1-dashboard/lib/contentPillarTracker";
import { ContentPillarTrackerPanel } from "@/mobile/6-1-content-calendar/components/ContentPillarTrackerPanel";

interface MobileFunnelSectionProps {
  selectedMonth: Date;
  serviceFilter?: string;
}

export function MobileFunnelSection({ selectedMonth, serviceFilter }: MobileFunnelSectionProps) {
  const { t } = useAppTranslation();
  const [selectedFunnel, setSelectedFunnel] = useState<FunnelStage>("top");
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const {
    data: pillarData = [],
    isLoading,
    error,
  } = useContentPillarData(selectedMonth, serviceFilter);

  const trackerTitle = t("socialMedia.contentPillarTracker.title", "Content Pillar Tracker");

  const handleManualRefresh = async () => {
    await refreshContentPillarTrackerQueries(queryClient, organizationId);
    toast.success("Data refreshed");
  };

  const exportToCSV = () => {
    downloadCsv(pillarTrackerCsvFilename(), buildPillarTrackerCsv(pillarData));
    toast.success("Content pillar data exported successfully");
  };

  if (isLoading) {
    return <MobileFunnelSectionPulse />;
  }

  if (error) {
    return (
      <div className="-mx-2 border-y border-border bg-card px-3 py-4">
        <p className="text-sm font-medium text-gray-900">{trackerTitle}</p>
        <p className="mt-1 text-sm text-red-600">Error loading data</p>
        <Button variant="outline" size="sm" onClick={handleManualRefresh} className="mt-3">
          <RefreshCw className="mr-1 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <ContentPillarTrackerPanel
      className="-mx-2 border-y border-border"
      selectedMonth={selectedMonth}
      pillarData={pillarData}
      selectedFunnel={selectedFunnel}
      onSelectFunnel={setSelectedFunnel}
      headerActions={
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
      }
    />
  );
}

export function MobileFunnelSectionPulse({ className }: { className?: string } = {}) {
  return (
    <div className={cn("-mx-2 border-y border-border bg-card", className)}>
      <div className="border-b border-border px-3 py-2">
        <div className="h-4 w-44 animate-pulse rounded bg-muted/60" />
        <div className="mt-2 h-3 w-56 animate-pulse rounded bg-muted/40" />
      </div>
      <div className="grid grid-cols-3 gap-1 border-b border-border px-2 py-2">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-[5px] bg-muted/40" />
        ))}
      </div>
      <div className="space-y-3 px-3 py-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-4 w-32 animate-pulse rounded bg-muted/50" />
            <div className="h-3 w-full animate-pulse rounded bg-muted/30" />
            <div className="h-2 w-full animate-pulse rounded-full bg-muted/40" />
          </div>
        ))}
      </div>
    </div>
  );
}

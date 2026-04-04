import React, { useState } from 'react';
import { MoreVertical, Download, RefreshCw, Shield, Wifi } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useContentPillarData } from '../../hook/useContentPillarData';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

const FUNNEL_CONFIG = {
  top: {
    label: "TOP FUNNEL",
    name: "Awareness",
    color: "#10B981",
    bgColor: "#ECFDF5",
    emoji: "🟢"
  },
  middle: {
    label: "MIDDLE FUNNEL",
    name: "Consideration",
    color: "#F59E0B",
    bgColor: "#FFFBEB",
    emoji: "🟡"
  },
  bottom: {
    label: "BOTTOM FUNNEL",
    name: "Conversion",
    color: "#EF4444",
    bgColor: "#FEF2F2",
    emoji: "🔴"
  }
};

interface ContentPillarTrackerProps {
  selectedMonth?: Date;
  serviceFilter?: string;
}

export const ContentPillarTracker: React.FC<ContentPillarTrackerProps> = ({ selectedMonth, serviceFilter }) => {
  const [selectedFunnel, setSelectedFunnel] = useState<'top' | 'middle' | 'bottom'>('top');
  const {
    organizationId
  } = useCurrentOrg();
  const queryClient = useQueryClient();
  const {
    data: pillarData = [],
    isLoading,
    error,
    refetch
  } = useContentPillarData(selectedMonth, serviceFilter);

  const handleManualRefresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['contentPillarData', organizationId]
    });
    await queryClient.invalidateQueries({
      queryKey: ['social-media-plans', organizationId]
    });
    refetch();
    toast.success('Data refreshed');
  };

  const exportToCSV = () => {
    const csvContent = [['Pillar Name', 'Count', 'Funnel', 'Type'].join(','), ...pillarData.map(p => [`"${p.pillar_name}"`, p.count, p.funnel, p.isDefault ? 'Default' : 'Custom'].join(','))].join('\n');
    const blob = new Blob([csvContent], {
      type: 'text/csv'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `content-pillar-tracker-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Content pillar data exported successfully');
  };

  // Calculate funnel stats from pillarData (single source of truth - same as table filter)
  const funnelStats = React.useMemo(() => {
    const totalContent = pillarData.reduce((sum, p) => sum + p.count, 0);
    const funnelCounts = { top: 0, middle: 0, bottom: 0 };
    pillarData.forEach(p => {
      funnelCounts[p.funnel] += p.count;
    });
    return {
      total: totalContent,
      top: {
        count: funnelCounts.top,
        percentage: totalContent > 0 ? Math.round((funnelCounts.top / totalContent) * 100) : 0
      },
      middle: {
        count: funnelCounts.middle,
        percentage: totalContent > 0 ? Math.round((funnelCounts.middle / totalContent) * 100) : 0
      },
      bottom: {
        count: funnelCounts.bottom,
        percentage: totalContent > 0 ? Math.round((funnelCounts.bottom / totalContent) * 100) : 0
      }
    };
  }, [pillarData]);

  if (isLoading) {
    return <div className="w-full rounded-[5px] border border-gray-200 bg-white shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Content Pillar Tracker</h3>
          <p className="text-sm text-gray-600">Loading...</p>
        </div>
        <div className="p-4">
          <div className="animate-pulse space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-200 rounded"></div>)}
          </div>
        </div>
      </div>;
  }

  if (error) {
    return <div className="w-full rounded-[5px] border border-gray-200 bg-white shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Content Pillar Tracker</h3>
          <p className="text-sm text-red-600">Error loading data</p>
        </div>
        <div className="p-4">
          <Button variant="outline" size="sm" onClick={handleManualRefresh} className="mt-2">
            <RefreshCw className="h-4 w-4 mr-1" />
            Retry
          </Button>
        </div>
      </div>;
  }

  // Filter data by selected funnel
  const filteredPillars = pillarData.filter(pillar => pillar.funnel === selectedFunnel);
  const selectedConfig = FUNNEL_CONFIG[selectedFunnel];

  // Count pillars by funnel for tabs
  const topCount = pillarData.filter(p => p.funnel === 'top').length;
  const middleCount = pillarData.filter(p => p.funnel === 'middle').length;
  const bottomCount = pillarData.filter(p => p.funnel === 'bottom').length;

  return <div className="flex h-full min-h-0 w-full flex-col rounded-[5px] border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-gray-200 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">Content Pillar Tracker</h3>
            <div className="flex items-center gap-1 rounded-[5px] bg-success-muted px-2 py-1 text-xs text-success-foreground">
              <Wifi className="h-3 w-3 shrink-0 text-success" />
              Live
            </div>
          </div>
          <div className="text-sm text-gray-600 mb-2">
            {selectedMonth ? 'Selected' : 'Current'} Month Distribution ({(selectedMonth || new Date()).toLocaleDateString('en-US', {
              month: 'short',
              year: 'numeric'
            })}) - Total: {funnelStats.total} content
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

      {/* Funnel Tabs - Fixed layout to prevent overlap */}
      <div className="p-2 border-b border-gray-100 flex-shrink-0">
        <div className="grid grid-cols-3 gap-1">
          <button type="button" onClick={() => setSelectedFunnel('top')} className={`flex flex-col items-center rounded-[5px] px-1 py-2 text-xs font-medium transition-colors ${selectedFunnel === 'top' ? 'border border-green-200 bg-green-100 text-green-800' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
            <div className="mb-1 text-sm font-semibold text-green-600">
              {funnelStats.top.percentage}% ({funnelStats.top.count})
            </div>
            <span className="text-center leading-tight">Awareness</span>
          </button>
          
          <button type="button" onClick={() => setSelectedFunnel('middle')} className={`flex flex-col items-center rounded-[5px] px-1 py-2 text-xs font-medium transition-colors ${selectedFunnel === 'middle' ? 'border border-yellow-200 bg-yellow-100 text-yellow-800' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
            <div className="text-sm font-semibold text-yellow-600 mb-1">
              {funnelStats.middle.percentage}% ({funnelStats.middle.count})
            </div>
            <span className="text-center leading-tight">Consideration</span>
          </button>
          
          <button type="button" onClick={() => setSelectedFunnel('bottom')} className={`flex flex-col items-center rounded-[5px] px-1 py-2 text-xs font-medium transition-colors ${selectedFunnel === 'bottom' ? 'border border-red-200 bg-red-100 text-red-800' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
            <div className="text-sm font-semibold text-red-600 mb-1">
              {funnelStats.bottom.percentage}% ({funnelStats.bottom.count})
            </div>
            <span className="text-center leading-tight">Conversion</span>
          </button>
        </div>
      </div>

      {/* Konten daftar pillar — scroll di TabsContent (sama seperti tab Reminders), satu scroll per panel */}
      <div className="px-2 pb-2">
        <div className="mb-3 mt-3 rounded-[5px] px-3 py-2 text-sm font-medium" style={{
        backgroundColor: selectedConfig.bgColor,
        color: selectedConfig.color
      }}>
          {selectedConfig.label} - {selectedConfig.name}
          <span className="ml-2 text-gray-600">{filteredPillars.length} pillars</span>
        </div>

        <div className="space-y-3">
          {filteredPillars.length === 0 ? <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No pillars found for {selectedConfig.name}</p>
            </div> : filteredPillars.map(pillar => <div key={pillar.pillar_id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-sm font-medium text-gray-900">
                      {pillar.pillar_name}
                    </span>
                    {pillar.isDefault && <div className="flex items-center">
                        <Shield className="h-3 w-3 text-blue-500" />
                        <span className="text-xs text-blue-600 ml-1">Default</span>
                      </div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {pillar.count}
                    </span>
                    <span>{selectedConfig.emoji}</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full transition-all duration-300 rounded-full" style={{
              width: `${Math.min(pillar.count / 10 * 100, 100)}%`,
              backgroundColor: selectedConfig.color
            }} />
                </div>
              </div>)}
        </div>
      </div>

    </div>;
};
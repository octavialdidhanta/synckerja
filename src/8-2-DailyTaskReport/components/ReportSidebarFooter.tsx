import React, { useMemo } from "react";
import { AlertTriangle, Clock, RefreshCw } from "lucide-react";
import { useDailyTaskReport } from "../context/ReportContext";

export const ReportSidebarFooter = () => {
  const { filteredBlockers: blockers, filteredRecentUpdates: recentUpdates, loading } = useDailyTaskReport();
  const stats = useMemo(() => {
    const totalBlockers = blockers?.length || 0;
    const unresolvedBlockers = blockers?.filter((b: any) => !b.is_resolved).length || 0;
    const resolvedBlockers = totalBlockers - unresolvedBlockers;
    const updatesCount = recentUpdates?.length || 0;
    return { totalBlockers, unresolvedBlockers, resolvedBlockers, updatesCount };
  }, [blockers, recentUpdates]);

  if (loading) {
    return <div className="flex-shrink-0 border-t border-brand-blue/15 bg-brand-blue/[0.06] px-4 py-3 text-center text-xs text-gray-500">Loading statistics...</div>;
  }

  return (
    <div className="relative z-10 flex-shrink-0 border-t border-brand-blue/15 bg-brand-blue/[0.05] px-4 py-3 shadow-[0_-1px_3px_0_rgba(37,99,235,0.08)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span className="text-xs font-semibold text-gray-800">Blockers: {stats.totalBlockers}</span>
          {stats.unresolvedBlockers > 0 && <span className="text-xs text-red-600 font-medium">({stats.unresolvedBlockers} unresolved)</span>}
        </div>
        {stats.updatesCount > 0 && (
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-brand-blue" />
            <span className="text-xs text-gray-700">Updates: {stats.updatesCount}</span>
          </div>
        )}
      </div>
      {stats.resolvedBlockers > 0 && (
        <div className="flex items-center justify-start mt-1">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-green-600" />
            <span className="text-xs text-gray-600">Resolved: {stats.resolvedBlockers}</span>
          </div>
        </div>
      )}
    </div>
  );
};

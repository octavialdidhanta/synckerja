import React, { useMemo } from "react";
import { AlertCircle, CheckCircle, ClipboardList, Clock } from "lucide-react";
import { useDailyTaskReport } from "../context/ReportContext";

export const ReportMainFooter = () => {
  const { filtered: rows, loading } = useDailyTaskReport();
  const stats = useMemo(() => {
    const total = rows?.length || 0;
    const completed = (rows || []).filter((r) => r.isCompleted).length;
    const onTime = (rows || []).filter((r) => r.isCompleted && r.isOnTime === true).length;
    const late = (rows || []).filter((r) => r.isCompleted && r.isOnTime === false).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const onTimeRate = completed > 0 ? Math.round((onTime / completed) * 100) : 0;
    return { total, completed, onTime, late, completionRate, onTimeRate };
  }, [rows]);

  if (loading) {
    return <div className="flex-shrink-0 border-t border-brand-blue/15 bg-brand-blue/[0.06] px-4 py-3 text-center text-xs text-gray-500">Loading statistics...</div>;
  }

  return (
    <div className="relative z-10 flex-shrink-0 border-t border-brand-blue/15 bg-brand-blue/[0.05] px-4 py-3 shadow-[0_-1px_3px_0_rgba(37,99,235,0.08)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-brand-blue" />
            <span className="text-xs font-semibold text-gray-800">Total: {stats.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-xs text-gray-700">Completed: {stats.completed} ({stats.completionRate}%)</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {stats.completed > 0 && (
            <>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-brand-blue" />
                <span className="text-xs text-gray-700">On-time: {stats.onTime} ({stats.onTimeRate}%)</span>
              </div>
              {stats.late > 0 && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span className="text-xs text-gray-700">Late: {stats.late}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

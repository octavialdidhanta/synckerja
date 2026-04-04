import React from 'react';
import { Calendar, Clock, CheckCircle2, TrendingUp } from 'lucide-react';

interface RecentClientVisitsOverviewProps {
  visits: any[];
}

export const RecentClientVisitsOverview = ({ visits }: RecentClientVisitsOverviewProps) => {

  // Calculate real data from visits
  const scheduledVisits = visits.filter(v => v.status === 'scheduled').length;
  const ongoingVisits = visits.filter(v => v.status === 'ongoing').length;
  const completedVisits = visits.filter(v => v.status === 'completed').length;

  // Get unique statuses
  const uniqueStatuses = [...new Set(visits.map(v => v.status).filter(Boolean))];
  const totalStatuses = uniqueStatuses.length;

  // Get top status (status with most visits)
  const statusCounts = uniqueStatuses.map(status => ({
    name: status,
    count: visits.filter(v => v.status === status).length
  }));
  const topStatus = statusCounts.reduce((max, current) => 
    current.count > max.count ? current : max, statusCounts[0] || { name: 'N/A', count: 0 });

  // Calculate average visits per day (if we have visits with dates)
  const visitsWithDates = visits.filter(v => v.visit_date);
  const avgVisitsPerDay = visitsWithDates.length > 0
    ? visitsWithDates.reduce((sum, visit) => {
        // Simple calculation - could be improved
        return sum + 1;
      }, 0) / Math.max(1, new Set(visitsWithDates.map(v => v.visit_date)).size)
    : 0;

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-3">
        <div className="p-3 bg-brand-blue-soft rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-brand-blue-deep">Scheduled</p>
              <p className="text-lg font-bold text-brand-blue-deep">{scheduledVisits}</p>
            </div>
            <Calendar className="h-4 w-4 text-brand-blue" />
          </div>
        </div>
        
        <div className="p-3 bg-amber-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-amber-800">Ongoing</p>
              <p className="text-lg font-bold text-amber-900">{ongoingVisits}</p>
            </div>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
        </div>

        <div className="p-3 bg-green-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-green-800">Completed</p>
              <p className="text-lg font-bold text-green-900">{completedVisits}</p>
            </div>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </div>
        </div>
      </div>

      {/* Top Status */}
      <div>
        <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <TrendingUp className="h-3 w-3" />
          Top Status
        </h4>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 capitalize">
                {topStatus.name?.replace('_', ' ') || 'N/A'}
              </p>
              <p className="text-xs text-gray-500">{topStatus.count} visits</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Leading</p>
              <div className="w-2 h-2 bg-green-500 rounded-full mt-1"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Average Visits Per Day */}
      <div>
        <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Clock className="h-3 w-3" />
          Average Visits Per Day
        </h4>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {avgVisitsPerDay > 0 ? Math.round(avgVisitsPerDay * 10) / 10 : 'N/A'}
              </p>
              <p className="text-xs text-gray-500">Based on scheduled visits</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Avg</p>
              <div className="w-2 h-2 bg-brand-blue rounded-full mt-1"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Total Statuses */}
      <div>
        <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Calendar className="h-3 w-3" />
          Total Statuses
        </h4>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{totalStatuses}</p>
              <p className="text-xs text-gray-500">Active statuses</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Count</p>
              <div className="w-2 h-2 bg-purple-500 rounded-full mt-1"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

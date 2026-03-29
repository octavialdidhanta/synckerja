import React, { Suspense } from 'react';
import { PenaltyStatistics } from './PenaltyStatistics';
import { RecentPenaltiesWidget } from './RecentPenaltiesWidget';
import { PenaltyTrendsChart } from './PenaltyTrendsChart';
import { AttendanceAnalyticsDashboard } from './AttendanceAnalyticsDashboard';

const DashboardOverview = () => {
  return (
    <div className="space-y-2">
      {/* Penalty Statistics Section */}
      <Suspense fallback={<div className="p-4 text-center">Loading statistics...</div>}>
        <div className="space-y-2">
          <PenaltyStatistics />
        </div>
      </Suspense>

      {/* Main Content Grid */}
      <Suspense fallback={<div className="p-4 text-center">Loading widgets...</div>}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          {/* Left Column - Recent Penalties */}
          <div className="lg:col-span-1 h-full">
            <RecentPenaltiesWidget />
          </div>

          {/* Right Column - Trends */}
          <div className="lg:col-span-2">
            <PenaltyTrendsChart />
          </div>
        </div>
      </Suspense>

      {/* Full Analytics Dashboard */}
      <Suspense fallback={<div className="p-4 text-center">Loading analytics...</div>}>
        <div>
          <AttendanceAnalyticsDashboard />
        </div>
      </Suspense>
    </div>
  );
};

export default DashboardOverview;

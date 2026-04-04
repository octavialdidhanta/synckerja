import React from 'react';
import { Activity, TrendingUp, CheckCircle2, DollarSign, Clock, AlertCircle } from 'lucide-react';
import { formatToRupiah } from '@/shared/utils/formatCurrency';

interface SalesActivitiesOverviewProps {
  activities: any[];
}

export const SalesActivitiesOverview = ({ activities }: SalesActivitiesOverviewProps) => {
  // Calculate real data from activities
  const ongoingActivities = activities.filter(a => a.status === 'ongoing').length;
  const closedWonActivities = activities.filter(a => a.status === 'closed_won').length;
  const closedLostActivities = activities.filter(a => a.status === 'closed_lost').length;
  
  // Get unique activity types
  const uniqueTypes = [...new Set(activities.map(a => a.activity_type).filter(Boolean))];
  const totalTypes = uniqueTypes.length;

  // Get top activity type (type with most activities)
  const typeCounts = uniqueTypes.map(type => ({
    name: type,
    count: activities.filter(a => a.activity_type === type).length
  }));
  const topType = typeCounts.reduce((max, current) => 
    current.count > max.count ? current : max, typeCounts[0] || { name: 'N/A', count: 0 });

  // Calculate average deal size (if we have closed won activities)
  const closedWonWithAmount = activities.filter(a => 
    a.status === 'closed_won' && (a.total_amount || a.amount)
  );
  const avgDealSize = closedWonWithAmount.length > 0
    ? closedWonWithAmount.reduce((sum, activity) => 
        sum + (activity.total_amount || activity.amount || 0), 0) / closedWonWithAmount.length
    : 0;

  // Calculate total revenue
  const totalRevenue = activities
    .filter(a => a.status === 'closed_won')
    .reduce((sum, a) => sum + (a.total_amount || a.amount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-3">
        <div className="p-3 bg-brand-blue-soft rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-brand-blue-deep">Ongoing</p>
              <p className="text-lg font-bold text-brand-blue-deep">{ongoingActivities}</p>
            </div>
            <Activity className="h-4 w-4 text-brand-blue" />
          </div>
        </div>
        
        <div className="p-3 bg-green-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-green-800">Closed Won</p>
              <p className="text-lg font-bold text-green-900">{closedWonActivities}</p>
            </div>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </div>
        </div>

        <div className="p-3 bg-red-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-red-800">Closed Lost</p>
              <p className="text-lg font-bold text-red-900">{closedLostActivities}</p>
            </div>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </div>
        </div>
      </div>

      {/* Top Activity Type */}
      <div>
        <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <TrendingUp className="h-3 w-3" />
          Top Activity Type
        </h4>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 capitalize">
                {topType.name?.replace('_', ' ') || 'N/A'}
              </p>
              <p className="text-xs text-gray-500">{topType.count} activities</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Leading</p>
              <div className="w-2 h-2 bg-green-500 rounded-full mt-1"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Average Deal Size */}
      <div>
        <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <DollarSign className="h-3 w-3" />
          Average Deal Size
        </h4>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {avgDealSize > 0 ? formatToRupiah(avgDealSize) : 'N/A'}
              </p>
              <p className="text-xs text-gray-500">Based on closed won</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Avg</p>
              <div className="w-2 h-2 bg-brand-blue rounded-full mt-1"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Total Revenue */}
      <div>
        <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <DollarSign className="h-3 w-3" />
          Total Revenue
        </h4>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {formatToRupiah(totalRevenue)}
              </p>
              <p className="text-xs text-gray-500">From closed won deals</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Total</p>
              <div className="w-2 h-2 bg-green-500 rounded-full mt-1"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Total Activity Types */}
      <div>
        <h4 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Activity className="h-3 w-3" />
          Total Activity Types
        </h4>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{totalTypes}</p>
              <p className="text-xs text-gray-500">Active types</p>
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

import React from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { LoadingDots } from '@/shared/components/LoadingDots';
import { AlertTriangle, Target, TrendingUp, User } from 'lucide-react';

interface MetricsData {
  dailyOverdueContent: number;
  dailyCompletedContent: number;
  dailyRevisedContent: number;
  dailyTotalContent: number;
  monthlyOverdueContent: number;
  monthlyCompletedContent: number;
  monthlyRevisedContent: number;
  monthlyTotalContent: number;
}

interface SocialMediaMetricsProps {
  metrics: MetricsData;
  isLoading?: boolean;
}

export const SocialMediaMetrics = React.memo<SocialMediaMetricsProps>(({ metrics, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[120px] w-full">
        <LoadingDots size="lg" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Overdue Content</p>
            </div>
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Late Post:</span>
              <span className="text-lg font-bold">{metrics.dailyOverdueContent}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Upcoming Deadlines:</span>
              <span className="text-lg font-bold">{metrics.monthlyOverdueContent}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Completed Content</p>
            </div>
            <Target className="h-6 w-6 text-green-600" />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Daily:</span>
              <span className="text-lg font-bold">{metrics.dailyCompletedContent}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Monthly:</span>
              <span className="text-lg font-bold">{metrics.monthlyCompletedContent}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Under Revision</p>
            </div>
            <TrendingUp className="h-6 w-6 text-red-600" />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Daily:</span>
              <span className="text-lg font-bold">{metrics.dailyRevisedContent}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Monthly:</span>
              <span className="text-lg font-bold">{metrics.monthlyRevisedContent}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Total Content</p>
            </div>
            <User className="h-6 w-6 text-blue-600" />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Daily:</span>
              <span className="text-lg font-bold">{metrics.dailyTotalContent}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Monthly:</span>
              <span className="text-lg font-bold">{metrics.monthlyTotalContent}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

SocialMediaMetrics.displayName = 'SocialMediaMetrics';

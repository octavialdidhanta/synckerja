import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';
import { AlertTriangle, DollarSign, Users, TrendingDown } from 'lucide-react';
import { useAttendancePenalties } from './hooks/useAttendancePenalties';
interface PenaltyStatsProps {
  organizationId?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
}
export const PenaltyStatistics = ({
  organizationId,
  dateRange
}: PenaltyStatsProps) => {
  const {
    penalties,
    loading
  } = useAttendancePenalties();
  if (loading) {
    return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
        {[1, 2, 3, 4].map(i => <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-16 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>)}
      </div>;
  }

  // Filter penalties based on date range if provided
  const filteredPenalties = penalties.filter(penalty => {
    if (!dateRange) return true;
    const penaltyDate = new Date(penalty.applied_date);
    return penaltyDate >= dateRange.from && penaltyDate <= dateRange.to;
  });

  // Calculate statistics
  const totalPenalties = filteredPenalties.length;
  const activePenalties = filteredPenalties.filter(p => p.status === 'active').length;
  const waivedPenalties = filteredPenalties.filter(p => p.status === 'waived').length;
  const totalAmount = filteredPenalties.filter(p => p.status === 'active').reduce((sum, p) => sum + p.penalty_amount, 0);

  // Calculate trends (mock data for demonstration)
  const previousPeriodPenalties = Math.floor(totalPenalties * 0.8); // Mock 20% increase
  const penaltyTrend = totalPenalties > previousPeriodPenalties ? 'increase' : 'decrease';
  const trendPercentage = totalPenalties > 0 ? Math.abs((totalPenalties - previousPeriodPenalties) / totalPenalties * 100) : 0;
  const waiverRate = totalPenalties > 0 ? waivedPenalties / totalPenalties * 100 : 0;
  return <div className="space-y-2">
      

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
        {/* Total Penalties */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Penalties</p>
                <p className="text-2xl font-bold text-red-600">{totalPenalties}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {activePenalties} active, {waivedPenalties} waived
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        {/* Total Amount */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-orange-600">
                  Rp {totalAmount.toLocaleString('id-ID')}
                </p>
                <p className="text-xs text-gray-500 mt-1">Active penalties only</p>
              </div>
              <DollarSign className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        {/* Waiver Rate */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Waiver Rate</p>
                <p className="text-2xl font-bold text-blue-600">{waiverRate.toFixed(1)}%</p>
                <Progress value={waiverRate} className="mt-2 h-2" />
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        {/* Trend */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Monthly Trend</p>
                <p className={`text-2xl font-bold ${penaltyTrend === 'increase' ? 'text-red-600' : 'text-green-600'}`}>
                  {penaltyTrend === 'increase' ? '+' : '-'}{trendPercentage.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">vs last period</p>
              </div>
              <TrendingDown className={`h-8 w-8 ${penaltyTrend === 'increase' ? 'text-red-600' : 'text-green-600'}`} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>;
};
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';
import { AlertTriangle, DollarSign, Users, TrendingDown } from 'lucide-react';
import { useAttendancePenalties } from '../hooks/useAttendancePenalties';
import { attendanceLoadSectionIds, useReportAttendanceSection } from '@/2-3-attendance/context/AttendancePageLoadContext';
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
  useReportAttendanceSection(attendanceLoadSectionIds.dashboardPenalties, loading);
  if (loading) {
    return null;
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
                <p className="text-sm font-medium text-muted-foreground">Total Penalties</p>
                <p className="text-destructive text-2xl font-bold">{totalPenalties}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {activePenalties} active, {waivedPenalties} waived
                </p>
              </div>
              <AlertTriangle className="text-destructive h-8 w-8" />
            </div>
          </CardContent>
        </Card>

        {/* Total Amount */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
                <p className="text-warning text-2xl font-bold">
                  Rp {totalAmount.toLocaleString('id-ID')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Active penalties only</p>
              </div>
              <DollarSign className="text-warning h-8 w-8" />
            </div>
          </CardContent>
        </Card>

        {/* Waiver Rate */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Waiver Rate</p>
                <p className="text-primary text-2xl font-bold">{waiverRate.toFixed(1)}%</p>
                <Progress value={waiverRate} className="mt-2 h-2" />
              </div>
              <Users className="text-primary h-8 w-8" />
            </div>
          </CardContent>
        </Card>

        {/* Trend */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Monthly Trend</p>
                <p
                  className={`text-2xl font-bold ${penaltyTrend === 'increase' ? 'text-destructive' : 'text-success'}`}
                >
                  {penaltyTrend === 'increase' ? '+' : '-'}{trendPercentage.toFixed(1)}%
                </p>
                <p className="mt-1 text-xs text-muted-foreground">vs last period</p>
              </div>
              <TrendingDown
                className={`h-8 w-8 ${penaltyTrend === 'increase' ? 'text-destructive' : 'text-success'}`}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>;
};

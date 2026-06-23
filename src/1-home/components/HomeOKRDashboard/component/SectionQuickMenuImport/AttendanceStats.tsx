
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Progress } from '@/shared/components/ui/progress';
import { Timer, BarChart3, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { useEmployeeAttendanceStats } from './useEmployeeAttendanceStats';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

interface AttendanceStatsProps {
  workingHoursToday: string;
  /** Defer heavy monthly org stats until Quick Menu panel is shown (not while camera open). */
  loadMonthlyStats?: boolean;
}

export const AttendanceStats = ({
  workingHoursToday,
  loadMonthlyStats = true,
}: AttendanceStatsProps) => {
  const { t } = useAppTranslation();
  const { data: realStats, isLoading } = useEmployeeAttendanceStats({
    enabled: loadMonthlyStats,
  });
  
  // Use real data if available, otherwise show loading or default
  const stats = realStats || {
    attendanceRate: 0,
    presentDays: 0,
    lateDays: 0,
    leaveDays: 0
  };
  return (
    <>
      {/* Work Hours Today */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-2">
        <div className="flex items-center space-x-2">
          <Timer className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium">{t('quickMenu.totalWorkingHoursToday', 'Total Working Hours Today')}:</span>
        </div>
        <span className="text-sm font-bold text-primary">{workingHoursToday}</span>
      </div>

      {/* Statistics Section */}
      <Card className="mt-3">
        <CardHeader className="pb-1 px-2">
          <CardTitle className="flex items-center space-x-2 text-base font-semibold text-foreground">
            <BarChart3 className="h-4 w-4" />
            <span>{t('quickMenu.monthlyStats', 'Monthly Statistics')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-1 px-2 pb-2">
          {isLoading ? (
            <div className="h-32 rounded-md bg-muted/40 animate-pulse" aria-hidden />
          ) : (
          <div className="space-y-2">
            {/* Attendance Rate */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold">{t('quickMenu.attendance', 'Attendance')}</span>
                <span className="text-sm font-bold text-primary">{stats.attendanceRate}%</span>
              </div>
              <Progress value={stats.attendanceRate} className="h-2" />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 pt-0">
              <div className="rounded-lg bg-success-muted p-1 text-center">
                <div className="mb-1 flex items-center justify-center">
                  <CheckCircle className="mr-1 h-4 w-4 text-primary" />
                  <span className="text-lg font-bold text-primary">{stats.presentDays}</span>
                </div>
                <p className="text-xs font-medium text-success-foreground">{t('quickMenu.presentDays', 'Present Days')}</p>
              </div>
              
              <div className="rounded-lg bg-warning-muted p-1 text-center">
                <div className="mb-1 flex items-center justify-center">
                  <AlertCircle className="mr-1 h-4 w-4 text-brand-accent" />
                  <span className="text-lg font-bold text-brand-accent">{stats.lateDays}</span>
                </div>
                <p className="text-xs font-medium text-warning-foreground">{t('quickMenu.late', 'Late')}</p>
              </div>
              
              <div className="rounded-lg bg-info-muted p-1 text-center">
                <div className="mb-1 flex items-center justify-center">
                  <Calendar className="mr-1 h-4 w-4 text-primary" />
                  <span className="text-lg font-bold text-primary">{stats.leaveDays}</span>
                </div>
                <p className="text-xs font-medium text-info-foreground">{t('quickMenu.leave', 'Leave')}</p>
              </div>
            </div>
          </div>
          )}
        </CardContent>
      </Card>
    </>
  );
};


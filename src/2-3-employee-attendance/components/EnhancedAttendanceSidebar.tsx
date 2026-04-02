
import { useState, useEffect } from 'react';
import { User, TrendingUp, AlertTriangle, Plus, CheckCircle, Clock, Users, Keyboard, Eye, BarChart3, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { useAttendanceAnalytics } from '@/features/2-3-dashboard/hooks/useAttendanceAnalytics';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { attendanceLoadSectionIds, useReportAttendanceSection } from '@/2-3-attendance/context/AttendancePageLoadContext';

interface EnhancedAttendanceSidebarProps {
  selectedRows: string[];
  onKeyboardShortcutsToggle?: () => void;
}

export const EnhancedAttendanceSidebar = ({ 
  selectedRows, 
  onKeyboardShortcutsToggle 
}: EnhancedAttendanceSidebarProps) => {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { data: attendanceData, isPending, error } = useAttendanceAnalytics();
  useReportAttendanceSection(
    attendanceLoadSectionIds.attendanceSidebar,
    orgLoading || (!!organizationId && isPending),
  );
  
  const analytics = attendanceData?.analytics || {
    totalPresent: 0,
    totalLate: 0,
    totalAbsent: 0,
    totalWFH: 0,
    averageWorkHours: 0,
    attendanceRate: 0,
    flaggedRecords: 0
  };
  
  const spotlight = attendanceData?.spotlight;
  const alerts = attendanceData?.alerts || [];

  const quickActions = [
    { icon: Plus, label: 'Add Manual Entry', action: () => {}, color: 'blue' },
    { icon: CheckCircle, label: 'Bulk Approve', action: () => {}, color: 'green', disabled: selectedRows.length === 0 },
    { icon: AlertTriangle, label: 'Generate Report', action: () => {}, color: 'orange' },
    { icon: Users, label: 'Team Overview', action: () => {}, color: 'purple' },
    { icon: BarChart3, label: 'Analytics Dashboard', action: () => {}, color: 'indigo' },
    { icon: Calendar, label: 'Schedule View', action: () => {}, color: 'teal' }
  ];

  const keyboardShortcuts = [
    { key: '↑/↓', description: 'Navigate rows' },
    { key: 'Space', description: 'Toggle selection' },
    { key: 'Enter', description: 'Expand/collapse' },
    { key: 'Ctrl+A', description: 'Select all' },
    { key: 'Ctrl+E', description: 'Export' },
    { key: 'Esc', description: 'Clear selection' }
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-destructive';
      case 'medium':
        return 'bg-warning';
      case 'low':
        return 'bg-primary';
      default:
        return 'bg-muted-foreground';
    }
  };

  const getActionColor = (color: string) => {
    const colors: Record<string, string> = {
      blue: 'hover:bg-accent hover:text-accent-foreground',
      green: 'hover:bg-success-muted hover:text-success-foreground',
      orange: 'hover:bg-warning-muted hover:text-warning-foreground',
      purple: 'hover:bg-info-muted hover:text-info-foreground',
      indigo: 'hover:bg-accent hover:text-accent-foreground',
      teal: 'hover:bg-info-muted hover:text-info-foreground',
    };
    return colors[color] || 'hover:bg-muted hover:text-foreground';
  };

  if (isPending) {
    return null;
  }

  return (
    <div className="w-full space-y-2">
      {/* Live Analytics Dashboard */}
      <Card>
        <CardHeader className="pb-1 pt-3 px-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Live Analytics
            <div className="bg-success h-2 w-2 animate-pulse rounded-full" title="Live updates" />
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <div className="bg-success-muted relative rounded p-1.5 text-center">
              <div className="text-success text-lg font-bold">{analytics.totalPresent}</div>
              <div className="text-muted-foreground text-xs">Present</div>
              <div className="bg-success absolute right-0.5 top-0.5 h-1.5 w-1.5 animate-pulse rounded-full opacity-80" />
            </div>
            <div className="bg-warning-muted rounded p-1.5 text-center">
              <div className="text-warning text-lg font-bold">{analytics.totalLate}</div>
              <div className="text-muted-foreground text-xs">Late</div>
            </div>
            <div className="bg-destructive/10 rounded p-1.5 text-center">
              <div className="text-destructive text-lg font-bold">{analytics.totalAbsent}</div>
              <div className="text-muted-foreground text-xs">Absent</div>
            </div>
            <div className="bg-info-muted rounded p-1.5 text-center">
              <div className="text-primary text-lg font-bold">{analytics.totalWFH}</div>
              <div className="text-muted-foreground text-xs">WFH</div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-muted-foreground">Attendance Rate</span>
                <span className="font-medium">{analytics.attendanceRate.toFixed(1)}%</span>
              </div>
              <Progress value={analytics.attendanceRate} className="h-1.5" />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-muted-foreground">Avg. Work Hours</span>
                <span className="font-medium">{analytics.averageWorkHours}h</span>
              </div>
              <Progress value={(analytics.averageWorkHours / 8) * 100} className="h-1.5" />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-muted-foreground">Flagged Records</span>
                <span className="text-warning font-medium">{analytics.flaggedRecords}</span>
              </div>
              <Progress value={(analytics.flaggedRecords / 20) * 100} className="bg-warning-muted h-1.5" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee Spotlight with Enhanced Info */}
      {spotlight && (
        <Card>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Employee Spotlight
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-1.5">
            <div className="bg-accent flex items-center space-x-2 rounded border border-primary/20 p-1.5">
              <Avatar className="h-7 w-7 ring-1 ring-primary/25">
                <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                  {spotlight.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="text-sm font-medium">{spotlight.full_name}</div>
                <div className="text-muted-foreground text-xs">{spotlight.department}</div>
                {spotlight.isLate && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Badge className="border-warning/30 bg-warning-muted px-1 py-0 text-xs text-warning-foreground">
                      ⚠️ Late
                    </Badge>
                    {spotlight.lateMinutes && (
                      <span className="text-muted-foreground text-xs">{spotlight.lateMinutes} min</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-muted/50 space-y-0.5 rounded p-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Today's Hours:</span>
                <span className="font-medium">{spotlight.todayHours.toFixed(1)}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">This Week:</span>
                <span className="font-medium">{spotlight.weekHours.toFixed(1)}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Performance Score:</span>
                <span className="text-success font-medium">{spotlight.attendanceScore}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant="outline" className="text-xs py-0 px-1 h-4">
                  {spotlight.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Real-time Alerts & Notifications */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Live Alerts
              <Badge className="bg-destructive/15 text-destructive px-1 py-0 text-xs">{alerts.filter(a => a.severity === 'high').length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <ScrollArea className="h-24">
              <div className="space-y-1.5">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="hover:bg-muted/80 flex items-start space-x-1.5 rounded bg-muted/50 p-1.5 transition-colors"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full mt-1 ${getSeverityColor(alert.severity)}`} />
                    <div className="flex-1">
                      <div className="text-foreground text-xs">{alert.message}</div>
                      <div className="flex items-center justify-between mt-0.5">
                        <div className="text-muted-foreground text-xs">{alert.time}</div>
                        <Badge variant="outline" className="text-xs py-0 px-1 h-4">
                          {alert.severity}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Quick Actions */}
      <Card>
        <CardHeader className="pb-1 pt-3 px-3">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            Quick Actions
            {selectedRows.length > 0 && (
              <Badge className="bg-primary px-1 py-0 text-xs text-primary-foreground">
                {selectedRows.length} selected
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-0.5">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              variant="ghost"
              size="sm"
              className={`w-full justify-start text-xs h-7 px-2 transition-colors ${getActionColor(action.color)} ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={action.action}
              disabled={action.disabled}
            >
              <action.icon className="mr-1.5 h-3 w-3" />
              {action.label}
              {action.disabled && (
                <span className="text-muted-foreground ml-auto text-xs">No selection</span>
              )}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Keyboard Shortcuts Helper */}
      <Card>
        <CardHeader className="pb-1 pt-3 px-3">
          <CardTitle className="text-sm font-medium">Keyboard Shortcuts</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="w-full text-xs h-7 px-2">
                <Keyboard className="mr-1.5 h-3 w-3" />
                View Shortcuts
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Keyboard Shortcuts</h4>
                {keyboardShortcuts.map((shortcut, index) => (
                  <div key={index} className="flex justify-between text-xs">
                    <kbd className="bg-muted rounded px-2 py-1 font-mono text-xs">
                      {shortcut.key}
                    </kbd>
                    <span className="text-muted-foreground">{shortcut.description}</span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader className="pb-1 pt-3 px-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Eye className="h-4 w-4" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-0.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Real-time Updates</span>
            <div className="flex items-center gap-1">
              <div className="bg-success h-1.5 w-1.5 animate-pulse rounded-full" />
              <span className="text-success font-medium">Active</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Last Sync</span>
            <span className="font-medium">Just now</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Data Freshness</span>
            <Badge className="bg-success-muted text-success-foreground h-4 px-1 py-0 text-xs">
              {error ? 'Error' : 'Fresh'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

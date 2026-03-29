
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

interface EnhancedAttendanceSidebarProps {
  selectedRows: string[];
  onKeyboardShortcutsToggle?: () => void;
}

export const EnhancedAttendanceSidebar = ({ 
  selectedRows, 
  onKeyboardShortcutsToggle 
}: EnhancedAttendanceSidebarProps) => {
  // Use real attendance analytics data
  const { data: attendanceData, isLoading, error } = useAttendanceAnalytics();
  
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
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getActionColor = (color: string) => {
    const colors = {
      blue: 'hover:bg-blue-50 hover:text-blue-700',
      green: 'hover:bg-green-50 hover:text-green-700',
      orange: 'hover:bg-orange-50 hover:text-orange-700',
      purple: 'hover:bg-purple-50 hover:text-purple-700',
      indigo: 'hover:bg-indigo-50 hover:text-indigo-700',
      teal: 'hover:bg-teal-50 hover:text-teal-700'
    };
    return colors[color as keyof typeof colors] || 'hover:bg-gray-50';
  };

  if (isLoading) {
    return (
      <div className="w-full space-y-2">
        <Card>
          <CardContent className="p-2">
            <div className="animate-pulse space-y-1.5">
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="h-10 bg-gray-200 rounded"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      {/* Live Analytics Dashboard */}
      <Card>
        <CardHeader className="pb-1 pt-3 px-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Live Analytics
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Live updates" />
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <div className="text-center p-1.5 bg-green-50 rounded relative">
              <div className="text-lg font-bold text-green-600">{analytics.totalPresent}</div>
              <div className="text-xs text-gray-600">Present</div>
              <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            </div>
            <div className="text-center p-1.5 bg-yellow-50 rounded">
              <div className="text-lg font-bold text-yellow-600">{analytics.totalLate}</div>
              <div className="text-xs text-gray-600">Late</div>
            </div>
            <div className="text-center p-1.5 bg-red-50 rounded">
              <div className="text-lg font-bold text-red-600">{analytics.totalAbsent}</div>
              <div className="text-xs text-gray-600">Absent</div>
            </div>
            <div className="text-center p-1.5 bg-blue-50 rounded">
              <div className="text-lg font-bold text-blue-600">{analytics.totalWFH}</div>
              <div className="text-xs text-gray-600">WFH</div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-gray-500">Attendance Rate</span>
                <span className="font-medium">{analytics.attendanceRate.toFixed(1)}%</span>
              </div>
              <Progress value={analytics.attendanceRate} className="h-1.5" />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-gray-500">Avg. Work Hours</span>
                <span className="font-medium">{analytics.averageWorkHours}h</span>
              </div>
              <Progress value={(analytics.averageWorkHours / 8) * 100} className="h-1.5" />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-gray-500">Flagged Records</span>
                <span className="font-medium text-orange-600">{analytics.flaggedRecords}</span>
              </div>
              <Progress value={(analytics.flaggedRecords / 20) * 100} className="h-1.5 bg-orange-100" />
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
            <div className="flex items-center space-x-2 p-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded border border-blue-100">
              <Avatar className="h-7 w-7 ring-1 ring-blue-200">
                <AvatarFallback className="bg-blue-100 text-blue-600 text-xs font-semibold">
                  {spotlight.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="text-sm font-medium">{spotlight.full_name}</div>
                <div className="text-xs text-gray-500">{spotlight.department}</div>
                {spotlight.isLate && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Badge className="bg-yellow-100 text-yellow-800 text-xs border border-yellow-200 px-1 py-0">
                      ⚠️ Late
                    </Badge>
                    {spotlight.lateMinutes && (
                      <span className="text-xs text-gray-500">{spotlight.lateMinutes} min</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="text-xs space-y-0.5 bg-gray-50 p-1.5 rounded">
              <div className="flex justify-between">
                <span className="text-gray-500">Today's Hours:</span>
                <span className="font-medium">{spotlight.todayHours.toFixed(1)}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">This Week:</span>
                <span className="font-medium">{spotlight.weekHours.toFixed(1)}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Performance Score:</span>
                <span className="font-medium text-green-600">{spotlight.attendanceScore}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status:</span>
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
              <Badge className="bg-red-100 text-red-700 text-xs px-1 py-0">{alerts.filter(a => a.severity === 'high').length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <ScrollArea className="h-24">
              <div className="space-y-1.5">
                {alerts.map((alert) => (
                  <div key={alert.id} className="flex items-start space-x-1.5 p-1.5 rounded bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1 ${getSeverityColor(alert.severity)}`} />
                    <div className="flex-1">
                      <div className="text-xs text-gray-900">{alert.message}</div>
                      <div className="flex items-center justify-between mt-0.5">
                        <div className="text-xs text-gray-500">{alert.time}</div>
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
              <Badge className="bg-blue-600 text-white text-xs px-1 py-0">
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
                <span className="ml-auto text-xs text-gray-400">No selection</span>
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
                    <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                      {shortcut.key}
                    </kbd>
                    <span className="text-gray-600">{shortcut.description}</span>
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
            <span className="text-gray-500">Real-time Updates</span>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-green-600 font-medium">Active</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Last Sync</span>
            <span className="font-medium">Just now</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Data Freshness</span>
            <Badge className="bg-green-100 text-green-700 text-xs px-1 py-0 h-4">
              {isLoading ? 'Loading' : error ? 'Error' : 'Fresh'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

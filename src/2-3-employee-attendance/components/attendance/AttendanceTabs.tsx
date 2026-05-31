import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { AttendanceSettings } from '@/features/2-3-settings';
import { DashboardOverview } from '@/features/2-3-dashboard';
import { EmployeeAttendanceTab } from '@/features/2-3-employee-attendance';
import AttendanceAnalytics from './AttendanceAnalytics';
import { BarChart3, Users, Settings } from 'lucide-react';

export const AttendanceTabs = () => {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="employee-attendance" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Employee
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <DashboardOverview />
        </TabsContent>

        <TabsContent value="employee-attendance" className="space-y-4">
          <EmployeeAttendanceTab />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <AttendanceAnalytics />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <AttendanceSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

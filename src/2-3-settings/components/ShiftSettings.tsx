import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Clock, Users, Settings } from 'lucide-react';
import { ShiftManagement } from './ShiftManagement';
import { EmployeeShiftAssignment } from './EmployeeShiftAssignment';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

export const ShiftSettings = () => {
  const { t } = useAppTranslation();
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t('shiftSettings.title', 'Employee Shift Settings')}</h2>
          <p className="text-sm text-gray-600">{t('shiftSettings.description', 'Manage work shifts and employee assignments')}</p>
        </div>
      </div>

      <Tabs defaultValue="shifts" className="w-full">
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {t(
            'shiftSettings.priorityBanner',
            'Employee shifts override check-in/out times. Working days and timezone follow Work Schedule settings.',
          )}
        </div>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="shifts" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {t('shiftSettings.tab.masterShift', 'Master Shift')}
          </TabsTrigger>
          <TabsTrigger value="assignments" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t('shiftSettings.tab.employeeAssignment', 'Employee Assignment')}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="shifts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('shiftSettings.shiftManagement.title', 'Shift Management')}</CardTitle>
              <CardDescription>
                {t('shiftSettings.shiftManagement.description', 'Create and manage master work shift data for your organization')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ShiftManagement />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('shiftSettings.employeeAssignment.title', 'Employee Shift Assignment')}</CardTitle>
              <CardDescription>
                {t('shiftSettings.employeeAssignment.description', 'Assign employees to appropriate work shifts')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmployeeShiftAssignment />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Users, Settings } from 'lucide-react';
import { ShiftManagement } from './ShiftManagement';
import { EmployeeShiftAssignment } from './EmployeeShiftAssignment';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

export const ShiftSettings = () => {
  const { t } = useAppTranslation();

  return (
    <Tabs defaultValue="shifts" className="flex h-full min-h-0 w-full flex-col gap-3">
      <TabsList className="grid w-full shrink-0 grid-cols-2">
        <TabsTrigger value="shifts" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          {t('shiftSettings.tab.masterShift', 'Master Shift')}
        </TabsTrigger>
        <TabsTrigger value="assignments" className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          {t('shiftSettings.tab.employeeAssignment', 'Employee Assignment')}
        </TabsTrigger>
      </TabsList>

      <div className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        {t(
          'shiftSettings.priorityBanner',
          'Employee shifts override check-in/out times. Working days and timezone follow Work Schedule settings.',
        )}
      </div>

      <TabsContent
        value="shifts"
        className="mt-0 flex min-h-0 flex-1 flex-col outline-none data-[state=inactive]:hidden"
      >
        <ShiftManagement />
      </TabsContent>

      <TabsContent
        value="assignments"
        className="mt-0 flex min-h-0 flex-1 flex-col outline-none data-[state=inactive]:hidden"
      >
        <EmployeeShiftAssignment />
      </TabsContent>
    </Tabs>
  );
};

import React from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { User, Calendar, Home, Coffee } from 'lucide-react';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { useEmployeeLeaveBalance } from '@/2-1-employees/MyInfo/LeavePermit/hooks/useEmployeeLeaveBalance';
import { SectionQuickMenu } from './HomeOKRDashboard/component/SectionQuickMenu';
import { EmployeeProfilePhoto } from '@/shared/components/EmployeeProfilePhoto';
import { useAvatarSync } from '@/2-1-employees/MyInfo/PersonalInformation/hooks/useAvatarSync';
import { useUserData } from '@/shared/auth/hooks/useUserData';
import { useTeamAvailability } from './useTeamAvailability';
import { toast } from 'sonner';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { applyVariables } from '@/shared/i18n/translations';
import { format } from 'date-fns';
import { useReportHomeSectionStatus } from '@/1-home/context/HomePageLoadContext';

export const SectionProfile = () => {
  const { t, dateFnsLocale } = useAppTranslation();
  const {
    data: employeeData,
    isLoading,
    error: employeeError,
    refetch: refetchEmployee
  } = useCurrentEmployee();
  const {
    data: leaveBalance,
    isLoading: leaveBalanceLoading,
    error: leaveBalanceError,
  } = useEmployeeLeaveBalance();
  const { profile, userRole, loading: userDataLoading } = useUserData();
  const { syncAvatarAcrossApp } = useAvatarSync();
  const {
    data: teamAvailability,
    isLoading: isTeamLoading,
    error: teamAvailabilityError,
  } = useTeamAvailability();

  const profileSectionLoading =
    isLoading || isTeamLoading || userDataLoading || leaveBalanceLoading;
  const profileSectionError =
    (employeeError as Error | null | undefined) ||
    (teamAvailabilityError as Error | null | undefined) ||
    (leaveBalanceError as Error | null | undefined) ||
    null;
  useReportHomeSectionStatus(
    'profile',
    profileSectionLoading,
    profileSectionError instanceof Error
      ? profileSectionError
      : profileSectionError
        ? new Error(String(profileSectionError))
        : null,
  );

  // Default data for fallback
  const defaultData = {
    name: "User",
    position: "Employee",
    division: "Development",
    workStatus: "WFO",
    remainingLeave: 12,
    perfectAttendance: true
  };

  // Get user role display text
  const getRoleDisplayText = (role: string | null) => {
    switch (role) {
      case 'owner':
        return t('profile.role.owner', 'Owner');
      case 'admin':
        return t('profile.role.admin', 'Admin');
      case 'employee':
        return t('profile.role.employee', 'Employee');
      default:
        return defaultData.position;
    }
  };

  // Use real data if available, prioritizing profile data like header components
  const currentUser = {
    name: isLoading ? "Loading..." : (profile?.full_name || employeeData?.full_name || defaultData.name),
    position: getRoleDisplayText(userRole),
    division: isLoading ? "Loading..." : (employeeData?.departments?.name || defaultData.division),
    workStatus: defaultData.workStatus,
    remainingLeave: leaveBalance?.remainingLeave ?? employeeData?.leave_balance ?? defaultData.remainingLeave,
    totalLeave: leaveBalance?.totalAnnualLeave ?? 12,
    perfectAttendance: defaultData.perfectAttendance,
    photoUrl: employeeData?.profile_photo_url
  };

  // Removed excessive debug logging for performance

  const handlePhotoUpdate = async (photoUrl: string | null) => {
    try {
      const loadingToast = toast.loading(t('profile.updatingPhoto', 'Updating profile photo...'));
      const result = await syncAvatarAcrossApp(photoUrl);
      toast.dismiss(loadingToast);
      if (result?.success) {
        refetchEmployee();
        toast.success(t('profile.photoUpdatedSuccess', 'Profile photo updated successfully across the app! ðŸŽ‰'));
      } else {
        toast.error(t('profile.failedToSyncPhoto', 'Failed to sync photo across the app'));
      }
    } catch {
      toast.error(t('profile.failedToUpdatePhoto', 'Failed to update profile photo'));
    }
  };

  if (profileSectionLoading) {
    return null;
  }


  if (profileSectionError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-card p-4 text-sm text-destructive">
        {profileSectionError instanceof Error
          ? profileSectionError.message
          : String(profileSectionError)}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full gap-2">
        {/* Profile Card */}
        <Card className="p-4 flex-shrink-0">
          <CardContent className="p-0">
            <div className="flex items-center space-x-3 mb-4">
              <EmployeeProfilePhoto
                employeeName={currentUser.name}
                employeeId={employeeData?.id}
                photoUrl={currentUser.photoUrl}
                size="sm"
                onPhotoUpdate={handlePhotoUpdate}
              />
              <div>
                <h3 className="text-base font-semibold text-gray-900 leading-snug">{currentUser.name}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{currentUser.position}</p>
                <p className="text-xs text-gray-500 leading-normal">{currentUser.division}</p>
              </div>
            </div>
            
            {/* Employee Info */}
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4" />
                  <span className="text-xs text-gray-700 leading-relaxed">{t('profile.employeeId', 'Employee ID')}:</span>
                </div>
                <span className="text-xs font-semibold leading-normal text-primary">{employeeData?.employee_id || t('common.notAvailable', 'N/A')}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4" />
                  <span className="text-xs text-gray-700 leading-relaxed">{t('profile.joinDate', 'Join Date')}:</span>
                </div>
                <span className="text-xs font-semibold leading-normal text-foreground">
                  {employeeData?.join_date || employeeData?.hire_date 
                    ? format(new Date(employeeData.join_date || employeeData.hire_date), "dd/MM/yyyy", { locale: dateFnsLocale })
                    : t('common.notAvailable', 'N/A')
                  }
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Coffee className="h-4 w-4" />
                  <span className="text-xs text-gray-700 leading-relaxed">{t('profile.remainingLeave', 'Remaining Leave')}:</span>
                </div>
                <span className="text-xs font-semibold leading-normal text-brand-accent">
                  {applyVariables(t('profile.leaveBalance', '{{remaining}} days from {{total}} days/year'), {
                    remaining: String(currentUser.remainingLeave),
                    total: String(currentUser.totalLeave)
                  })}
                </span>
              </div>

              {employeeData?.branch_id && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Home className="h-4 w-4" />
                    <span className="text-sm">{t('profile.branch', 'Branch')}:</span>
                  </div>
                  <span className="font-semibold text-primary">{t('profile.headOffice', 'Head Office')}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Absensi Online - Flex Grow untuk mengisi sisa space */}
        <div className="flex-1 min-h-0">
          <SectionQuickMenu 
            isTeamLoading={isTeamLoading}
            displayTeamData={teamAvailability || []}
          />
        </div>

      </div>
    </>
  );
};


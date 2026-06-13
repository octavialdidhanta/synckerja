import React, { lazy, Suspense } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { User, Calendar, Home, Coffee } from 'lucide-react';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { useEmployeeLeaveBalance } from '@/2-1-employees/MyInfo/LeavePermit/hooks/useEmployeeLeaveBalance';
import { EmployeeProfilePhoto } from '@/shared/components/EmployeeProfilePhoto';
import { useAvatarSync } from '@/2-1-employees/MyInfo/PersonalInformation/hooks/useAvatarSync';
import { useUserData } from '@/shared/auth/hooks/useUserData';
import { useProfile } from '@/shared/hooks/useProfile';
import { useTeamAvailability } from './useTeamAvailability';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { applyVariables } from '@/shared/i18n/translations';
import { format } from 'date-fns';
import { useReportHomeSectionStatus } from '@/1-home/context/HomePageLoadContext';
import { isBootstrapPending } from '@/shared/lib/loadingBootstrap';

const SectionQuickMenu = lazy(() =>
  import('./HomeOKRDashboard/component/SectionQuickMenu').then((m) => ({
    default: m.SectionQuickMenu,
  })),
);

function ProfileColumnSkeleton() {
  return (
    <div className="flex h-full flex-col gap-2" aria-hidden>
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </Card>
      <Skeleton className="min-h-[200px] flex-1 rounded-lg" />
    </div>
  );
}

function QuickMenuPlaceholder() {
  return <Skeleton className="min-h-[200px] w-full flex-1 rounded-lg" aria-hidden />;
}

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
  const { profile, userRole, loading: userDataLoading, refreshUserData } = useUserData();
  const { data: profileRow, refetch: refetchProfile, isLoading: profileQueryLoading } = useProfile();
  const { syncAvatarAcrossApp } = useAvatarSync();
  const {
    data: teamAvailability,
    isLoading: isTeamLoading,
    error: teamAvailabilityError,
  } = useTeamAvailability();

  const hasEmployee = employeeData != null;
  const hasProfileContent = profile != null || profileRow != null;
  const hasLeaveBalance = leaveBalance != null;
  const hasTeamAvailability = teamAvailability != null;

  const profileSectionLoading =
    isBootstrapPending(isLoading, hasEmployee) ||
    (userDataLoading && !hasProfileContent) ||
    isBootstrapPending(profileQueryLoading, hasProfileContent) ||
    isBootstrapPending(leaveBalanceLoading, hasLeaveBalance) ||
    isBootstrapPending(isTeamLoading, hasTeamAvailability);
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
    // Same query as header (`useProfile` → user_profile_details + employees)
    photoUrl:
      profileRow?.profile_photo_url ||
      profile?.profile_photo_url ||
      employeeData?.profile_photo_url ||
      null,
  };

  // Removed excessive debug logging for performance

  const handlePhotoUpdate = async (photoUrl: string | null) => {
    try {
      const { toast } = await import("sonner");
      const loadingToast = toast.loading(t('profile.updatingPhoto', 'Updating profile photo...'));
      const result = await syncAvatarAcrossApp(photoUrl);
      toast.dismiss(loadingToast);
      if (result?.success) {
        await Promise.all([refetchEmployee(), refreshUserData(), refetchProfile()]);
        toast.success(t('profile.photoUpdatedSuccess', 'Profile photo updated successfully across the app! ðŸŽ‰'));
      } else {
        toast.error(t('profile.failedToSyncPhoto', 'Failed to sync photo across the app'));
      }
    } catch {
      const { toast } = await import("sonner");
      toast.error(t('profile.failedToUpdatePhoto', 'Failed to update profile photo'));
    }
  };

  if (profileSectionLoading) {
    return <ProfileColumnSkeleton />;
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
                key={currentUser.photoUrl ?? 'no-photo'}
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
          <Suspense fallback={<QuickMenuPlaceholder />}>
            <SectionQuickMenu
              isTeamLoading={isTeamLoading}
              displayTeamData={teamAvailability || []}
            />
          </Suspense>
        </div>

      </div>
    </>
  );
};


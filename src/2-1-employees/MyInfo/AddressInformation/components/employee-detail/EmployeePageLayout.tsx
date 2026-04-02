import React from 'react';
import { useTranslation } from 'react-i18next';
import { SidebarProvider } from '@/shared/components/ui/sidebar';
import { AppSidebar } from '@/shared/layouts/sidebar/AppSidebar';
import { AppHeader } from '@/shared/layouts/header/AppHeader';
import { useHeaderUserProfile } from '@/shared/hooks/useHeaderUserProfile';
import { usePreferredLocaleSync } from '@/shared/hooks/usePreferredLocaleSync';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { EmployeeProfilePhoto } from '@/shared/components/EmployeeProfilePhoto';
import { ArrowLeft, Edit, Save, X, User, GraduationCap, Users, FileText, Briefcase, Calendar, Clock, MapPin, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Employee } from '@/shared/hooks/employees/useEmployees';
import { useAvatarSync } from '@/2-1-employees/MyInfo/PersonalInformation/hooks/useAvatarSync';
import { toast } from 'sonner';

interface EmployeePageLayoutProps {
  employee: Employee | null;
  currentPage: string;
  isEditMode: boolean;
  onEditModeChange: (editMode: boolean) => void;
  onSaveChanges: () => void;
  onEmployeeDataRefetch?: () => void;
  children: React.ReactNode;
  isLoading?: boolean;
  hasError?: boolean;
}

export const EmployeePageLayout: React.FC<EmployeePageLayoutProps> = ({
  employee,
  currentPage,
  isEditMode,
  onEditModeChange,
  onSaveChanges,
  onEmployeeDataRefetch,
  children,
  isLoading = false,
  hasError = false
}) => {
  const { t } = useTranslation();
  const { user: headerUser } = useHeaderUserProfile();
  usePreferredLocaleSync(headerUser?.id);
  const navigate = useNavigate();
  const { syncAvatarAcrossApp } = useAvatarSync();

  const sidebarProviderProps = {
    className: 'flex h-full min-h-0 w-full flex-col' as const,
    defaultOpen: false,
    sidebarToggleLabel: t('layout.header.toggleSidebar'),
    mobileNavSheetTitle: t('layout.a11y.mobileNavTitle'),
    mobileNavSheetDescription: t('layout.a11y.mobileNavDescription'),
  };

  const handleBackToEmployees = () => {
    navigate('/employees');
  };

  const navigationItems = [
    {
      id: 'personal',
      label: 'Personal Information',
      icon: User,
      path: `/my-info/personal?id=${employee?.id}`,
      active: currentPage === 'personal'
    },
    {
      id: 'address',
      label: 'Address Information',
      icon: MapPin,
      path: `/my-info/address?id=${employee?.id}`,
      active: currentPage === 'address'
    },
    {
      id: 'employment',
      label: 'Employment',
      icon: Briefcase,
      path: `/my-info/employment?id=${employee?.id}`,
      active: currentPage === 'employment'
    },
    {
      id: 'education',
      label: 'Education',
      icon: GraduationCap,
      path: `/my-info/education?id=${employee?.id}`,
      active: currentPage === 'education'
    },
    {
      id: 'work',
      label: 'Work Experience',
      icon: Briefcase,
      path: `/my-info/work?id=${employee?.id}`,
      active: currentPage === 'work'
    },
    {
      id: 'family',
      label: 'Family Members',
      icon: Users,
      path: `/my-info/family?id=${employee?.id}`,
      active: currentPage === 'family'
    },
    {
      id: 'attendance',
      label: 'Attendance',
      icon: Clock,
      path: `/my-info/attendance?id=${employee?.id}`,
      active: currentPage === 'attendance'
    },
    {
      id: 'leave-permit',
      label: 'Leave Permit',
      icon: Calendar,
      path: `/my-info/leave-permit?id=${employee?.id}`,
      active: currentPage === 'leave-permit'
    },
    {
      id: 'documents',
      label: 'Documents',
      icon: FileText,
      path: `/my-info/documents?id=${employee?.id}`,
      active: currentPage === 'documents'
    },
    {
      id: 'payroll',
      label: 'Payroll',
      icon: DollarSign,
      path: `/my-info/payroll?id=${employee?.id}`,
      active: currentPage === 'payroll'
    }
  ];

  if (isLoading) {
    return (
      <SidebarProvider {...sidebarProviderProps}>
        <AppHeader />
        <div
          aria-hidden
          className="pointer-events-none fixed left-0 right-0 top-16 z-[60] h-px bg-slate-400 dark:bg-slate-500"
        />
        <div className="mt-16 flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <AppSidebar />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500" />
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider {...sidebarProviderProps}>
      <div className="flex h-screen w-full flex-col overflow-hidden">
        <AppHeader />
        <div
          aria-hidden
          className="pointer-events-none fixed left-0 right-0 top-16 z-[60] h-px bg-slate-400 dark:bg-slate-500"
        />
        <div className="mt-16 flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
              <div className="px-4 sm:px-6 lg:px-8 py-4">
                <div className="flex items-center justify-between">
                  <Button 
                    variant="outline" 
                    onClick={handleBackToEmployees} 
                    className="flex items-center space-x-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Employees</span>
                  </Button>
                  
                  {!hasError && employee && (
                    <div className="flex items-center space-x-2">
                      {isEditMode ? (
                        <>
                          <Button 
                            variant="outline" 
                            onClick={() => onEditModeChange(false)} 
                            className="text-gray-600"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                          <Button 
                            onClick={onSaveChanges}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </Button>
                        </>
                      ) : (
                        <Button 
                          onClick={() => onEditModeChange(true)} 
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Profile
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile Navigation - Show on small screens */}
            {!hasError && employee && (
              <div className="lg:hidden bg-white border-b border-gray-200">
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <EmployeeProfilePhoto 
                      employeeName={employee.full_name}
                      employeeId={employee.id}
                      photoUrl={employee.profile_photo_url}
                      size="sm"
                      onPhotoUpdate={async (newPhotoUrl) => {
                        try {
                          console.log('🔄 EmployeePageLayout: Starting photo update process');
                          console.log('📸 New photo URL:', newPhotoUrl);
                          
                          const loadingToast = toast.loading('Memperbarui foto profil...');
                          const result = await syncAvatarAcrossApp(newPhotoUrl);
                          toast.dismiss(loadingToast);
                          
                          if (result?.success) {
                            setTimeout(() => {
                              console.log('🔄 Refetching employee data after photo update');
                              onEmployeeDataRefetch?.();
                            }, 500);
                            
                            toast.success('Foto profil berhasil diperbarui di seluruh aplikasi! 🎉');
                            console.log('✅ EmployeePageLayout: Photo sync completed successfully');
                          } else {
                            toast.error('Gagal menyinkronkan foto di seluruh aplikasi');
                            console.error('❌ EmployeePageLayout: Photo sync failed:', result?.error);
                          }
                        } catch (error) {
                          console.error('❌ EmployeePageLayout: Error during photo update:', error);
                          toast.error('Gagal memperbarui foto profil');
                        }
                      }}
                    />
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{employee.full_name}</h3>
                      <p className="text-xs text-gray-600">{employee.job_position_name || 'Employee'}</p>
                    </div>
                  </div>
                  
                  {/* Mobile Navigation Menu */}
                  <div className="grid grid-cols-2 gap-2">
                    {navigationItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Button 
                          key={item.id}
                          variant={item.active ? "default" : "outline"}
                          size="sm"
                          className={`justify-start text-xs ${
                            item.active 
                              ? 'bg-blue-600 text-white hover:bg-blue-700' 
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                          onClick={() => navigate(item.path)}
                        >
                          <Icon className="h-3 w-3 mr-2" />
                          {item.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Main Content with Information Sidebar */}
            <div className="flex flex-1 min-h-0">
              {/* Information Sidebar */}
              {!hasError && employee && (
                <div className="hidden lg:block w-64 bg-white border-r border-gray-200 overflow-y-auto">
                  {/* Employee Profile Section */}
                  <div className="p-6 text-center border-b border-gray-200">
                    <div className="mb-4 flex justify-center">
                      <EmployeeProfilePhoto 
                        employeeName={employee.full_name}
                        employeeId={employee.id}
                        photoUrl={employee.profile_photo_url}
                        size="lg"
                        onPhotoUpdate={async (newPhotoUrl) => {
                          try {
                            console.log('🔄 EmployeePageLayout: Starting photo update process');
                            console.log('📸 New photo URL:', newPhotoUrl);
                            
                            // Show loading toast
                            const loadingToast = toast.loading('Memperbarui foto profil...');
                            
                            // Sync avatar across all app components
                            const result = await syncAvatarAcrossApp(newPhotoUrl);
                            
                            // Dismiss loading toast
                            toast.dismiss(loadingToast);
                            
                            if (result?.success) {
                              // Wait a bit for database update to propagate, then refresh data
                              setTimeout(() => {
                                console.log('🔄 Refetching employee data after photo update');
                                onEmployeeDataRefetch?.();
                              }, 500);
                              
                              toast.success('Foto profil berhasil diperbarui di seluruh aplikasi! 🎉');
                              console.log('✅ EmployeePageLayout: Photo sync completed successfully');
                            } else {
                              toast.error('Gagal menyinkronkan foto di seluruh aplikasi');
                              console.error('❌ EmployeePageLayout: Photo sync failed:', result?.error);
                            }
                          } catch (error) {
                            console.error('❌ EmployeePageLayout: Error during photo update:', error);
                            toast.error('Gagal memperbarui foto profil');
                          }
                        }}
                      />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{employee.full_name}</h3>
                    <p className="text-sm text-gray-600 mb-2">{employee.job_position_name || 'Employee'}</p>
                    <Badge 
                      variant={employee.status === 'active' ? 'default' : 'secondary'} 
                      className={`${employee.status === 'active' ? 'bg-green-100 text-green-800' : ''}`}
                    >
                      {employee.status || 'Active'}
                    </Badge>
                  </div>

                  {/* Navigation Menu */}
                  <div className="p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Information</h4>
                    <div className="space-y-1">
                      {navigationItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Button 
                            key={item.id}
                            variant={item.active ? "default" : "ghost"}
                            className={`w-full justify-start text-sm ${
                              item.active 
                                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                            onClick={() => navigate(item.path)}
                          >
                            <Icon className="h-4 w-4 mr-3" />
                            {item.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Main Content Area */}
              <div className="flex-1 bg-white overflow-y-auto min-h-0">
                <div className="p-4 sm:p-6 pb-20">
                  {children}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};


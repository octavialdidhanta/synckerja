import { useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { EmployeeProfilePhoto } from '@/shared/components/EmployeeProfilePhoto';
import { ArrowLeft, User, GraduationCap, Users, FileText, Briefcase, Calendar, Clock, MapPin, DollarSign } from 'lucide-react';
import { useEmployeeDetail } from '@/2-1-employees/MyInfo/PersonalInformation/hooks/useEmployeeDetail';
import { useAvatarSync } from '@/2-1-employees/MyInfo/PersonalInformation/hooks/useAvatarSync';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { toast } from 'sonner';
import { MyInfoSidebarFooter } from '@/2-1-employees/MyInfo/shared/MyInfoSidebarFooter';
import { MyInfoContentFooter } from '@/2-1-employees/MyInfo/shared/MyInfoContentFooter';
import { ComprehensiveLeaveHistory } from '../components/ComprehensiveLeaveHistory';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

const EmployeeLeavePermit = () => {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const employeeId = id || searchParams.get('id');
  const [isEditMode, setIsEditMode] = useState(false);
  const { syncAvatarAcrossApp } = useAvatarSync();
  
  const { data: employee, isLoading, error, refetch } = useEmployeeDetail(employeeId);
  const { organizationId } = useCurrentOrg();

  const handleBackToEmployees = () => {
    navigate('/employees');
  };

  const handleSaveChanges = async () => {
    // Trigger save for leave permit if available
    if (typeof window !== 'undefined' && (window as any).saveLeavePermit) {
      await (window as any).saveLeavePermit();
    }
    setIsEditMode(false);
  };

  const navigationItems = [
    {
      id: 'personal',
      label: 'Personal Information',
      icon: User,
      path: `/my-info/personal?id=${employee?.id}`,
      active: false
    },
    {
      id: 'address',
      label: 'Address Information',
      icon: MapPin,
      path: `/my-info/address?id=${employee?.id}`,
      active: false
    },
    {
      id: 'employment',
      label: 'Employment',
      icon: Briefcase,
      path: `/my-info/employment?id=${employee?.id}`,
      active: false
    },
    {
      id: 'education',
      label: 'Formal Education',
      icon: GraduationCap,
      path: `/my-info/education/formal?id=${employee?.id}`,
      active: false
    },
    {
      id: 'education-informal',
      label: 'Informal Education',
      icon: GraduationCap,
      path: `/my-info/education/informal?id=${employee?.id}`,
      active: false
    },
    {
      id: 'work',
      label: 'Work Experience',
      icon: Briefcase,
      path: `/my-info/work?id=${employee?.id}`,
      active: false
    },
    {
      id: 'family',
      label: 'Family Members',
      icon: Users,
      path: `/my-info/family?id=${employee?.id}`,
      active: false
    },
    {
      id: 'attendance',
      label: 'Attendance',
      icon: Clock,
      path: `/my-info/attendance?id=${employee?.id}`,
      active: false
    },
    {
      id: 'leave-permit',
      label: 'Leave Permit',
      icon: Calendar,
      path: `/my-info/leave-permit?id=${employee?.id}`,
      active: true
    },
    {
      id: 'documents',
      label: 'Documents',
      icon: FileText,
      path: `/my-info/documents?id=${employee?.id}`,
      active: false
    },
    {
      id: 'payroll',
      label: 'Payroll',
      icon: DollarSign,
      path: `/my-info/payroll?id=${employee?.id}`,
      active: false
    }
  ];

  if (!employeeId || isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center py-12">
        <Card className="w-96 max-w-[90vw]">
          <CardContent className="py-12 text-center">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Employee Not Found</h3>
            <p className="mb-4 text-gray-600">The employee you're looking for doesn't exist.</p>
            <Button onClick={handleBackToEmployees}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Employees
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-gray-100 font-sans">
        <div className="flex flex-1 min-h-0">
          {/* Main Content */}
          <div className="flex-1 flex flex-col min-h-0 px-4 pb-4">
            <div className="h-full flex flex-col overflow-hidden">
                {/* Header with Actions */}
                <div className="flex-shrink-0 mt-2 mb-2">
                  <Button 
                    variant="outline" 
                    onClick={handleBackToEmployees} 
                    className="flex items-center space-x-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Employees</span>
                  </Button>
                </div>
                
                {/* Content Area - Grid Layout */}
                <div className="flex-1 grid grid-cols-12 gap-2 min-h-0">
                  {/* Left Column - Employee Overview Sidebar - 3 columns */}
                  <div className="col-span-3 flex flex-col min-h-0">
                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col h-full">
                      {/* Employee Profile Card */}
                      <div className="p-6 text-center border-b border-gray-200 flex-shrink-0">
                        <div className="mb-4 flex justify-center">
                          <EmployeeProfilePhoto 
                            employeeName={employee.full_name}
                            employeeId={employee.id}
                            photoUrl={employee.profile_photo_url}
                            size="lg"
                            onPhotoUpdate={async (newPhotoUrl) => {
                              try {
                                const loadingToast = toast.loading(t('profile.updatingPhoto', 'Updating profile photo...'));
                                const result = await syncAvatarAcrossApp(newPhotoUrl);
                                toast.dismiss(loadingToast);
                                
                                if (result?.success) {
                                  setTimeout(() => refetch(), 500);
                                  toast.success(t('profile.photoUpdatedSuccess', 'Profile photo successfully updated across the app! 🎉'));
                                } else {
                                  toast.error(t('profile.failedToSyncPhoto', 'Failed to sync photo across the app'));
                                }
                              } catch (error) {
                                console.error('Error during photo update:', error);
                                toast.error(t('profile.failedToUpdatePhoto', 'Failed to update profile photo'));
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
                      <div className="flex-1 overflow-y-auto seamless-scroll p-4">
                        <h4 className="font-semibold text-gray-900 mb-3 text-sm">Quick Navigation</h4>
                        <div className="space-y-1">
                          {navigationItems.map((item) => {
                            const Icon = item.icon;
                            return (
                              <Button 
                                key={item.id}
                                variant={item.active ? "default" : "ghost"}
                                size="sm"
                                className={`w-full justify-start text-xs ${
                                  item.active 
                                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
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

                      {/* Sidebar Footer */}
                      <MyInfoSidebarFooter 
                        employeeName={employee.full_name}
                        position={employee.job_position_name}
                      />
                    </div>
                  </div>
                  
                  {/* Right Column - Main Content - 9 columns */}
                  <div className="col-span-9 flex flex-col min-h-0">
                    {/* Main Content Section */}
                    <div className="flex-1 min-h-0">
                      <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col h-full">
                        <div className="flex-1 overflow-y-auto seamless-scroll min-h-0">
                          <div className="p-6">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6">
                              <h2 className="text-xl font-semibold text-gray-900">Leave & Permit History</h2>
                            </div>
                            
                            {/* Leave History Component */}
                            {organizationId && (
                              <ComprehensiveLeaveHistory 
                                employeeId={employeeId} 
                                organizationId={organizationId} 
                              />
                            )}
                          </div>
                        </div>

                        {/* Content Footer */}
                        <MyInfoContentFooter section="Leave Permit" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        </div>
    </div>
  );
};

export default EmployeeLeavePermit;


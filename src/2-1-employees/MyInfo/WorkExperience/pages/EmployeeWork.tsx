import { useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { EmployeeProfilePhoto } from '@/shared/components/EmployeeProfilePhoto';
import { ArrowLeft, Edit, Save, X, User, GraduationCap, Users, FileText, Briefcase, Calendar, Clock, MapPin, DollarSign } from 'lucide-react';
import { WorkExperienceInfoTab } from '../components/employee-detail/WorkExperienceInfoTab';
import { useEmployeeDetail } from '@/2-1-employees/MyInfo/PersonalInformation/hooks/useEmployeeDetail';
import { useAvatarSync } from '@/2-1-employees/MyInfo/PersonalInformation/hooks/useAvatarSync';
import { toast } from 'sonner';
import { WorkExperienceTableFooter } from '../components/WorkExperienceTableFooter';
import { WorkExperienceSidebarFooter } from '../components/WorkExperienceSidebarFooter';

const EmployeeWork = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const employeeId = id || searchParams.get('id');
  const isEditMode = true; // Always allow editing work experience records
  const { syncAvatarAcrossApp } = useAvatarSync();
  
  const { data: employee, isLoading, error, refetch } = useEmployeeDetail(employeeId);

  const handleBackToEmployees = () => {
    navigate('/employees');
  };

  // Removed handleSaveChanges - not needed anymore

  // Get current month name
  const currentMonth = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  
  // Calculate total work experience (this is a placeholder, can be calculated from actual data)
  const totalExperience = 5; // This should come from actual work experience data
  
  // Calculate total positions (placeholder)
  const totalPositions = 3; // This should be calculated from work experience list

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
      active: true
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
      active: false
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
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
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
                              const loadingToast = toast.loading('Memperbarui foto profil...');
                              const result = await syncAvatarAcrossApp(newPhotoUrl);
                              toast.dismiss(loadingToast);
                              
                              if (result?.success) {
                                setTimeout(() => refetch(), 500);
                                toast.success('Foto profil berhasil diperbarui di seluruh aplikasi! 🎉');
                              } else {
                                toast.error('Gagal menyinkronkan foto di seluruh aplikasi');
                              }
                            } catch (error) {
                              console.error('Error during photo update:', error);
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
                    <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                                  ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
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
                    <WorkExperienceSidebarFooter 
                      employeeName={employee.full_name}
                      totalPositions={totalPositions}
                    />
                  </div>
                </div>
                
                {/* Right Column - Main Content - 9 columns */}
                <div className="col-span-9 flex flex-col min-h-0">
                  {/* Main Content Section */}
                  <div className="flex-1 min-h-0">
                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col h-full">
                      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <div className="p-6">
                          {/* Header */}
                          <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold text-gray-900">Work Experience</h2>
                          </div>
                          
                          <WorkExperienceInfoTab employee={employee} isEditMode={isEditMode} onUpdate={() => {}} />
                        </div>
                      </div>

                      {/* Table Footer */}
                      <WorkExperienceTableFooter 
                        currentMonth={currentMonth}
                        totalExperience={totalExperience}
                      />
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

export default EmployeeWork;

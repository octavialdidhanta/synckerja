
import { useState } from 'react';
import { MapPin, Clock, Shield, Users, Building, Calendar, ClipboardList, AlertTriangle, DollarSign, UserCog, Wifi } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { OptimizedOfficeLocationsList } from './OptimizedOfficeLocationsList';
import { ClientManagement } from './ClientManagement';
import { VisitScheduling } from './VisitScheduling';
import { WorkScheduleSettings } from './WorkScheduleSettings';
import { AttendanceRulesSettings } from './AttendanceRulesSettings';
import { ComprehensivePenaltySettings } from './ComprehensivePenaltySettings';

import { ShiftSettings } from './ShiftSettings';
import { IPAddressSettings } from './IPAddressSettings';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

interface SettingsSection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  status?: 'active' | 'inactive' | 'warning';
  component?: React.ReactNode;
}

interface AttendanceSettingsLayoutProps {
  children?: React.ReactNode;
}

export const AttendanceSettingsLayout = ({ children }: AttendanceSettingsLayoutProps) => {
  const { t } = useAppTranslation();
  const [activeSection, setActiveSection] = useState('work-schedule');

  const settingsSections: SettingsSection[] = [
    {
      id: 'work-schedule',
      title: t('attendanceSettings.workSchedule.title', 'Work Schedule'),
      description: t('attendanceSettings.workSchedule.description', 'Configure working days, working hours, and holidays'),
      icon: Calendar,
      status: 'active',
      component: <WorkScheduleSettings />
    },
    {
      id: 'shift-settings',
      title: t('attendanceSettings.shiftSettings.title', 'Shift Settings'),
      description: t('attendanceSettings.shiftSettings.description', 'Manage work shifts and employee assignments'),
      icon: UserCog,
      status: 'active',
      component: <ShiftSettings />
    },
    {
      id: 'attendance-rules',
      title: t('attendanceSettings.attendanceRules.title', 'Attendance Rules'),
      description: t('attendanceSettings.attendanceRules.description', 'Configure validation and attendance requirements'),
      icon: ClipboardList,
      status: 'active',
      component: <AttendanceRulesSettings />
    },
    {
      id: 'penalty-settings',
      title: t('attendanceSettings.penaltySettings.title', 'Penalty Settings'),
      description: t('attendanceSettings.penaltySettings.description', 'Complete configuration of late penalty system'),
      icon: DollarSign,
      status: 'active',
      component: <ComprehensivePenaltySettings />
    },
    {
      id: 'office-locations',
      title: t('attendanceSettings.officeLocations.title', 'Office Locations'),
      description: t('attendanceSettings.officeLocations.description', 'Manage office locations with interactive map'),
      icon: MapPin,
      status: 'active',
      component: <OptimizedOfficeLocationsList />
    },
    {
      id: 'client-management',
      title: t('attendanceSettings.clientManagement.title', 'Client Management'),
      description: t('attendanceSettings.clientManagement.description', 'Manage clients and their locations'),
      icon: Building,
      status: 'active',
      component: <ClientManagement />
    },
    {
      id: 'visit-scheduling',
      title: t('attendanceSettings.visitScheduling.title', 'Visit Scheduling'),
      description: t('attendanceSettings.visitScheduling.description', 'Schedule and track employee visits'),
      icon: Calendar,
      status: 'active',
      component: <VisitScheduling />
    },
    {
      id: 'ip-address-settings',
      title: t('attendanceSettings.ipAddressSettings.title', 'IP Address Settings'),
      description: t('attendanceSettings.ipAddressSettings.description', 'Manage list of allowed IP addresses for attendance'),
      icon: Wifi,
      status: 'active',
      component: <IPAddressSettings />
    }
  ];

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'active': return t('attendanceSettings.status.active', 'active');
      case 'warning': return t('attendanceSettings.status.warning', 'warning');
      case 'inactive': return t('attendanceSettings.status.inactive', 'inactive');
      default: return status || '';
    }
  };

  const getCurrentSection = () => {
    return settingsSections.find(s => s.id === activeSection);
  };

  const renderSectionContent = () => {
    const currentSection = getCurrentSection();
    
    // Return custom component if available
    if (currentSection?.component) {
      return currentSection.component;
    }

    // Default content for sections without custom components
    return children || <div className="text-center py-8 text-gray-500">{t('attendanceSettings.comingSoon', 'Settings content will be implemented soon')}</div>;
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-50">
      {/* Left Sidebar */}
      <div className="w-72 lg:w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 lg:p-6 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg lg:text-xl font-semibold text-gray-900 mb-2">
            {t('attendanceSettings.title', 'Attendance Settings')}
          </h2>
          <p className="text-xs lg:text-sm text-gray-600">
            {t('attendanceSettings.description', 'Configure location-based attendance system with real-time updates')}
          </p>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3 lg:p-4">
            <div className="space-y-1.5 lg:space-y-2">
              {settingsSections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;

                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full text-left p-3 lg:p-4 rounded-lg transition-all duration-200 group ${
                      isActive
                        ? 'bg-blue-50 border-2 border-blue-200 shadow-sm'
                        : 'bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start space-x-2 lg:space-x-3">
                      <div
                        className={`p-1.5 lg:p-2 rounded-lg flex-shrink-0 ${
                          isActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3
                            className={`text-xs lg:text-sm font-medium truncate ${
                              isActive ? 'text-blue-900' : 'text-gray-900'
                            }`}
                          >
                            {section.title}
                          </h3>
                          {section.status && (
                            <Badge
                              variant="secondary"
                              className={`text-xs flex-shrink-0 ml-1 ${getStatusColor(section.status)}`}
                            >
                              {getStatusLabel(section.status)}
                            </Badge>
                          )}
                        </div>
                        <p
                          className={`text-xs leading-tight ${
                            isActive ? 'text-blue-700' : 'text-gray-600'
                          }`}
                        >
                          {section.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </ScrollArea>

        <div className="p-3 lg:p-4 border-t border-gray-200 flex-shrink-0">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 lg:p-3">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-blue-800">{t('attendanceSettings.realtime.active', 'Real-time Active')}</span>
            </div>
            <p className="text-xs text-blue-700 mt-1">
              {t('attendanceSettings.realtime.description', 'Data automatically updates when changes occur')}
            </p>
          </div>
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3 lg:py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl lg:text-2xl font-semibold text-gray-900 truncate">
                {getCurrentSection()?.title}
              </h1>
              <p className="text-xs lg:text-sm text-gray-600 mt-1">
                {getCurrentSection()?.description}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
              <Badge variant="outline" className="text-xs">
                {t('attendanceSettings.badge.autoSync', 'Auto-sync enabled')}
              </Badge>
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                {t('attendanceSettings.badge.realtime', 'Real-time')}
              </Badge>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 lg:p-6">
            <div className="max-w-4xl">
              {renderSectionContent()}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

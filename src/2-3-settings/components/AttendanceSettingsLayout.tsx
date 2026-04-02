
import { useState } from 'react';
import { MapPin, Clock, Shield, Users, Building, Calendar, ClipboardList, AlertTriangle, DollarSign, UserCog, Wifi } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { OptimizedOfficeLocationsList } from './OptimizedOfficeLocationsList';
import { ClientManagement } from './ClientManagement';
import { VisitScheduling } from './VisitScheduling';
import { WorkScheduleSettings } from './WorkScheduleSettings';
import { AttendanceRulesSettings } from './AttendanceRulesSettings';
import { ComprehensivePenaltySettings } from './ComprehensivePenaltySettings';

import { ShiftSettings } from './ShiftSettings';
import { IPAddressSettings } from './IPAddressSettings';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';

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
      case 'active':
        return 'bg-success-muted text-success-foreground';
      case 'warning':
        return 'bg-warning-muted text-warning-foreground';
      case 'inactive':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
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
    return (
      children || (
        <div className="text-muted-foreground py-8 text-center">
          {t('attendanceSettings.comingSoon', 'Settings content will be implemented soon')}
        </div>
      )
    );
  };

  const scrollPane =
    'scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

  return (
    <div className="bg-surface-subtle flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden lg:flex-row">
      {/* Left Sidebar — fixed shell height; section list scrolls inside. */}
      <div className="bg-card flex max-h-[42vh] min-h-0 w-full shrink-0 flex-col border-border lg:h-full lg:max-h-none lg:w-80 lg:border-r">
        <div className="flex-shrink-0 border-b border-border p-4 lg:p-6">
          <h2 className="text-foreground mb-2 text-lg font-semibold lg:text-xl">
            {t('attendanceSettings.title', 'Attendance Settings')}
          </h2>
          <p className="text-muted-foreground text-xs lg:text-sm">
            {t('attendanceSettings.description', 'Configure location-based attendance system with real-time updates')}
          </p>
        </div>

        <div className={cn('p-3 lg:p-4', scrollPane)}>
          <div className="space-y-1.5 lg:space-y-2">
            {settingsSections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`group w-full rounded-lg p-3 text-left transition-all duration-200 lg:p-4 ${
                    isActive
                      ? 'border-2 border-primary/25 bg-accent shadow-sm'
                      : 'border border-border bg-card hover:bg-muted/60 hover:border-border'
                  }`}
                >
                  <div className="flex items-start space-x-2 lg:space-x-3">
                    <div
                      className={`flex-shrink-0 rounded-lg p-1.5 lg:p-2 ${
                        isActive
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted text-muted-foreground group-hover:bg-muted/80'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3
                          className={`truncate text-xs font-medium lg:text-sm ${
                            isActive ? 'text-foreground' : 'text-foreground'
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
                          isActive ? 'text-primary' : 'text-muted-foreground'
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

        <div className="flex-shrink-0 border-t border-border p-3 lg:p-4">
          <div className="rounded-lg border border-primary/20 bg-accent p-2.5 lg:p-3">
            <div className="flex items-center space-x-2">
              <div className="bg-primary h-2 w-2 animate-pulse rounded-full" />
              <span className="text-xs font-medium text-primary">{t('attendanceSettings.realtime.active', 'Real-time Active')}</span>
            </div>
            <p className="mt-1 text-xs text-primary/90">
              {t('attendanceSettings.realtime.description', 'Data automatically updates when changes occur')}
            </p>
          </div>
        </div>
      </div>

      {/* Right: header fixed; form body scrolls inside fixed shell. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:h-full">
        <div className="flex-shrink-0 border-b border-border bg-card px-4 py-3 lg:px-6 lg:py-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-foreground truncate text-xl font-semibold lg:text-2xl">
                {getCurrentSection()?.title}
              </h1>
              <p className="text-muted-foreground mt-1 text-xs lg:text-sm">
                {getCurrentSection()?.description}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
              <Badge variant="outline" className="text-xs">
                {t('attendanceSettings.badge.autoSync', 'Auto-sync enabled')}
              </Badge>
              <Badge variant="outline" className="border-success/30 bg-success-muted text-xs text-success-foreground">
                {t('attendanceSettings.badge.realtime', 'Real-time')}
              </Badge>
            </div>
          </div>
        </div>

        <div className={cn('p-4 lg:p-6', scrollPane)}>
          <div className="max-w-4xl">
            {renderSectionContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

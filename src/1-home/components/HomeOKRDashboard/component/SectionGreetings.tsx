
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Clock, Settings, CheckCircle } from 'lucide-react';
import { useCurrentUserEmployee } from './SectionGreetingsImport/useCurrentUserEmployee';
import { useAttendanceStatus } from './AttendanceStatusProvider';
import { useUnifiedProfile } from '@/shared/hooks/useUnifiedProfile';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { applyVariables } from '@/shared/i18n/translations';
import { format } from "date-fns";
import { parseAttendanceInstant } from '@/1-home/utils/attendanceDateTime';

interface SectionGreetingsProps {
  currentTime: Date;
  greeting: string;
}

export const SectionGreetings = ({ currentTime, greeting }: SectionGreetingsProps) => {
  const { t, dateFnsLocale } = useAppTranslation();
  const { data: employeeData, isLoading } = useCurrentUserEmployee();
  const { hasCheckedIn, hasCheckedOut, todayRecord } = useAttendanceStatus();
  const { data: unifiedData } = useUnifiedProfile();
  const profile = unifiedData?.profile;
  const [currentSlide, setCurrentSlide] = useState(0);

  const formatTime = (date: Date) => {
    // Format: HH.mm.ss (e.g., 16.29.09)
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}.${minutes}.${seconds}`;
  };

  // Calculate working time if checked in
  const calculateWorkingTime = () => {
    const checkIn = parseAttendanceInstant(
      todayRecord?.attendance_date,
      todayRecord?.check_in_time,
      todayRecord?.check_in_at
    );
    if (!checkIn) {
      return t('greeting.workingTimeZero', '0 hours 0 minutes');
    }

    const now = new Date();

    const diffMs = now.getTime() - checkIn.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return applyVariables(t('greeting.workingTime', '{{hours}} hours {{minutes}} minutes'), { 
      hours: String(hours), 
      minutes: String(minutes) 
    });
  };

  // Use profile name from header data source, same as header components
  const displayName = profile?.full_name || employeeData?.profile_name || employeeData?.full_name || 'User';

  // Auto-slide between welcome and working status
  useEffect(() => {
    if (hasCheckedIn && !hasCheckedOut) {
      const interval = setInterval(() => {
        setCurrentSlide(prev => prev === 0 ? 1 : 0);
      }, 5000); // Switch every 5 seconds
      
      return () => clearInterval(interval);
    } else {
      setCurrentSlide(0); // Always show welcome when not working
    }
  }, [hasCheckedIn, hasCheckedOut]);

  return (
    <Card className="overflow-hidden bg-gradient-to-r from-primary to-brand-blue-deep text-primary-foreground">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            {/* Sliding content */}
            <div className="relative">
              {/* Welcome slide */}
              <div className={`transition-all duration-500 ${currentSlide === 0 ? 'opacity-100 transform translate-x-0' : 'opacity-0 transform -translate-x-full absolute inset-0'}`}>
                <h2 className="mb-3 text-xl font-bold leading-tight text-primary-foreground">
                  {greeting}, {displayName}! 👋
                </h2>
                <p className="text-xs leading-relaxed text-primary-foreground/85">{t('greeting.dontForgetToAttend', 'Don\'t forget to attend today!')}</p>
              </div>

              {/* Working status slide */}
              {hasCheckedIn && !hasCheckedOut && (
                <div className={`transition-all duration-500 ${currentSlide === 1 ? 'opacity-100 transform translate-x-0' : 'opacity-0 transform translate-x-full absolute inset-0'}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <CheckCircle className="h-6 w-6 text-primary-foreground" />
                    <h2 className="text-xl font-bold leading-tight text-primary-foreground">
                      {t('greeting.youAreWorking', 'You Are Working')}
                    </h2>
                  </div>
                  <p className="text-xs leading-relaxed text-primary-foreground/85">
                    {t('greeting.todayWorkingTime', 'Today\'s working time')}: {calculateWorkingTime()}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          <Button variant="ghost" size="sm" className="p-2 text-primary-foreground hover:bg-primary-foreground/15">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center space-x-4 text-xs mt-4">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span className="leading-normal">{formatTime(currentTime)}</span>
          </div>
          <div>
            {format(currentTime, "EEEE, d MMMM yyyy", { locale: dateFnsLocale })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

import React, { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseAttendanceInstant } from '@/1-home/utils/attendanceDateTime';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { SimpleAttendanceCamera } from './SectionQuickMenuImport/SimpleAttendanceCamera';
import { AttendanceStats } from './SectionQuickMenuImport/AttendanceStats';
import { useAttendanceStatus } from './AttendanceStatusProvider';
const ModalPengajuanCutiKaryawan = lazy(() =>
  import('./SectionQuickMenuImport/ModalPengajuanCutiKaryawan').then((m) => ({
    default: m.ModalPengajuanCutiKaryawan,
  })),
);
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { Clock, Camera, BarChart3, Users, Folder } from 'lucide-react';
import { toast } from 'sonner';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { applyVariables } from '@/shared/i18n/translations';

interface TeamData {
  name: string;
  total: number;
  wfo: number;
  wfh: number;
}

interface SectionQuickMenuProps {
  isTeamLoading?: boolean;
  displayTeamData?: TeamData[];
}

export const SectionQuickMenu = ({ 
  isTeamLoading = false, 
  displayTeamData = [] 
}: SectionQuickMenuProps = {}) => {
  const { t } = useAppTranslation();
  const { hasCheckedIn, hasCheckedOut, todayRecord, refreshStatus } = useAttendanceStatus();
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const navigate = useNavigate();
  const { data: employeeData, isLoading: employeeLoading } = useCurrentEmployee();

  const calculateWorkingHours = (record: any) => {
    const checkIn = parseAttendanceInstant(
      record?.attendance_date,
      record?.check_in_time,
      record?.check_in_at
    );
    if (!checkIn) {
      return t('quickMenu.workingTimeZero', '0 hours 0 minutes');
    }

    const checkOut =
      parseAttendanceInstant(record?.attendance_date, record?.check_out_time, record?.check_out_at) ??
      new Date();

    const diffMs = checkOut.getTime() - checkIn.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return applyVariables(t('quickMenu.workingTime', '{{hours}} hours {{minutes}} minutes'), {
      hours: String(hours),
      minutes: String(minutes)
    });
  };

  const workingHoursToday = todayRecord ? calculateWorkingHours(todayRecord) : t('quickMenu.workingTimeZero', '0 hours 0 minutes');

  const handleRiwayatAbsensi = async () => {
    if (employeeLoading) {
      toast.info(t('quickMenu.loadingEmployee', 'Loading employee data...'));
      return;
    }
    if (employeeData?.id) {
      setIsNavigating(true);
      navigate(`/my-info/attendance?id=${employeeData.id}`);
      setIsNavigating(false);
    } else {
      toast.error(t('quickMenu.employeeDataNotAvailable', 'Employee data is not available. Please refresh the page or contact administrator.'));
    }
  };

  const handlePengajuanCuti = () => {
    setIsModalOpen(true);
  };

  const handleFiles = () => {
    navigate('/company/files');
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const handleStatusCreated = () => {};

  return (
    <Card className="border border-border h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="flex items-center gap-2 text-base font-semibold leading-snug text-foreground">
          <Clock className="h-5 w-5 text-primary" />
          {t('quickMenu.title', 'Quick Menu - Online Attendance')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain scrollbar-hide">
        <SimpleAttendanceCamera 
          onAttendanceUpdate={refreshStatus} 
          onCameraStateChange={setIsCameraActive}
        />
        {!isCameraActive && <AttendanceStats workingHoursToday={workingHoursToday} />}
        
        {/* Tim Hari Ini Section */}
        <div className="rounded-lg border border-border bg-card p-3">
          <h4 className="mb-3 flex items-center text-base font-semibold leading-snug text-foreground">
            <Users className="mr-2 h-4 w-4 text-primary" />
            {t('quickMenu.todayTeam', 'Today\'s Team')}
          </h4>
          <div className="space-y-3">
            {isTeamLoading ? (
              <div className="mx-auto h-20 max-w-sm rounded-md bg-muted/40 py-4 animate-pulse" aria-hidden />
            ) : displayTeamData.length === 0 ? (
              <div className="text-center py-4">
                <div className="text-xs text-gray-500 leading-relaxed">{t('quickMenu.noTeamData', 'No team data today')}</div>
              </div>
            ) : (
              displayTeamData.map((team, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-900 leading-normal">{team.name}</span>
                    <span className="text-xs text-gray-500 leading-normal">{applyVariables(t('quickMenu.people', '{{count}} people'), { count: String(team.total) })}</span>
                  </div>
                  {team.total > 0 ? (
                    <>
                      <div className="flex space-x-1">
                        <div className="flex-1 bg-muted h-2 rounded overflow-hidden">
                          <div className="h-full bg-muted-foreground rounded" style={{
                            width: `${team.total > 0 ? (team.wfo / team.total * 100) : 0}%`
                          }} />
                        </div>
                        <div className="flex-1 bg-muted h-2 rounded overflow-hidden">
                          <div className="h-full bg-accent rounded" style={{
                            width: `${team.total > 0 ? (team.wfh / team.total * 100) : 0}%`
                          }} />
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 leading-normal">
                        <span>{t('quickMenu.wfo', 'WFO')}: {team.wfo}</span>
                        <span>{t('quickMenu.wfh', 'WFH')}: {team.wfh}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-gray-500 text-center py-2 leading-normal">
                      {t('quickMenu.noDataToday', 'No data today')}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Additional Content */}
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 flex items-center gap-2 border-l-2 border-brand-accent pl-2">
            <h4 className="text-sm font-semibold leading-snug text-foreground">
              {t('quickMenu.quickActions', 'Quick Actions')}
            </h4>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button 
              type="button"
              onClick={handleRiwayatAbsensi}
              disabled={employeeLoading || isNavigating}
              className={`flex items-center gap-2 rounded-md border border-primary/20 bg-card p-2 text-primary transition-colors ${
                employeeLoading || isNavigating 
                  ? 'cursor-not-allowed opacity-50' 
                  : 'cursor-pointer hover:border-primary/35 hover:bg-accent'
              }`}
            >
              <Clock className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-left text-xs font-semibold leading-relaxed">
                {isNavigating ? t('quickMenu.opening', 'Opening...') : t('quickMenu.attendanceHistory', 'Attendance History')}
              </span>
            </button>
            <button 
              type="button"
              onClick={handlePengajuanCuti}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-primary/20 bg-card p-2 text-primary transition-colors hover:border-brand-accent/50 hover:bg-warning-muted/40"
            >
              <Camera className="h-4 w-4 shrink-0 text-brand-accent" />
              <span className="text-left text-xs font-semibold leading-relaxed">{t('quickMenu.leaveRequest', 'Leave Request')}</span>
            </button>
            <button 
              type="button"
              onClick={handleFiles}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-primary/20 bg-card p-2 text-primary transition-colors hover:border-primary/35 hover:bg-accent"
            >
              <Folder className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-left text-xs font-semibold leading-relaxed">{t('quickMenu.files', 'Files')}</span>
            </button>
          </div>
        </div>
      </CardContent>
      
      {isModalOpen ? (
        <Suspense fallback={null}>
          <ModalPengajuanCutiKaryawan
            isOpen={isModalOpen}
            onClose={handleModalClose}
            onSubmit={handleStatusCreated}
          />
        </Suspense>
      ) : null}
    </Card>
  );
};

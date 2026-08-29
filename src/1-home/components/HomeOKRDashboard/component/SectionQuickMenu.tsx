import React, { lazy, Suspense, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseAttendanceInstant } from '@/1-home/utils/attendanceDateTime';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { SimpleAttendanceCamera } from './SectionQuickMenuImport/SimpleAttendanceCamera';
import { AttendanceStats } from './SectionQuickMenuImport/AttendanceStats';
import { useAttendanceStatus } from './AttendanceStatusProvider';
import { useTeamAvailability } from '@/1-home/components/useTeamAvailability';
const ModalPengajuanCutiKaryawan = lazy(() =>
  import('./SectionQuickMenuImport/ModalPengajuanCutiKaryawan').then((m) => ({
    default: m.ModalPengajuanCutiKaryawan,
  })),
);
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { Clock, Camera, Users, Folder } from 'lucide-react';
import { toast } from 'sonner';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { applyVariables } from '@/shared/i18n/translations';

export const SectionQuickMenu = () => {
  const { t } = useAppTranslation();
  const { todayRecord, refreshStatus } = useAttendanceStatus();
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const navigate = useNavigate();
  const { data: employeeData, isLoading: employeeLoading } = useCurrentEmployee();
  const [deferTeamLoad, setDeferTeamLoad] = useState(false);

  useEffect(() => {
    const enable = () => setDeferTeamLoad(true);
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(enable, { timeout: 800 });
      return () => cancelIdleCallback(id);
    }
    const timer = window.setTimeout(enable, 400);
    return () => window.clearTimeout(timer);
  }, []);

  const {
    data: teamAvailability = [],
    isLoading: isTeamLoading,
  } = useTeamAvailability({ enabled: deferTeamLoad });

  const calculateWorkingHours = (record: Record<string, unknown>) => {
    const checkIn = parseAttendanceInstant(
      record?.attendance_date as string | null | undefined,
      record?.check_in_time as string | null | undefined,
      record?.check_in_at as string | null | undefined,
    );
    if (!checkIn) {
      return t('quickMenu.workingTimeZero', '0 hours 0 minutes');
    }

    const checkOut =
      parseAttendanceInstant(
        record?.attendance_date as string | null | undefined,
        record?.check_out_time as string | null | undefined,
        record?.check_out_at as string | null | undefined,
      ) ?? new Date();

    const diffMs = checkOut.getTime() - checkIn.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return applyVariables(t('quickMenu.workingTime', '{{hours}} hours {{minutes}} minutes'), {
      hours: String(hours),
      minutes: String(minutes),
    });
  };

  const workingHoursToday = todayRecord
    ? calculateWorkingHours(todayRecord)
    : t('quickMenu.workingTimeZero', '0 hours 0 minutes');

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
      toast.error(
        t(
          'quickMenu.employeeDataNotAvailable',
          'Employee data is not available. Please refresh the page or contact administrator.',
        ),
      );
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
    <Card className="flex h-full flex-col overflow-hidden border border-border">
      <CardHeader className="flex-shrink-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold leading-snug text-foreground">
          <Clock className="h-5 w-5 text-primary" />
          {t('quickMenu.title', 'Quick Menu - Online Attendance')}
        </CardTitle>
      </CardHeader>
      <CardContent className="scrollbar-hide nested-scroll-touch-chain seamless-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden">
        <SimpleAttendanceCamera
          onAttendanceUpdate={refreshStatus}
          onCameraStateChange={setIsCameraActive}
        />
        {!isCameraActive ? (
          <AttendanceStats workingHoursToday={workingHoursToday} loadMonthlyStats />
        ) : null}

        <div className="rounded-lg border border-border bg-card p-3">
          <h4 className="mb-3 flex items-center text-base font-semibold leading-snug text-foreground">
            <Users className="mr-2 h-4 w-4 text-primary" />
            {t('quickMenu.todayTeam', "Today's Team")}
          </h4>
          <div className="space-y-3">
            {isTeamLoading ? (
              <div className="mx-auto h-20 max-w-sm animate-pulse rounded-md bg-muted/40 py-4" aria-hidden />
            ) : teamAvailability.length === 0 ? (
              <div className="py-4 text-center">
                <div className="text-xs leading-relaxed text-gray-500">
                  {t('quickMenu.noTeamData', 'No team data today')}
                </div>
              </div>
            ) : (
              teamAvailability.map((team, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium leading-normal text-gray-900">{team.name}</span>
                    <span className="text-xs leading-normal text-gray-500">
                      {applyVariables(t('quickMenu.people', '{{count}} people'), {
                        count: String(team.total),
                      })}
                    </span>
                  </div>
                  {team.total > 0 ? (
                    <>
                      <div className="flex space-x-1">
                        <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                          <div
                            className="h-full rounded bg-muted-foreground"
                            style={{
                              width: `${team.total > 0 ? (team.wfo / team.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                          <div
                            className="h-full rounded bg-accent"
                            style={{
                              width: `${team.total > 0 ? (team.wfh / team.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-xs leading-normal text-gray-500">
                        <span>
                          {t('quickMenu.wfo', 'WFO')}: {team.wfo}
                        </span>
                        <span>
                          {t('quickMenu.wfh', 'WFH')}: {team.wfh}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="py-2 text-center text-xs leading-normal text-gray-500">
                      {t('quickMenu.noDataToday', 'No data today')}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

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
                {isNavigating
                  ? t('quickMenu.opening', 'Opening...')
                  : t('quickMenu.attendanceHistory', 'Attendance History')}
              </span>
            </button>
            <button
              type="button"
              onClick={handlePengajuanCuti}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-primary/20 bg-card p-2 text-primary transition-colors hover:border-brand-accent/50 hover:bg-warning-muted/40"
            >
              <Camera className="h-4 w-4 shrink-0 text-brand-accent" />
              <span className="text-left text-xs font-semibold leading-relaxed">
                {t('quickMenu.leaveRequest', 'Leave Request')}
              </span>
            </button>
            <button
              type="button"
              onClick={handleFiles}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-primary/20 bg-card p-2 text-primary transition-colors hover:border-primary/35 hover:bg-accent"
            >
              <Folder className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-left text-xs font-semibold leading-relaxed">
                {t('quickMenu.files', 'Files')}
              </span>
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

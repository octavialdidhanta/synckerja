import { ArrowLeft, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { AttendanceTable } from './AttendanceTable';

const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

interface EmployeeAttendanceDetailPanelProps {
  employeeId: string;
  employeeName: string;
  month: number;
  year: number;
  searchTerm: string;
  status: string;
  onClose: () => void;
}

export const EmployeeAttendanceDetailPanel = ({
  employeeId,
  employeeName,
  month,
  year,
  searchTerm,
  status,
  onClose,
}: EmployeeAttendanceDetailPanelProps) => {
  const { t } = useAppTranslation();
  const monthLabel = MONTH_NAMES_ID[month] ?? String(month + 1);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 gap-1 px-2"
            onClick={onClose}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden text-sm sm:inline">
              {t('attendance.records.backToCalendar', 'Back to calendar')}
            </span>
          </Button>
          <div className="min-w-0 border-l border-border pl-2">
            <h3 className="text-foreground truncate text-sm font-semibold">{employeeName}</h3>
            <p className="text-muted-foreground text-xs">
              {t('attendance.records.detailForMonth', 'Attendance records for {{month}} {{year}}', {
                month: monthLabel,
                year: String(year),
              })}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 shrink-0 p-0"
          onClick={onClose}
          aria-label={t('common.close', 'Close')}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="scrollbar-hide min-h-0 flex-1 overflow-auto p-3">
        <AttendanceTable
          searchTerm={searchTerm}
          status={status}
          employeeId={employeeId}
          month={month}
          year={year}
          variant="inline"
          showPhotos
          emptyMessage={t(
            'attendance.records.noRecordsForEmployee',
            'No attendance records for this employee in the selected month.',
          )}
        />
      </div>
    </div>
  );
};

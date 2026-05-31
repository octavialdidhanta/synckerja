
import React, { useMemo } from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Calendar, Clock, MapPin, User } from 'lucide-react';
import { useAttendanceRecords } from '../hooks/useAttendanceRecords';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { useOfficeLocations } from '@/features/2-3-settings/hooks/useLocationManagement';
import { attendanceLoadSectionIds, useReportAttendanceSection } from '@/2-3-attendance/context/AttendancePageLoadContext';
import { AttendancePhotoThumbnail } from './AttendancePhotoThumbnail';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

interface AttendanceTableProps {
  searchTerm: string;
  status: string;
  dateRange?: { from?: Date; to?: Date };
  employeeId?: string;
  /** Calendar month index 0–11 */
  month?: number;
  year?: number;
  variant?: 'full' | 'inline';
  showPhotos?: boolean;
  emptyMessage?: string;
}

export const AttendanceTable = ({
  searchTerm,
  status,
  dateRange,
  employeeId,
  month,
  year,
  variant = 'full',
  showPhotos = false,
  emptyMessage,
}: AttendanceTableProps) => {
  const { t } = useAppTranslation();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { records: attendanceRecords, isLoading } = useAttendanceRecords(organizationId ?? undefined);
  const { locations: officeLocations, loading: locationsLoading } = useOfficeLocations();
  const isInline = variant === 'inline';
  const reportSection = isInline ? attendanceLoadSectionIds.attendanceCalendar : attendanceLoadSectionIds.attendanceRecords;
  useReportAttendanceSection(reportSection, orgLoading || isLoading || locationsLoading);

  const officeLocationMap = useMemo(() => {
    const map = new Map<string, string>();
    officeLocations.forEach((location: any) => {
      if (location?.id) {
        map.set(
          location.id,
          location.name ||
            location.location_name ||
            location.formatted_address ||
            location.address ||
            ''
        );
      }
    });
    return map;
  }, [officeLocations]);

  const rangeStart = React.useMemo(() => {
    if (!dateRange?.from) return undefined;
    return new Date(
      dateRange.from.getFullYear(),
      dateRange.from.getMonth(),
      dateRange.from.getDate(),
      0,
      0,
      0,
      0
    ).getTime();
  }, [dateRange?.from]);

  const rangeEnd = React.useMemo(() => {
    if (!dateRange?.to) return undefined;
    return new Date(
      dateRange.to.getFullYear(),
      dateRange.to.getMonth(),
      dateRange.to.getDate(),
      23,
      59,
      59,
      999
    ).getTime();
  }, [dateRange?.to]);

  const monthRangeStart = useMemo(() => {
    if (month === undefined || year === undefined) return undefined;
    return new Date(year, month, 1, 0, 0, 0, 0).getTime();
  }, [month, year]);

  const monthRangeEnd = useMemo(() => {
    if (month === undefined || year === undefined) return undefined;
    return new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
  }, [month, year]);

  const getRecordTime = (attendanceDate: string | null | undefined) => {
    if (!attendanceDate) return undefined;

    if (typeof attendanceDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(attendanceDate)) {
      const [y, m, d] = attendanceDate.split('-').map(Number);
      return new Date(y, m - 1, d).getTime();
    }

    const parsed = new Date(attendanceDate);
    if (!isNaN(parsed.getTime())) {
      return parsed.getTime();
    }

    return undefined;
  };

  const getRecordEmployeeId = (record: { employee_id?: string; employees?: { id?: string } }) =>
    record.employee_id || record.employees?.id;

  const filteredRecords = (attendanceRecords || []).filter(record => {
    if (employeeId && getRecordEmployeeId(record) !== employeeId) {
      return false;
    }

    const employeeName = record.employees?.full_name || '';
    const employeeEmail = record.employees?.email || '';

    const matchesSearch =
      !employeeId &&
      (employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employeeEmail.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesSearchWhenScoped =
      employeeId &&
      (searchTerm.trim() === '' ||
        employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employeeEmail.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      status === 'all' ||
      record.status === status ||
      (status === 'late' && (record.is_late || record.status === 'late'));

    const recordTime = getRecordTime(record.attendance_date);
    const matchesToolbarDate =
      (rangeStart === undefined || (recordTime !== undefined && recordTime >= rangeStart)) &&
      (rangeEnd === undefined || (recordTime !== undefined && recordTime <= rangeEnd));

    const matchesMonth =
      monthRangeStart === undefined ||
      monthRangeEnd === undefined ||
      (recordTime !== undefined && recordTime >= monthRangeStart && recordTime <= monthRangeEnd);

    const searchOk = employeeId ? matchesSearchWhenScoped : matchesSearch;

    return searchOk && matchesStatus && matchesToolbarDate && matchesMonth;
  });

  const columnCount =
    (isInline ? 0 : 1) + 8 + (showPhotos ? 2 : 0);

  const getStatusBadge = (statusValue: string) => {
    switch (statusValue) {
      case 'present':
        return <Badge className="border-0 bg-success-muted text-success-foreground">Present</Badge>;
      case 'late':
        return <Badge className="border-0 bg-warning-muted text-warning-foreground">Late</Badge>;
      case 'absent':
        return <Badge className="border-0 bg-destructive/10 text-destructive">Absent</Badge>;
      default:
        return <Badge variant="outline">{statusValue}</Badge>;
    }
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '-';
    const s = String(timeString).trim();

    const asDate = new Date(s);
    if (!isNaN(asDate.getTime())) {
      return asDate.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    }

    const wallClock = s.match(
      /^(\d{1,2}):(\d{2})(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}(?::\d{2})?)?$/i,
    );
    if (wallClock) {
      const hh = wallClock[1].padStart(2, '0');
      const mm = wallClock[2].padStart(2, '0');
      return `${hh}:${mm}`;
    }

    return '-';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';

    try {
      const date = new Date(dateString);

      if (isNaN(date.getTime())) {
        if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const [y, m, d] = dateString.split('-');
          const validDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));

          if (!isNaN(validDate.getTime())) {
            return validDate.toLocaleDateString('id-ID', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            });
          }
        }
        return dateString;
      }

      return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch (error) {
      console.error('Error formatting date:', error, 'for date:', dateString);
      return dateString;
    }
  };

  const formatWorkingHours = (minutes: number) => {
    if (!minutes || minutes === 0) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatLocationLabel = (locationData: any, preferredName?: string) => {
    if (!locationData || typeof locationData !== 'object') {
      return preferredName || '-';
    }

    const candidates = [
      preferredName,
      locationData.location_name,
      locationData.name,
      locationData.formatted_address,
      locationData.address,
    ];

    for (const candidate of candidates) {
      if (
        typeof candidate === 'string' &&
        candidate.trim().length > 0 &&
        !candidate.toLowerCase().includes('location capture')
      ) {
        return candidate;
      }
    }

    if (
      typeof locationData.latitude === 'number' &&
      typeof locationData.longitude === 'number'
    ) {
      return `${locationData.latitude.toFixed(5)}, ${locationData.longitude.toFixed(5)}`;
    }

    return '-';
  };

  const getLocationTooltip = (locationData: any, preferredName?: string) => {
    if (!locationData || typeof locationData !== 'object') {
      return preferredName || null;
    }

    const candidates = [
      locationData.formatted_address,
      locationData.address,
      preferredName,
      locationData.location_name,
      locationData.name,
    ];

    for (const candidate of candidates) {
      if (
        typeof candidate === 'string' &&
        candidate.trim().length > 0 &&
        !candidate.toLowerCase().includes('location capture')
      ) {
        return candidate;
      }
    }

    if (
      typeof locationData.latitude === 'number' &&
      typeof locationData.longitude === 'number'
    ) {
      return `Lat: ${locationData.latitude}, Lng: ${locationData.longitude}`;
    }

    return null;
  };

  const defaultEmpty = t(
    'attendance.records.noRecordsMatching',
    'No attendance records found matching your criteria.',
  );

  return (
    <div className={isInline ? 'flex flex-col gap-2' : 'flex flex-col gap-3'}>
      {!isInline && (
        <div>
          <h2 className="text-foreground text-base font-semibold">Attendance Records</h2>
          <p className="text-muted-foreground text-sm">
            Employee attendance tracking and management
          </p>
        </div>
      )}

      <div className="min-h-0 rounded-md border bg-white">
        <div className="min-h-0">
          <TooltipProvider delayDuration={200}>
            <Table className={isInline ? 'w-full min-w-[900px]' : 'w-full min-w-[1300px] table-fixed'}>
              <TableHeader>
                <TableRow>
                  {!isInline && (
                    <TableHead className="w-[280px] min-w-[280px]">Employee</TableHead>
                  )}
                  <TableHead className="min-w-[120px]">Date</TableHead>
                  <TableHead className="min-w-[100px]">Check In</TableHead>
                  <TableHead className="min-w-[100px]">Check Out</TableHead>
                  <TableHead className="min-w-[100px]">Working Hours</TableHead>
                  <TableHead className="min-w-[80px]">Status</TableHead>
                  <TableHead className="min-w-[200px] whitespace-nowrap">Check In Location</TableHead>
                  <TableHead className="min-w-[200px] whitespace-nowrap pr-6">Check Out Location</TableHead>
                  <TableHead className={showPhotos ? 'min-w-[120px]' : 'min-w-[240px] pl-5'}>Notes</TableHead>
                  {showPhotos && (
                    <>
                      <TableHead className="min-w-[72px]">
                        {t('attendance.records.checkInPhoto', 'Check-in photo')}
                      </TableHead>
                      <TableHead className="min-w-[72px]">
                        {t('attendance.records.checkOutPhoto', 'Check-out photo')}
                      </TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columnCount} className="py-8 text-center text-muted-foreground">
                      {emptyMessage ?? defaultEmpty}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      {!isInline && (
                        <TableCell className="w-[280px] min-w-[280px]">
                          <div className="flex items-center gap-3">
                            <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                              <User className="text-muted-foreground h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">
                                {record.employees?.full_name || 'Unknown'}
                              </div>
                              <div className="truncate text-sm text-muted-foreground">
                                {record.employees?.email || '-'}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="min-w-[120px]">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{formatDate(record.attendance_date)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[100px]">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{formatTime(record.check_in_time)}</span>
                          {record.is_late && (
                            <span className="text-destructive ml-1 text-xs">
                              (+{record.late_minutes}m)
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[100px]">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{formatTime(record.check_out_time)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[100px]">
                        <span className="text-sm">{formatWorkingHours(record.working_hours_minutes)}</span>
                      </TableCell>
                      <TableCell className="min-w-[80px]">
                        {getStatusBadge(record.is_late && record.status === 'present' ? 'late' : record.status)}
                      </TableCell>
                      <TableCell className="min-w-[200px]">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                              <span className="cursor-default truncate text-sm">
                                {formatLocationLabel(
                                  record.check_in_location,
                                  record.office_location_id
                                    ? officeLocationMap.get(record.office_location_id)
                                    : undefined
                                )}
                              </span>
                            </TooltipTrigger>
                            {getLocationTooltip(
                              record.check_in_location,
                              record.office_location_id
                                ? officeLocationMap.get(record.office_location_id)
                                : undefined
                            ) && (
                              <TooltipContent side="top" className="max-w-sm">
                                <p className="text-xs">
                                  {getLocationTooltip(
                                    record.check_in_location,
                                    record.office_location_id
                                      ? officeLocationMap.get(record.office_location_id)
                                      : undefined
                                  )}
                                </p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[200px] pr-6">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                              <span className="cursor-default truncate text-sm">
                                {formatLocationLabel(record.check_out_location)}
                              </span>
                            </TooltipTrigger>
                            {getLocationTooltip(record.check_out_location) && (
                              <TooltipContent side="top" className="max-w-sm">
                                <p className="text-xs">
                                  {getLocationTooltip(record.check_out_location)}
                                </p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </div>
                      </TableCell>
                      <TableCell className={showPhotos ? 'min-w-[120px]' : 'min-w-[240px] max-w-[280px] pl-5'}>
                        <Tooltip delayDuration={200}>
                          <TooltipTrigger asChild>
                            <span className="block cursor-default truncate text-sm">
                              {record.notes && record.notes.trim().length > 0 ? record.notes : '-'}
                            </span>
                          </TooltipTrigger>
                          {record.notes && record.notes.trim().length > 0 && (
                            <TooltipContent side="top" className="max-w-sm">
                              <p className="whitespace-pre-wrap text-xs">{record.notes}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TableCell>
                      {showPhotos && (
                        <>
                          <TableCell>
                            <AttendancePhotoThumbnail
                              photoPath={record.check_in_photo_path}
                              label={t('attendance.records.checkInPhoto', 'Check-in photo')}
                            />
                          </TableCell>
                          <TableCell>
                            <AttendancePhotoThumbnail
                              photoPath={record.check_out_photo_path}
                              label={t('attendance.records.checkOutPhoto', 'Check-out photo')}
                            />
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};


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

interface AttendanceTableProps {
  searchTerm: string;
  status: string;
  dateRange?: { from?: Date; to?: Date };
}

export const AttendanceTable = ({ searchTerm, status, dateRange }: AttendanceTableProps) => {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { records: attendanceRecords, isLoading } = useAttendanceRecords(organizationId ?? undefined);
  const { locations: officeLocations, loading: locationsLoading } = useOfficeLocations();
  useReportAttendanceSection(
    attendanceLoadSectionIds.attendanceRecords,
    orgLoading || isLoading || locationsLoading,
  );

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

  const getRecordTime = (attendanceDate: string | null | undefined) => {
    if (!attendanceDate) return undefined;

    if (typeof attendanceDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(attendanceDate)) {
      const [year, month, day] = attendanceDate.split('-').map(Number);
      return new Date(year, month - 1, day).getTime();
    }

    const parsed = new Date(attendanceDate);
    if (!isNaN(parsed.getTime())) {
      return parsed.getTime();
    }

    return undefined;
  };

  // Filter records based on search and filters
  const filteredRecords = (attendanceRecords || []).filter(record => {
    const employeeName = record.employees?.full_name || '';
    const employeeEmail = record.employees?.email || '';
    
    const matchesSearch = employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employeeEmail.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = status === 'all' || record.status === status;

    const recordTime = getRecordTime(record.attendance_date);
    const matchesDate =
      (rangeStart === undefined || (recordTime !== undefined && recordTime >= rangeStart)) &&
      (rangeEnd === undefined || (recordTime !== undefined && recordTime <= rangeEnd));
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge className="border-0 bg-success-muted text-success-foreground">Present</Badge>;
      case 'late':
        return <Badge className="border-0 bg-warning-muted text-warning-foreground">Late</Badge>;
      case 'absent':
        return <Badge className="border-0 bg-destructive/10 text-destructive">Absent</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '-';
    try {
      // Handle full timestamp format (e.g., "2025-07-15 05:57:25+00")
      const date = new Date(timeString);
      if (isNaN(date.getTime())) {
        console.error('Invalid timestamp:', timeString);
        return '-';
      }
      return date.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      console.error('Error formatting time:', error, 'for timestamp:', timeString);
      return '-';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    
    try {
      // Try different date formats
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        // Try parsing as ISO date format (YYYY-MM-DD)
        if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const [year, month, day] = dateString.split('-');
          const validDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          
          if (!isNaN(validDate.getTime())) {
            return validDate.toLocaleDateString('id-ID', {
              day: '2-digit',
              month: '2-digit', 
              year: 'numeric'
            });
          }
        }
        return dateString; // Return original string if all parsing fails
      }
      
      return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error, 'for date:', dateString);
      return dateString; // Return original string if formatting fails
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
      return `${locationData.latitude.toFixed(5)}, ${locationData.longitude.toFixed(
        5
      )}`;
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

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-foreground text-base font-semibold">Attendance Records</h2>
        <p className="text-muted-foreground text-sm">
          Employee attendance tracking and management
        </p>
      </div>

      <div className="rounded-md border bg-white min-h-0">
        <div className="min-h-0">
          <TooltipProvider delayDuration={200}>
            <Table className="w-full min-w-[1200px] table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Employee</TableHead>
                  <TableHead className="min-w-[120px]">Date</TableHead>
                  <TableHead className="min-w-[100px]">Check In</TableHead>
                  <TableHead className="min-w-[100px]">Check Out</TableHead>
                  <TableHead className="min-w-[100px]">Working Hours</TableHead>
                  <TableHead className="min-w-[80px]">Status</TableHead>
                  <TableHead className="min-w-[200px]">Check In Location</TableHead>
                  <TableHead className="min-w-[200px]">Check Out Location</TableHead>
                  <TableHead className="min-w-[220px]">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                      No attendance records found matching your criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="min-w-[200px]">
                        <div className="flex items-center gap-3">
                          <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
                            <User className="text-muted-foreground h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate">
                              {record.employees?.full_name || 'Unknown'}
                            </div>
                            <div className="text-sm text-muted-foreground truncate">
                              {record.employees?.email || '-'}
                            </div>
                          </div>
                        </div>
                      </TableCell>
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
                        {getStatusBadge(record.status)}
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
                      <TableCell className="min-w-[200px]">
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
                      <TableCell className="min-w-[220px] max-w-[260px]">
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

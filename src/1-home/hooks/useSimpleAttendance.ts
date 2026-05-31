import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useLocationServices, type LocationData } from './useLocationServices';
import { findNearestOfficeLocation } from '../utils/officeLocationUtils';
import { hasOfficeLocations } from '../utils/officeLocationValidation';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { useToast } from '@/shared/components/ui/use-toast';
import { logger } from '@/shared/lib/logger';
import { attendanceInstantToIso, dateToPostgresTimeUtc } from '@/1-home/utils/attendanceDateTime';
import { parseAttendanceValidationRow } from '@/shared/attendance/resolveEffectiveSchedule';
import { uploadAttendancePhoto, type AttendancePhotoUploadResult } from '@/shared/lib/attendance/uploadAttendancePhoto';
import {
  applyClientSideAttendanceFixes,
  type AttendanceValidationForFixes,
} from '@/shared/lib/attendance/applyClientSideAttendanceFixes';
import {
  CLIENT_VISIT_CHECKIN_MESSAGE_ID,
  isClientVisitCheckinDay,
} from '@/shared/lib/attendance/attendanceValidationMessages';

export type PhotoUploadResult = AttendancePhotoUploadResult;

/** Pending late check-in: no row in attendance_records until user submits reason in modal. */
interface PendingLateCheckIn {
  imageDataUrl: string;
  validation: AttendanceValidationForFixes;
  location: LocationData;
}

function formatLocalCheckinTimeString(d: Date): string {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0') +
    ' ' +
    String(d.getHours()).padStart(2, '0') +
    ':' +
    String(d.getMinutes()).padStart(2, '0') +
    ':' +
    String(d.getSeconds()).padStart(2, '0')
  );
}

export const useSimpleAttendance = () => {
  const [loading, setLoading] = useState(false);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [hasCheckedOut, setHasCheckedOut] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState<string | null>(null);
  const [lastCheckOut, setLastCheckOut] = useState<string | null>(null);
  const [showLateReasonModal, setShowLateReasonModal] = useState(false);
  const [lateMinutes, setLateMinutes] = useState<number>(0);
  const pendingLateCheckInRef = useRef<PendingLateCheckIn | null>(null);

  const { getCurrentLocation } = useLocationServices();
  const { data: employee } = useCurrentEmployee();
  const { toast } = useToast();

  const checkTodayStatus = useCallback(async () => {
    if (!employee?.id) return;

    const today = new Date().toISOString().split('T')[0];
    logger.debug('🔍 Checking today attendance for date:', today);

    const { data: record, error } = await supabase
      .from('attendance_records')
      .select('check_in_time, check_out_time, check_in_at, check_out_at, id, attendance_date')
      .eq('employee_id', employee.id)
      .eq('attendance_date', today)
      .maybeSingle();

    logger.debug('📋 Today attendance status:', { record, error });

    if (!error && record) {
      const hasIn = !!(record.check_in_at || record.check_in_time);
      const hasOut = !!(record.check_out_at || record.check_out_time);
      setHasCheckedIn(hasIn);
      setHasCheckedOut(hasOut);
      setLastCheckIn(
        attendanceInstantToIso(record.attendance_date, record.check_in_time, record.check_in_at),
      );
      setLastCheckOut(
        attendanceInstantToIso(record.attendance_date, record.check_out_time, record.check_out_at),
      );
    } else {
      setHasCheckedIn(false);
      setHasCheckedOut(false);
      setLastCheckIn(null);
      setLastCheckOut(null);
    }
  }, [employee?.id]);

  useEffect(() => {
    checkTodayStatus();
  }, [checkTodayStatus]);

  const finalizeCheckIn = useCallback(
    async (
      imageDataUrl: string,
      validation: AttendanceValidationForFixes,
      location: LocationData,
      localTimeString: string,
      notes: string | null,
    ) => {
      if (!employee) {
        throw new Error('Employee not found');
      }

      const photoResult = await uploadAttendancePhoto(employee.id, imageDataUrl, 'check_in');

      const { data: attendanceResult, error: attendanceError } = await supabase.rpc(
        'record_attendance_with_timezone',
        {
          employee_id_param: employee.id,
          organization_id_param: employee.organization_id,
          local_checkin_time: localTimeString,
          latitude_param: parseFloat(location.latitude.toString()),
          longitude_param: parseFloat(location.longitude.toString()),
          timezone_param: 'Asia/Jakarta',
          photo_path_param: photoResult.path,
          location_data: {
            latitude: location.latitude,
            longitude: location.longitude,
            address: location.address || 'Unknown',
            formatted_address: location.formatted_address || 'Unknown',
          },
          notes_param: notes?.trim() ? notes.trim() : null,
        },
      );

      if (attendanceError) {
        console.error('❌ Database insert error:', attendanceError);
        if (attendanceError.message.includes('USE_CLIENT_VISIT_CHECKIN')) {
          throw new Error(CLIENT_VISIT_CHECKIN_MESSAGE_ID);
        }
        if (attendanceError.code === '23502') {
          throw new Error(
            'Lokasi kantor belum dikonfigurasi. Silakan hubungi admin untuk mengatur lokasi kantor terlebih dahulu.',
          );
        }
        if (attendanceError.message.includes('Office location required')) {
          throw new Error(
            'Lokasi kantor diperlukan untuk absensi. Silakan hubungi admin untuk mengatur lokasi kantor terlebih dahulu.',
          );
        }
        throw new Error(`Gagal menyimpan data absensi: ${attendanceError.message}`);
      }

      const attendanceData = {
        id: attendanceResult[0]?.attendance_id,
        is_late: attendanceResult[0]?.is_late,
        late_minutes: attendanceResult[0]?.late_minutes,
        status: attendanceResult[0]?.status,
      };

      const validationRecords = [
        {
          attendance_record_id: attendanceData.id,
          organization_id: employee.organization_id,
          validation_type: 'location',
          validation_status: validation.location_valid ? 'valid' : 'invalid',
          validation_details: {
            distance_meters: validation.distance_meters,
            allowed_radius: validation.allowed_radius,
            office_location_id: validation.office_location_id || null,
            office_location_name: validation.office_location_name || null,
          } as Record<string, unknown>,
        },
        {
          attendance_record_id: attendanceData.id,
          organization_id: employee.organization_id,
          validation_type: 'face',
          validation_status: validation.face_valid ? 'valid' : 'invalid',
          validation_details: {
            face_registered: validation.face_registered,
          } as Record<string, unknown>,
        },
        {
          attendance_record_id: attendanceData.id,
          organization_id: employee.organization_id,
          validation_type: 'schedule',
          validation_status: validation.schedule_valid ? 'valid' : 'invalid',
          validation_details: {
            is_holiday: validation.is_holiday,
            is_late: validation.is_late,
            late_minutes: validation.late_minutes,
          } as Record<string, unknown>,
        },
        {
          attendance_record_id: attendanceData.id,
          organization_id: employee.organization_id,
          validation_type: 'overall',
          validation_status: validation.can_attend ? 'valid' : 'invalid',
          validation_details: validation as unknown as Record<string, unknown>,
        },
      ];

      const { error: validationInsertError } = await supabase
        .from('attendance_validations')
        .insert(validationRecords);

      if (validationInsertError) {
        console.error('⚠️ Warning: Failed to save validation records:', validationInsertError);
      }

      setHasCheckedIn(true);
      await checkTodayStatus();

      return attendanceData;
    },
    [employee, checkTodayStatus],
  );

  const checkIn = useCallback(
    async (imageDataUrl: string) => {
      if (!employee) {
        throw new Error('Employee not found');
      }

      setLoading(true);
      try {
        const hasOffices = await hasOfficeLocations(employee.organization_id);
        if (!hasOffices) {
          throw new Error(
            'Organisasi belum memiliki lokasi kantor. Silakan hubungi admin untuk mengatur lokasi kantor terlebih dahulu.',
          );
        }

        const location = await getCurrentLocation();

        const { data: validationResult, error: validationError } = await supabase.rpc(
          'validate_attendance_comprehensive',
          {
            employee_id_param: employee.id,
            organization_id_param: employee.organization_id,
            latitude_param: location.latitude,
            longitude_param: location.longitude,
            face_image_data: imageDataUrl,
            gps_accuracy_meters: location.accuracy > 0 ? location.accuracy : null,
            is_manual_location: false,
          },
        );

        if (validationError) {
          throw new Error('Gagal memvalidasi data absensi');
        }

        let validation = parseAttendanceValidationRow(validationResult) as AttendanceValidationForFixes | null;
        if (!validation) {
          throw new Error('Format respons validasi tidak valid');
        }

        if (!validation.can_attend && isClientVisitCheckinDay(validation)) {
          throw new Error(CLIENT_VISIT_CHECKIN_MESSAGE_ID);
        }

        if (!validation.can_attend) {
          const fixResult = await applyClientSideAttendanceFixes(
            validation,
            {
              id: employee.id,
              organization_id: employee.organization_id,
              user_id: employee.user_id,
            },
            {
              latitude: location.latitude,
              longitude: location.longitude,
              accuracy: location.accuracy,
            },
            imageDataUrl,
          );

          validation = fixResult.validation;

          if (fixResult.faceRegisteredToast) {
            toast(fixResult.faceRegisteredToast);
          }
          if (fixResult.ipLocationToast) {
            toast(fixResult.ipLocationToast);
          }

          if (!fixResult.canAttend) {
            throw new Error(fixResult.errorMessage);
          }
        }

        if (!validation.location_valid) {
          throw new Error(
            'Validasi lokasi gagal. Pastikan Anda berada di area kantor yang diizinkan atau hubungi admin untuk konfigurasi lokasi.',
          );
        }
        if (!validation.face_valid) {
          throw new Error(
            'Validasi wajah gagal. Pastikan wajah terlihat jelas atau hubungi admin untuk registrasi wajah.',
          );
        }
        if (!validation.no_duplicate) {
          throw new Error('Anda sudah melakukan absensi hari ini.');
        }

        const nearestOffice = await findNearestOfficeLocation(
          location.latitude,
          location.longitude,
          employee.organization_id || '',
        );
        if (!nearestOffice) {
          throw new Error('No office locations found for your organization');
        }

        if (validation.is_late) {
          pendingLateCheckInRef.current = {
            imageDataUrl,
            validation,
            location,
          };
          setLateMinutes(validation.late_minutes);
          setShowLateReasonModal(true);
          toast({
            title: 'Clock In Terlambat',
            description: `Anda terlambat ${validation.late_minutes} menit. Isi alasan lalu ketuk Simpan untuk mencatat absensi. Batal = tidak ada data absensi.`,
            variant: 'destructive',
          });
          return {
            id: undefined,
            is_late: true,
            late_minutes: validation.late_minutes,
            status: 'pending_reason',
          };
        }

        const localTimeString = formatLocalCheckinTimeString(new Date());
        const attendanceData = await finalizeCheckIn(
          imageDataUrl,
          validation,
          location,
          localTimeString,
          null,
        );

        toast({
          title: 'Clock In Berhasil',
          description: validation.location_valid
            ? 'Clock in berhasil! ✅ Lokasi valid'
            : `Clock in berhasil! ⚠️ Jarak dari kantor: ${Math.round(validation.distance_meters)}m`,
        });

        return attendanceData;
      } catch (error) {
        console.error('❌ Simple check-in error:', error);
        toast({
          title: 'Clock In Gagal',
          description: error instanceof Error ? error.message : 'Terjadi kesalahan saat clock in',
          variant: 'destructive',
        });
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [employee, getCurrentLocation, toast, finalizeCheckIn],
  );

  const checkOut = useCallback(
    async (imageDataUrl: string) => {
      if (!employee) {
        throw new Error('Employee not found');
      }

      setLoading(true);
      try {
        const location = await getCurrentLocation();
        const photoResult = await uploadAttendancePhoto(employee.id, imageDataUrl, 'check_out');

        const { data: checkoutValidationRaw, error: checkoutValidationError } = await supabase.rpc(
          'validate_checkout_comprehensive',
          {
            employee_id_param: employee.id,
            organization_id_param: employee.organization_id,
            photo_path_param: photoResult.path,
            face_image_data: imageDataUrl,
          },
        );

        if (checkoutValidationError) {
          throw new Error(`Validasi check-out gagal: ${checkoutValidationError.message}`);
        }

        const checkoutRow = Array.isArray(checkoutValidationRaw)
          ? checkoutValidationRaw[0]
          : checkoutValidationRaw;
        if (!checkoutRow?.can_checkout) {
          if (checkoutRow?.photo_required && !checkoutRow?.photo_valid) {
            throw new Error('Foto wajib untuk check-out sesuai aturan organisasi');
          }
          if (checkoutRow?.already_checked_out) {
            throw new Error('Anda sudah melakukan check-out hari ini');
          }
          throw new Error('Check-out tidak diizinkan');
        }

        const today = new Date().toISOString().split('T')[0];
        const { data: existingRecord, error: fetchError } = await supabase
          .from('attendance_records')
          .select('id, check_in_at, attendance_date, check_in_time, check_out_time')
          .eq('employee_id', employee.id)
          .eq('attendance_date', today)
          .single();

        if (fetchError || !existingRecord) {
          throw new Error('No check-in record found for today');
        }

        const rec = existingRecord as {
          check_in_at?: string | null;
          attendance_date?: string | null;
          check_in_time?: string | null;
        };
        const checkInTime =
          rec.check_in_at != null && String(rec.check_in_at).trim() !== ''
            ? new Date(rec.check_in_at)
            : rec.attendance_date && rec.check_in_time
              ? new Date(`${rec.attendance_date}T${String(rec.check_in_time)}`)
              : new Date(existingRecord.check_in_time as string);
        const checkOutTime = new Date();
        const workingMinutes = Math.floor(
          (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60),
        );

        const { data, error } = await supabase
          .from('attendance_records')
          .update({
            check_out_time: dateToPostgresTimeUtc(checkOutTime),
            check_out_at: checkOutTime.toISOString(),
            check_out_location: {
              latitude: location.latitude,
              longitude: location.longitude,
              address: location.address || 'Unknown',
              formatted_address: location.formatted_address || 'Unknown',
            },
            check_out_photo_path: photoResult.path,
            working_hours_minutes: workingMinutes,
          })
          .eq('id', existingRecord.id)
          .select('*')
          .single();

        if (error) {
          throw new Error(`Failed to save check-out: ${error.message}`);
        }

        setHasCheckedOut(true);
        setLastCheckOut(checkOutTime.toISOString());

        toast({
          title: 'Clock Out Berhasil',
          description: `Waktu kerja: ${Math.floor(workingMinutes / 60)} jam ${workingMinutes % 60} menit`,
        });

        return data;
      } catch (error) {
        console.error('❌ Simple check-out error:', error);
        toast({
          title: 'Clock Out Gagal',
          description: error instanceof Error ? error.message : 'Terjadi kesalahan saat clock out',
          variant: 'destructive',
        });
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [employee, getCurrentLocation, toast],
  );

  const handleSimpleAttendance = useCallback(
    async (type: 'checkin' | 'checkout', imageDataUrl: string) => {
      if (type === 'checkin') {
        await checkIn(imageDataUrl);
      } else {
        await checkOut(imageDataUrl);
      }
    },
    [checkIn, checkOut],
  );

  const saveLateReason = useCallback(
    async (reason: string) => {
      const pending = pendingLateCheckInRef.current;
      if (!pending) {
        throw new Error('Tidak ada absensi terlambat yang menunggu konfirmasi');
      }

      const localTimeString = formatLocalCheckinTimeString(new Date());

      await finalizeCheckIn(
        pending.imageDataUrl,
        pending.validation,
        pending.location,
        localTimeString,
        reason,
      );

      pendingLateCheckInRef.current = null;
      setShowLateReasonModal(false);
      setLateMinutes(0);

      toast({
        title: 'Absensi tersimpan',
        description: 'Alasan keterlambatan dan clock in berhasil dicatat.',
      });
    },
    [finalizeCheckIn, toast],
  );

  return {
    loading,
    hasCheckedIn,
    hasCheckedOut,
    lastCheckIn,
    lastCheckOut,
    showLateReasonModal,
    lateMinutes,
    handleSimpleAttendance,
    checkIn,
    checkOut,
    saveLateReason,
    closeLateReasonModal: () => {
      pendingLateCheckInRef.current = null;
      setShowLateReasonModal(false);
      setLateMinutes(0);
    },
  };
};

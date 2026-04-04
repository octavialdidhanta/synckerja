import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useLocationServices, type LocationData } from './useLocationServices';
import { findNearestOfficeLocation } from '../utils/officeLocationUtils';
import { hasOfficeLocations } from '../utils/officeLocationValidation';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { useToast } from '@/shared/components/ui/use-toast';
import { logger } from '@/shared/lib/logger';
import { attendanceInstantToIso, dateToPostgresTimeUtc } from '@/1-home/utils/attendanceDateTime';

export interface PhotoUploadResult {
  url: string;
  path: string;
}

interface WorkSchedule {
  id: string;
  start_time: string;
  end_time: string;
  late_tolerance_minutes: number;
  working_days: number[];
}

interface AttendanceValidationResult {
  location_valid: boolean;
  face_valid: boolean;
  schedule_valid: boolean;
  no_duplicate: boolean;
  is_holiday: boolean;
  is_late: boolean;
  late_minutes: number;
  office_location_id?: string;
  office_location_name?: string;
  distance_meters: number;
  allowed_radius: number;
  face_registered: boolean;
  can_attend: boolean;
}

/** Pending late check-in: no row in attendance_records until user submits reason in modal. */
interface PendingLateCheckIn {
  imageDataUrl: string;
  validation: AttendanceValidationResult;
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
  
  const { getCurrentLocation, validateLocationForAttendance } = useLocationServices();
  const { data: employee } = useCurrentEmployee();
  const { toast } = useToast();

  // Check today's attendance status on mount
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
        attendanceInstantToIso(record.attendance_date, record.check_in_time, record.check_in_at)
      );
      setLastCheckOut(
        attendanceInstantToIso(record.attendance_date, record.check_out_time, record.check_out_at)
      );

      logger.debug('📋 Local state updated:', {
        hasCheckedIn: hasIn,
        hasCheckedOut: hasOut,
        lastCheckIn: record.check_in_time,
        lastCheckOut: record.check_out_time
      });
    } else {
      logger.debug('📋 No attendance record found for today');
      setHasCheckedIn(false);
      setHasCheckedOut(false);
      setLastCheckIn(null);
      setLastCheckOut(null);
    }
  }, [employee?.id]);

  useEffect(() => {
    checkTodayStatus();
  }, [checkTodayStatus]);

  const uploadPhoto = useCallback(async (
    imageDataUrl: string, 
    type: 'check_in' | 'check_out'
  ): Promise<PhotoUploadResult> => {
    if (!employee?.id) {
      throw new Error('Employee ID not found');
    }

    logger.debug('📸 Uploading', type.replace('_', '-'), 'photo...');
    
    // Convert base64 to blob
    const base64Data = imageDataUrl.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${type}_${timestamp}.jpg`;
    const filePath = `${employee.id}/${fileName}`;

    logger.debug('Uploading photo to:', filePath);

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('attendance-photos')
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Photo upload error:', uploadError);
      throw new Error(`Photo upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('attendance-photos')
      .getPublicUrl(filePath);

    logger.debug('Photo uploaded successfully:', publicUrl);
    logger.debug('✅ Photo uploaded:', publicUrl);

    return {
      url: publicUrl,
      path: filePath
    };
  }, [employee?.id]);

  const finalizeCheckIn = useCallback(
    async (
      imageDataUrl: string,
      validation: AttendanceValidationResult,
      location: LocationData,
      localTimeString: string,
      notes: string | null,
    ) => {
      if (!employee) {
        throw new Error('Employee not found');
      }

      const photoResult = await uploadPhoto(imageDataUrl, 'check_in');

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
        if (attendanceError.code === '23502') {
          throw new Error(
            'Lokasi kantor belum dikonfigurasi. Silakan hubungi admin untuk mengatur lokasi kantor terlebih dahulu.',
          );
        } else if (attendanceError.message.includes('Office location required')) {
          throw new Error(
            'Lokasi kantor diperlukan untuk absensi. Silakan hubungi admin untuk mengatur lokasi kantor terlebih dahulu.',
          );
        } else {
          throw new Error(`Gagal menyimpan data absensi: ${attendanceError.message}`);
        }
      }

      logger.debug('✅ Attendance recorded successfully:', attendanceResult);

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
      } else {
        logger.debug('✅ Validation records saved successfully');
      }

      setHasCheckedIn(true);
      await checkTodayStatus();

      return attendanceData;
    },
    [employee, uploadPhoto, checkTodayStatus],
  );

  const getWorkSchedule = useCallback(async (): Promise<WorkSchedule | null> => {
    if (!employee?.organization_id) return null;

    // First try to get employee-specific schedule
    let workSchedule: WorkSchedule | null = null;
    
    if (employee.work_schedule_id) {
      const { data: employeeSchedule, error: employeeError } = await supabase
        .from('work_schedule_settings')
        .select('id, start_time, end_time, late_tolerance_minutes, working_days')
        .eq('id', employee.work_schedule_id)
        .eq('is_active', true)
        .single();

      if (!employeeError && employeeSchedule) {
        workSchedule = employeeSchedule;
      }
    }

    // If no employee-specific schedule, get organization default
    if (!workSchedule) {
      const { data: defaultSchedule, error: defaultError } = await supabase
        .from('work_schedule_settings')
        .select('id, start_time, end_time, late_tolerance_minutes, working_days')
        .eq('organization_id', employee.organization_id)
        .eq('is_active', true)
        .eq('is_default', true)
        .single();

      if (!defaultError && defaultSchedule) {
        workSchedule = defaultSchedule;
      }
    }

    return workSchedule;
  }, [employee]);

  const calculateLateStatus = useCallback((workSchedule: WorkSchedule, checkInTime: Date) => {
    const currentDay = checkInTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Check if today is a working day
    if (!workSchedule.working_days.includes(currentDay)) {
      return { isLate: false, lateMinutes: 0 };
    }

    // Parse start time from work schedule
    const [startHour, startMinute, startSecond] = workSchedule.start_time.split(':').map(Number);
    const scheduledStartTime = new Date(checkInTime);
    scheduledStartTime.setHours(startHour, startMinute, startSecond || 0, 0);

    // Add late tolerance
    const toleranceTime = new Date(scheduledStartTime);
    toleranceTime.setMinutes(toleranceTime.getMinutes() + workSchedule.late_tolerance_minutes);

    // Check if check-in time is after tolerance time
    const isLate = checkInTime > toleranceTime;
    const lateMinutes = isLate ? Math.floor((checkInTime.getTime() - scheduledStartTime.getTime()) / (1000 * 60)) : 0;

    logger.debug('⏰ Late calculation:', {
      checkInTime: checkInTime.toLocaleTimeString(),
      scheduledStart: scheduledStartTime.toLocaleTimeString(),
      toleranceEnd: toleranceTime.toLocaleTimeString(),
      isLate,
      lateMinutes,
      currentDay,
      workingDays: workSchedule.working_days
    });

    return { isLate, lateMinutes };
  }, []);

  const checkIn = useCallback(async (imageDataUrl: string) => {
    if (!employee) {
      throw new Error('Employee not found');
    }

    setLoading(true);
    try {
      // STEP 0: Check if organization has office locations before proceeding
      logger.debug('🏢 Checking if organization has office locations...');
      const hasOffices = await hasOfficeLocations(employee.organization_id);
      
      if (!hasOffices) {
        throw new Error('Organisasi belum memiliki lokasi kantor. Silakan hubungi admin untuk mengatur lokasi kantor terlebih dahulu.');
      }
      // Get current location
      const location = await getCurrentLocation();
      logger.debug('📍 Current location:', { 
        latitude: location.latitude, 
        longitude: location.longitude 
      });

      // STEP 1: Run comprehensive validation BEFORE proceeding
      logger.debug('🔍 Running attendance validation...');
      const { data: validationResult, error: validationError } = await supabase
        .rpc('validate_attendance_comprehensive', {
          employee_id_param: employee.id,
          organization_id_param: employee.organization_id,
          latitude_param: location.latitude,
          longitude_param: location.longitude,
          face_image_data: imageDataUrl
        });

      if (validationError) {
        console.error('❌ Validation error:', validationError);
        throw new Error('Gagal memvalidasi data absensi');
      }

      logger.debug('✅ Validation result:', validationResult);
      logger.debug('🕐 Current time for debugging:', new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }));

      // Cast to proper type safely
      const validation = validationResult[0] as AttendanceValidationResult;

      // STEP 2: Handle validation results and face registration
      if (!validation.can_attend) {
        let errorMessage = 'Absensi tidak diizinkan:';
        
        // Handle face registration for unregistered faces
        if (!validation.face_valid && !validation.face_registered) {
          // If face is not registered, allow auto-registration
          try {
            logger.debug('🎭 Face not registered, attempting auto-registration...');
            
            // First check if there's already an active registration for this employee
            const { data: existingReg } = await supabase
              .from('employee_face_registrations')
              .select('id')
              .eq('employee_id', employee.id)
              .eq('is_active', true)
              .limit(1);

            if (existingReg && existingReg.length > 0) {
              logger.debug('✅ Face registration already exists, updating validation');
              validation.face_valid = true;
              validation.face_registered = true;
            } else {
              // Create new face registration
              const { data: faceRegResult, error: faceRegError } = await supabase
                .from('employee_face_registrations')
                .insert({
                  employee_id: employee.id,
                  organization_id: employee.organization_id,
                  face_encoding: btoa(imageDataUrl), // Base64 encode the image
                  face_image_url: null, // We'll update this after upload
                  is_active: true,
                  confidence_threshold: 0.8,
                  created_by: employee.user_id
                })
                .select()
                .single();

              if (faceRegError) {
                console.error('❌ Face registration error:', faceRegError);
                if (faceRegError.code === '23505') {
                  // Unique constraint violation - face already registered
                  logger.debug('✅ Face already registered (unique constraint), proceeding...');
                  validation.face_valid = true;
                  validation.face_registered = true;
                } else {
                  errorMessage += '\n- Wajah tidak terdaftar dan gagal didaftarkan otomatis';
                }
              } else {
                logger.debug('✅ Face registered automatically:', faceRegResult);
                // Update validation to reflect successful face registration
                validation.face_valid = true;
                validation.face_registered = true;
                
                toast({
                  title: "Wajah Terdaftar",
                  description: "Wajah Anda berhasil didaftarkan untuk absensi selanjutnya",
                });
              }
            }
          } catch (regError) {
            console.error('❌ Auto face registration failed:', regError);
            errorMessage += '\n- Wajah tidak terdaftar dan gagal didaftarkan otomatis';
          }
        } else if (!validation.face_valid && validation.face_registered) {
          errorMessage += '\n- Wajah tidak cocok dengan yang terdaftar';
        }
        
        // Handle location validation with IP fallback for desktop
        if (!validation.location_valid) {
          const distance = validation.distance_meters || 0;
          const maxRadius = validation.allowed_radius || 1000;
          
          logger.debug('🌐 Location validation failed, trying IP-based validation...');
          try {
            const ipResponse = await fetch('https://ipapi.co/json/');
            const ipData = await ipResponse.json();
            logger.debug('🌐 User IP detected:', ipData.ip);
            
            if (ipData.ip) {
              // Check if the IP is in the allowed list
              const { data: allowedIPs, error: ipError } = await supabase
                .from('allowed_ip_addresses')
                .select('ip_address, name')
                .eq('organization_id', employee.organization_id)
                .eq('is_active', true);

              logger.debug('🌐 Allowed IPs:', allowedIPs);

              if (!ipError && allowedIPs && allowedIPs.length > 0) {
                const matchedIP = allowedIPs.find(allowedIP => {
                  // Check for exact match
                  if (allowedIP.ip_address === ipData.ip) {
                    logger.debug('✅ Exact IP match found:', allowedIP.ip_address);
                    return true;
                  }
                  
                  // Check CIDR ranges
                  if (allowedIP.ip_address.includes('/')) {
                    const [network, prefixLength] = allowedIP.ip_address.split('/');
                    const userIPParts = ipData.ip.split('.').map(Number);
                    const networkParts = network.split('.').map(Number);
                    const prefix = parseInt(prefixLength);
                    
                    // Support common CIDR ranges
                    if (prefix === 24) {
                      // /24 subnet (xxx.xxx.xxx.0/24)
                      const match = userIPParts[0] === networkParts[0] && 
                                   userIPParts[1] === networkParts[1] && 
                                   userIPParts[2] === networkParts[2];
                      if (match) logger.debug('✅ CIDR /24 match found:', allowedIP.ip_address);
                      return match;
                    } else if (prefix === 16) {
                      // /16 subnet (xxx.xxx.0.0/16)
                      const match = userIPParts[0] === networkParts[0] && 
                                   userIPParts[1] === networkParts[1];
                      if (match) logger.debug('✅ CIDR /16 match found:', allowedIP.ip_address);
                      return match;
                    }
                  }
                  
                  return false;
                });

                if (matchedIP) {
                  validation.location_valid = true;
                  validation.distance_meters = 0; // Set to 0 for IP-based validation
                  logger.debug('✅ IP-based location validation successful with:', matchedIP.name);
                  
                  toast({
                    title: "Lokasi Terdeteksi via WiFi",
                    description: `Terhubung ke ${matchedIP.name} - IP diizinkan untuk absensi`,
                  });
                } else {
                  logger.debug('❌ IP not in allowed list. Current IP:', ipData.ip);
                  logger.debug('❌ Allowed IPs:', allowedIPs.map(ip => ip.ip_address));
                  
                  if (distance > 0 && !isNaN(distance)) {
                    errorMessage += `\n- Lokasi terlalu jauh (${Math.round(distance)}m dari kantor, maksimal ${maxRadius}m)`;
                  }
                  errorMessage += `\n- IP Address ${ipData.ip} tidak terdaftar dalam daftar WiFi yang diizinkan`;
                  errorMessage += `\n- Pastikan Anda terhubung ke WiFi kantor atau hubungi admin untuk menambahkan IP Address Anda`;
                }
              } else {
                logger.debug('❌ No allowed IPs configured or error fetching IPs');
                if (distance > 0 && !isNaN(distance)) {
                  errorMessage += `\n- Lokasi terlalu jauh (${Math.round(distance)}m dari kantor, maksimal ${maxRadius}m)`;
                } else {
                  errorMessage += `\n- Tidak dapat mendeteksi lokasi yang valid`;
                }
              }
            } else {
              logger.debug('❌ Unable to detect IP');
              errorMessage += `\n- Tidak dapat mendeteksi lokasi atau IP Address`;
            }
          } catch (ipError) {
            console.error('❌ IP location detection failed:', ipError);
            if (distance > 0 && !isNaN(distance)) {
              errorMessage += `\n- Lokasi terlalu jauh (${Math.round(distance)}m dari kantor, maksimal ${maxRadius}m)`;
            } else {
              errorMessage += `\n- Tidak dapat mendeteksi lokasi yang valid`;
            }
          }
        }
        
        if (!validation.schedule_valid) {
          logger.debug('⚠️ Schedule validation failed, but allowing with late check');
          errorMessage += '\n- Di luar jam kerja (akan dicatat sebagai terlambat)';
          // Don't block attendance for schedule issues - allow late attendance
          validation.schedule_valid = true; // Override for late attendance
        }
        
        if (!validation.no_duplicate) {
          logger.debug('❌ Duplicate attendance detected');
          errorMessage += '\n- Sudah melakukan absensi hari ini';
          // This is a hard block - cannot bypass
        }
        
        if (validation.is_holiday) {
          logger.debug('🏖️ Holiday detected, but allowing attendance');
          errorMessage += '\n- Hari ini adalah hari libur (absensi masih diizinkan)';
          // Allow attendance on holidays if needed
        }
        
        // Update can_attend with more flexible rules
        validation.can_attend = validation.face_valid && validation.location_valid && validation.no_duplicate;
        
        logger.debug('🔍 Updated validation after fixes:', {
          face_valid: validation.face_valid,
          location_valid: validation.location_valid,
          schedule_valid: validation.schedule_valid,
          no_duplicate: validation.no_duplicate,
          can_attend: validation.can_attend
        });
        
        // If still can't attend after fixes, throw error
        if (!validation.can_attend) {
          throw new Error(errorMessage);
        }
      }

      // CRITICAL VALIDATION: Check mandatory validations before recording
      logger.debug('🔒 Final validation check before recording:', {
        location_valid: validation.location_valid,
        schedule_valid: validation.schedule_valid,
        face_valid: validation.face_valid,
        no_duplicate: validation.no_duplicate,
        can_attend: validation.can_attend
      });

      // Mandatory validations that cannot be bypassed
      if (!validation.location_valid) {
        throw new Error('Validasi lokasi gagal. Pastikan Anda berada di area kantor yang diizinkan atau hubungi admin untuk konfigurasi lokasi.');
      }

      if (!validation.face_valid) {
        throw new Error('Validasi wajah gagal. Pastikan wajah terlihat jelas atau hubungi admin untuk registrasi wajah.');
      }

      if (!validation.no_duplicate) {
        throw new Error('Anda sudah melakukan absensi hari ini.');
      }

      // Schedule validation is flexible - allow late attendance with reason
      // Schedule validation will be handled during the attendance recording process

      // Find nearest office (for additional info)
      const nearestOffice = await findNearestOfficeLocation(
        location.latitude,
        location.longitude,
        employee.organization_id || ''
      );

      if (!nearestOffice) {
        throw new Error('No office locations found for your organization');
      }

      // Terlambat: tidak upload / tidak INSERT sampai user isi alasan dan ketuk Simpan
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
      logger.debug('💾 Recording attendance with local time:', localTimeString);

      const attendanceData = await finalizeCheckIn(
        imageDataUrl,
        validation,
        location,
        localTimeString,
        null,
      );

      logger.debug('✅ Attendance record saved:', attendanceData);

      const message = validation.location_valid
        ? 'Clock in berhasil! ✅ Lokasi valid'
        : `Clock in berhasil! ⚠️ Jarak dari kantor: ${Math.round(validation.distance_meters)}m`;

      toast({
        title: 'Clock In Berhasil',
        description: message,
      });

      return attendanceData;
    } catch (error) {
      console.error('❌ Simple check-in error:', error);
      toast({
        title: "Clock In Gagal",
        description: error instanceof Error ? error.message : 'Terjadi kesalahan saat clock in',
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [employee, getCurrentLocation, toast, finalizeCheckIn]);

  const checkOut = useCallback(async (imageDataUrl: string) => {
    if (!employee) {
      throw new Error('Employee not found');
    }

    setLoading(true);
    try {
      // Get current location
      const location = await getCurrentLocation();

      // Upload photo
      const photoResult = await uploadPhoto(imageDataUrl, 'check_out');

      // Get today's attendance record
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

      // Prefer timestamptz from RPC; fall back to date + time columns
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
      const workingMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));

      // Update record with check-out info
      const { data, error } = await supabase
        .from('attendance_records')
        .update({
          check_out_time: dateToPostgresTimeUtc(checkOutTime),
          check_out_at: checkOutTime.toISOString(),
          check_out_location: {
            latitude: location.latitude,
            longitude: location.longitude,
            address: location.address || 'Unknown',
            formatted_address: location.formatted_address || 'Unknown'
          },
          check_out_photo_path: photoResult.path,
          working_hours_minutes: workingMinutes
        })
        .eq('id', existingRecord.id)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to save check-out: ${error.message}`);
      }

      // Update local state
      setHasCheckedOut(true);
      setLastCheckOut(checkOutTime.toISOString());

      toast({
        title: "Clock Out Berhasil",
        description: `Waktu kerja: ${Math.floor(workingMinutes / 60)} jam ${workingMinutes % 60} menit`,
      });

      return data;
    } catch (error) {
      console.error('❌ Simple check-out error:', error);
      toast({
        title: "Clock Out Gagal",
        description: error instanceof Error ? error.message : 'Terjadi kesalahan saat clock out',
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [employee, getCurrentLocation, uploadPhoto, toast]);

  const handleSimpleAttendance = useCallback(async (
    type: 'checkin' | 'checkout',
    imageDataUrl: string
  ) => {
    try {
      if (type === 'checkin') {
        await checkIn(imageDataUrl);
      } else {
        await checkOut(imageDataUrl);
      }
    } catch (error) {
      console.error(`❌ Clock-${type} failed:`, error);
      throw error;
    }
  }, [checkIn, checkOut]);

  /** After user confirms late reason: create attendance row (with notes) — waktu check-in = saat Simpan. */
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


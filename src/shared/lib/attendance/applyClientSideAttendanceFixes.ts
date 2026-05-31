import { supabase } from '@/shared/lib/supabaseClient';
import { parseAttendanceValidationRow } from '@/shared/attendance/resolveEffectiveSchedule';
import {
  CLIENT_VISIT_CHECKIN_MESSAGE_ID,
  isClientVisitCheckinDay,
} from './attendanceValidationMessages';
import type { ClientFixValidationInput } from './resolveCanAttendAfterClientFixes';
import {
  enforceNationalHolidaysFromSnapshot,
  resolveCanAttendAfterClientFixes,
} from './resolveCanAttendAfterClientFixes';

export type AttendanceValidationForFixes = ClientFixValidationInput & {
  can_attend: boolean;
  face_registered: boolean;
  distance_meters: number;
  allowed_radius: number;
  is_late?: boolean;
  late_minutes?: number;
  shift_id?: string | null;
  employee_shift_id?: string | null;
  work_schedule_id?: string | null;
  schedule_source?: string | null;
  start_time?: string | null;
  working_days?: number[] | null;
  office_location_id?: string | null;
  office_location_name?: string | null;
  visit_day_mode?: string | null;
};

interface EmployeeContext {
  id: string;
  organization_id: string;
  user_id?: string | null;
}

interface LocationContext {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface ApplyClientFixesResult {
  validation: AttendanceValidationForFixes;
  errorMessage: string;
  canAttend: boolean;
  faceRegisteredToast?: { title: string; description: string };
  ipLocationToast?: { title: string; description: string };
}

function appendHardBlockMessages(
  validation: AttendanceValidationForFixes,
  hasPhoto: boolean,
  lines: string[],
): void {
  if (!validation.schedule_valid) {
    lines.push('- Bukan hari kerja sesuai jadwal');
  }
  if (!validation.no_duplicate) {
    lines.push('- Sudah melakukan absensi hari ini');
  }
  if (validation.is_holiday && enforceNationalHolidaysFromSnapshot(validation.attendance_rules_snapshot)) {
    lines.push('- Hari ini adalah hari libur');
  }
  if (validation.gps_accuracy_valid === false) {
    lines.push('- Akurasi GPS tidak memenuhi threshold organisasi');
  }
  if (validation.photo_required && !hasPhoto) {
    lines.push('- Foto wajib untuk check-in');
  }
}

async function revalidateAttendance(
  employee: EmployeeContext,
  location: LocationContext,
  imageDataUrl: string,
): Promise<AttendanceValidationForFixes | null> {
  const { data, error } = await supabase.rpc('validate_attendance_comprehensive', {
    employee_id_param: employee.id,
    organization_id_param: employee.organization_id,
    latitude_param: location.latitude,
    longitude_param: location.longitude,
    face_image_data: imageDataUrl,
    gps_accuracy_meters:
      location.accuracy != null && location.accuracy > 0 ? location.accuracy : null,
    is_manual_location: false,
  });

  if (error || !data) return null;
  const row = parseAttendanceValidationRow(data);
  if (!row) return null;
  return row as AttendanceValidationForFixes;
}

function ipMatchesAllowed(userIp: string, allowedIp: string): boolean {
  if (allowedIp === userIp) return true;
  if (!allowedIp.includes('/')) return false;

  const [network, prefixLength] = allowedIp.split('/');
  const userIPParts = userIp.split('.').map(Number);
  const networkParts = network.split('.').map(Number);
  const prefix = parseInt(prefixLength, 10);

  if (prefix === 24) {
    return (
      userIPParts[0] === networkParts[0] &&
      userIPParts[1] === networkParts[1] &&
      userIPParts[2] === networkParts[2]
    );
  }
  if (prefix === 16) {
    return userIPParts[0] === networkParts[0] && userIPParts[1] === networkParts[1];
  }
  return false;
}

async function tryAutoRegisterFace(
  employee: EmployeeContext,
  imageDataUrl: string,
): Promise<{ ok: boolean; faceRegisteredToast?: ApplyClientFixesResult['faceRegisteredToast'] }> {
  const { data: existingReg } = await supabase
    .from('employee_face_registrations')
    .select('id')
    .eq('employee_id', employee.id)
    .eq('is_active', true)
    .limit(1);

  if (existingReg && existingReg.length > 0) {
    return { ok: true };
  }

  const { error: faceRegError } = await supabase.from('employee_face_registrations').insert({
    employee_id: employee.id,
    organization_id: employee.organization_id,
    face_encoding: btoa(imageDataUrl),
    face_image_url: null,
    is_active: true,
    confidence_threshold: 0.8,
    created_by: employee.user_id,
  });

  if (faceRegError) {
    if (faceRegError.code === '23505') return { ok: true };
    return { ok: false };
  }

  return {
    ok: true,
    faceRegisteredToast: {
      title: 'Wajah Terdaftar',
      description: 'Wajah Anda berhasil didaftarkan untuk absensi selanjutnya',
    },
  };
}

async function tryIpLocationFallback(
  employee: EmployeeContext,
  validation: AttendanceValidationForFixes,
  errorLines: string[],
): Promise<{ locationFixed: boolean; ipLocationToast?: ApplyClientFixesResult['ipLocationToast'] }> {
  if (validation.location_valid) {
    return { locationFixed: true };
  }

  const distance = validation.distance_meters || 0;
  const maxRadius = validation.allowed_radius || 1000;

  try {
    const ipResponse = await fetch('https://ipapi.co/json/');
    const ipData = (await ipResponse.json()) as { ip?: string };

    if (!ipData.ip) {
      errorLines.push('- Tidak dapat mendeteksi lokasi atau IP Address');
      return { locationFixed: false };
    }

    const { data: allowedIPs, error: ipError } = await supabase
      .from('allowed_ip_addresses')
      .select('ip_address, name')
      .eq('organization_id', employee.organization_id)
      .eq('is_active', true);

    if (ipError || !allowedIPs?.length) {
      if (distance > 0 && !Number.isNaN(distance)) {
        errorLines.push(
          `- Lokasi terlalu jauh (${Math.round(distance)}m dari kantor, maksimal ${maxRadius}m)`,
        );
      } else {
        errorLines.push('- Tidak dapat mendeteksi lokasi yang valid');
      }
      return { locationFixed: false };
    }

    const matchedIP = allowedIPs.find((row) => ipMatchesAllowed(ipData.ip!, row.ip_address));

    if (!matchedIP) {
      if (distance > 0 && !Number.isNaN(distance)) {
        errorLines.push(
          `- Lokasi terlalu jauh (${Math.round(distance)}m dari kantor, maksimal ${maxRadius}m)`,
        );
      }
      errorLines.push(`- IP Address ${ipData.ip} tidak terdaftar dalam daftar WiFi yang diizinkan`);
      errorLines.push(
        '- Pastikan Anda terhubung ke WiFi kantor atau hubungi admin untuk menambahkan IP Address Anda',
      );
      return { locationFixed: false };
    }

    validation.location_valid = true;
    validation.distance_meters = 0;
    return {
      locationFixed: true,
      ipLocationToast: {
        title: 'Lokasi Terdeteksi via WiFi',
        description: `Terhubung ke ${matchedIP.name} - IP diizinkan untuk absensi`,
      },
    };
  } catch {
    if (distance > 0 && !Number.isNaN(distance)) {
      errorLines.push(
        `- Lokasi terlalu jauh (${Math.round(distance)}m dari kantor, maksimal ${maxRadius}m)`,
      );
    } else {
      errorLines.push('- Tidak dapat mendeteksi lokasi yang valid');
    }
    return { locationFixed: false };
  }
}

/** Apply desktop-only face auto-register + IP fallback; RPC remains authoritative for hard blocks. */
export async function applyClientSideAttendanceFixes(
  initialValidation: AttendanceValidationForFixes,
  employee: EmployeeContext,
  location: LocationContext,
  imageDataUrl: string,
): Promise<ApplyClientFixesResult> {
  if (!initialValidation.can_attend && isClientVisitCheckinDay(initialValidation)) {
    return {
      validation: initialValidation,
      errorMessage: CLIENT_VISIT_CHECKIN_MESSAGE_ID,
      canAttend: false,
    };
  }

  let validation = { ...initialValidation };
  const errorLines: string[] = ['Absensi tidak diizinkan:'];
  let faceRegisteredToast: ApplyClientFixesResult['faceRegisteredToast'];
  let ipLocationToast: ApplyClientFixesResult['ipLocationToast'];

  if (!validation.can_attend) {
    if (!validation.face_valid && !validation.face_registered) {
      const faceResult = await tryAutoRegisterFace(employee, imageDataUrl);
      if (faceResult.ok) {
        faceRegisteredToast = faceResult.faceRegisteredToast;
        const revalidated = await revalidateAttendance(employee, location, imageDataUrl);
        if (revalidated) {
          validation = revalidated;
        } else {
          validation.face_valid = true;
          validation.face_registered = true;
        }
      } else {
        errorLines.push('- Wajah tidak terdaftar dan gagal didaftarkan otomatis');
      }
    } else if (!validation.face_valid && validation.face_registered) {
      errorLines.push('- Wajah tidak cocok dengan yang terdaftar');
    }

    if (!validation.location_valid) {
      const ipResult = await tryIpLocationFallback(employee, validation, errorLines);
      ipLocationToast = ipResult.ipLocationToast;
      if (!ipResult.locationFixed && !validation.location_valid) {
        errorLines.push(
          '- Validasi lokasi gagal. Pastikan Anda berada di area kantor yang diizinkan atau hubungi admin.',
        );
      }
    }

    appendHardBlockMessages(validation, Boolean(imageDataUrl?.trim()), errorLines);
  }

  const canAttend = resolveCanAttendAfterClientFixes(validation, {
    hasPhoto: Boolean(imageDataUrl?.trim()),
  });
  validation.can_attend = canAttend;

  return {
    validation,
    errorMessage: errorLines.join('\n'),
    canAttend,
    faceRegisteredToast,
    ipLocationToast,
  };
}

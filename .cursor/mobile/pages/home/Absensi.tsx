import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, RefreshCw, Loader2, CircleCheck, ClipboardList, NotebookPen } from "lucide-react";
import { TimeDisplay } from "@/mobile/components/TimeDisplay";
import { LocationChecker, LocationButton } from "@/mobile/components/LocationChecker";
import { AttendanceStatus } from "@/mobile/components/AttendanceStatus";
import { AttendanceActions } from "@/mobile/components/AttendanceActions";
import { TodaySchedule } from "@/mobile/components/TodaySchedule";
import { NavigationFooter } from "@/mobile/components/NavigationFooter";
import { DesktopWarning } from "@/mobile/components/DesktopWarning";
import { AppSidebar } from "@/mobile/components/AppSidebar";
import { CameraModal } from "@/mobile/components/CameraModal";
import { LateAttendanceModal } from "@/mobile/components/LateAttendanceModal";
import { SidebarProvider, SidebarTrigger } from "@/mobile/components/ui/sidebar";
import { AbsensiSkeleton } from "./AbsensiSkeleton";
import { Button } from "@/mobile/components/ui/button";
import { useToast } from "@/features/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/config/logger";
import { useAttendanceData } from "@/mobile/hooks/useAttendanceData";
import { RealtimeStatusIndicator } from "@/mobile/components/RealtimeStatusIndicator";
import { useRealtimePresence } from "@/mobile/hooks/useRealtimePresence";
import { useVisualViewport } from "@/mobile/hooks/useVisualViewport";
import { useStatusBarStyle } from "@/mobile/hooks/useStatusBarStyle";
import { LiveChatAppBadgeSync } from "@/features/5-3-whatsapp/components/LiveChatAppBadgeSync";
import { getCurrentPosition } from "@/mobile/utils/geolocation";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { useProfile } from "@/mobile/hooks/useProfile";
import { NotificationsModal } from "@/mobile/components/NotificationsModal";
import { useNotificationBadgeCount } from "@/mobile/hooks/useNotificationBadgeCount";

function getGreetingKey(hour: number): 'morning' | 'noon' | 'afternoon' | 'night' {
  if (hour >= 18) return 'night';
  if (hour >= 15) return 'afternoon';
  if (hour >= 11) return 'noon';
  return 'morning';
}

function notifDebugHome(event: string, payload?: unknown) {
  try {
    const body = payload == null ? "" : ` ${JSON.stringify(payload)}`;
    console.info(`[NOTIF_DEBUG][home] ${event}${body}`);
  } catch {
    console.info(`[NOTIF_DEBUG][home] ${event} [payload-unserializable]`);
  }
}

let confetti: ((opts?: object) => void) | undefined;
try {
  // Optional import to avoid build error if package not installed
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  confetti = require("canvas-confetti");
} catch {}

const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
const PULL_RESISTANCE = 0.55;

const Absensi = () => {
  useStatusBarStyle('light');
  const { toast } = useToast();
  const { t, language } = useAppTranslation();
  const timeLocale = language === "id" ? "id-ID" : "en-US";
  const [cameraModal, setCameraModal] = useState<{
    isOpen: boolean;
    type: 'clockin' | 'clockout' | null;
  }>({
    isOpen: false,
    type: null
  });
  const [lateModal, setLateModal] = useState<{
    isOpen: boolean;
    lateMinutes: number;
    scheduledTime: string;
    pendingClockIn: boolean;
  }>({
    isOpen: false,
    lateMinutes: 0,
    scheduledTime: '',
    pendingClockIn: false
  });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [initialNotificationsTab, setInitialNotificationsTab] = useState<"comments" | "tasks" | "updates" | undefined>(undefined);
  const [initialPostedLinksPlanId, setInitialPostedLinksPlanId] = useState<string | undefined>(undefined);
  const [initialPostedLinksPlanTitle, setInitialPostedLinksPlanTitle] = useState<string | undefined>(undefined);
  const [initialPostedLinksForceOpen, setInitialPostedLinksForceOpen] = useState<boolean>(false);

  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const state = location.state as {
      reopenNotifications?: boolean;
      openNotificationsTab?: "comments" | "tasks" | "updates";
      openPostedLinksModal?: boolean;
      openPostedLinksForceOpen?: boolean;
      openPostedLinksPlanId?: string;
      openPostedLinksPlanTitle?: string;
    } | null;
    notifDebugHome("location.state", state);
    if (state?.reopenNotifications) {
      setNotificationsOpen(true);
      setInitialNotificationsTab(state.openNotificationsTab);
      if (state.openPostedLinksPlanId) {
        setInitialPostedLinksPlanId(state.openPostedLinksPlanId);
        setInitialPostedLinksPlanTitle(state.openPostedLinksPlanTitle || undefined);
        setInitialPostedLinksForceOpen(!!state.openPostedLinksForceOpen || !!state.openPostedLinksModal);
        notifDebugHome("prepared initial posted-links state", {
          initialTab: state.openNotificationsTab,
          planId: state.openPostedLinksPlanId,
          forceOpen: !!state.openPostedLinksForceOpen || !!state.openPostedLinksModal,
        });
      } else {
        setInitialPostedLinksPlanId(undefined);
        setInitialPostedLinksPlanTitle(undefined);
        setInitialPostedLinksForceOpen(false);
        notifDebugHome("no posted-links plan id in route state");
      }
      navigate(".", { replace: true, state: {} });
    }
  }, [location.state, navigate]);
  
  const lastCheckInTimeRef = useRef<string | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef(0);
  const pullDistanceRef = useRef(0);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const didRecoveryRefetch = useRef(false);

  const {
    todayAttendance,
    officeLocation,
    todaySchedule,
    workSchedule,
    loading,
    error,
    realtimeConnected,
    refetch,
    clearError,
    userForPresence,
    organizationId,
  } = useAttendanceData();

  // Setup user presence tracking (user/org from same source as attendance data)
  const { onlineUsers, totalOnline } = useRealtimePresence(organizationId, userForPresence ?? undefined);

  const { profile, loading: profileLoading } = useProfile();
  const { totalCount: notificationBadgeCount } = useNotificationBadgeCount();
  const currentHour = new Date().getHours();
  const greetingKey = getGreetingKey(currentHour);
  const greeting = t(`home.greeting.${greetingKey}`, "Hello");
  const displayName = profileLoading ? '...' : (profile?.full_name ?? t('mobileHome.user', 'User'));

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  useEffect(() => {
    if (didRecoveryRefetch.current || loading || error) return;
    const hasData = todaySchedule != null || workSchedule != null || officeLocation != null;
    if (hasData) return;
    didRecoveryRefetch.current = true;
    refetch().catch(() => {});
  }, [loading, error, todaySchedule, workSchedule, officeLocation, refetch]);

  // Keep ref in sync with todayAttendance for reliable clock-out working_hours_minutes
  useEffect(() => {
    if (todayAttendance?.check_in_time) {
      lastCheckInTimeRef.current = todayAttendance.check_in_time;
    }
  }, [todayAttendance?.check_in_time]);

  const triggerConfetti = () => {
    if (typeof confetti !== 'function') return;
    try {
      // Multiple confetti bursts for celebration effect
      const count = 200;
      const defaults = {
        origin: { y: 0.7 },
        zIndex: 9999
      };
      function fire(particleRatio: number, opts: any) {
        confetti({
          ...defaults,
          ...opts,
          particleCount: Math.floor(count * particleRatio)
        });
      }

      // First burst
      fire(0.25, {
        spread: 26,
        startVelocity: 55
      });

      // Second burst
      fire(0.2, {
        spread: 60
      });

      // Third burst
      fire(0.35, {
        spread: 100,
        decay: 0.91,
        scalar: 0.8
      });

      // Fourth burst
      fire(0.1, {
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        scalar: 1.2
      });

      // Fifth burst
      fire(0.1, {
        spread: 120,
        startVelocity: 45
      });
    } catch (e) {
      logger.debug('Confetti skipped', e);
    }
  };

  // Fungsi untuk menghitung jam kerja real-time
  const calculateWorkingHours = () => {
    if (!todayAttendance?.check_in_time) {
      return t("mobileHome.zeroHoursMinutes", "0 jam 0 menit");
    }
    const checkInTime = new Date(todayAttendance.check_in_time);
    const endTime = todayAttendance.check_out_time ? new Date(todayAttendance.check_out_time) : new Date();
    const diffMs = endTime.getTime() - checkInTime.getTime();
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return t("mobileHome.hoursMinutesFormat", "{{hours}} jam {{minutes}} menit", { hours, minutes });
  };

  const handleClockIn = () => {
    if (todayAttendance?.check_in_time) {
        toast({
          title: t("mobileHome.alreadyClockIn", "Sudah Clock In"),
          description: t("mobileHome.alreadyClockInDesc", "Anda sudah melakukan clock in hari ini"),
          variant: "destructive",
          duration: 4000,
        });
      return;
    }

    // Check if today is a working day
    if (todaySchedule && !todaySchedule.isWorkingDay) {
      toast({
        title: t("mobileHome.holidayTitle", "Hari Libur"),
        description: t("mobileHome.holidayDesc", "Hari ini adalah hari libur sesuai jadwal kerja"),
        variant: "destructive",
        duration: 4000,
      });
      return;
    }

    // Check if current time is within work hours (with late tolerance)
    if (workSchedule) {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes(); // in minutes
      const startTime = workSchedule.start_time ? parseInt(workSchedule.start_time.split(':')[0]) * 60 + parseInt(workSchedule.start_time.split(':')[1]) : 8 * 60; // default 8:00 AM
      const endTime = workSchedule.end_time ? parseInt(workSchedule.end_time.split(':')[0]) * 60 + parseInt(workSchedule.end_time.split(':')[1]) : 17 * 60; // default 5:00 PM
      const lateToleranceMinutes = workSchedule.late_tolerance_minutes || 0;

      // Check if too early (more than 1 hour before start time)
      if (currentTime < startTime - 60) {
        toast({
          title: t("mobileHome.tooEarly", "Terlalu Dini"),
          description: t("mobileHome.tooEarlyDesc", "Waktu clock in belum dimulai. Jadwal kerja mulai {{time}}", { time: workSchedule.start_time ?? "08:00" }),
          variant: "destructive",
          duration: 4000,
        });
        return;
      }

      // Check if too late (after end time)
      if (currentTime > endTime) {
        toast({
          title: t("mobileHome.workEndedTitle", "Waktu Kerja Berakhir"),
          description: t("mobileHome.workEndedDesc", "Waktu kerja sudah berakhir jam {{time}}", { time: workSchedule.end_time ?? "17:00" }),
          variant: "destructive",
          duration: 4000,
        });
        return;
      }

      // Show late warning if applicable
      if (currentTime > startTime + lateToleranceMinutes) {
        const lateMinutes = currentTime - startTime;
        setLateModal({
          isOpen: true,
          lateMinutes,
          scheduledTime: workSchedule.start_time || '08:00',
          pendingClockIn: true
        });
        return;
      }
    }
    setCameraModal({
      isOpen: true,
      type: 'clockin'
    });
  };

  const handleClockOut = () => {
    if (!todayAttendance?.check_in_time) {
      toast({
        title: t("mobileHome.mustClockInFirst", "Belum Clock In"),
        description: t("mobileHome.mustClockInFirstDesc", "Anda harus clock in terlebih dahulu"),
        variant: "destructive",
        duration: 4000,
      });
      return;
    }
    if (todayAttendance?.check_out_time) {
      toast({
        title: t("mobileHome.alreadyClockOut", "Sudah Clock Out"),
        description: t("mobileHome.alreadyClockOutDesc", "Anda sudah melakukan clock out hari ini"),
        variant: "destructive",
        duration: 4000,
      });
      return;
    }

    // Check if it's too early to clock out (minimum work hours check)
    if (workSchedule && todayAttendance?.check_in_time) {
      const checkInTime = new Date(todayAttendance.check_in_time);
      const now = new Date();
      const workedHours = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

      // Minimum 4 hours work before allowing clock out
      if (workedHours < 4) {
        toast({
          title: t("mobileHome.notEnoughWorkTime", "Belum Cukup Waktu Kerja"),
          description: t("mobileHome.notEnoughWorkTimeDesc", "Anda baru bekerja {{hours}} jam {{minutes}} menit. Minimal 4 jam kerja.", {
            hours: Math.floor(workedHours),
            minutes: Math.floor((workedHours % 1) * 60),
          }),
          variant: "destructive",
          duration: 4000,
        });
        return;
      }
    }
    setCameraModal({
      isOpen: true,
      type: 'clockout'
    });
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getCurrentLocation = (): Promise<{
    latitude: number;
    longitude: number;
  }> => getCurrentPosition();

  const handleLateClockIn = async (reason: string) => {
    setLateModal({
      isOpen: false,
      lateMinutes: 0,
      scheduledTime: '',
      pendingClockIn: false
    });
    setCameraModal({
      isOpen: true,
      type: 'clockin'
    });

    // Store the late reason to be used when capturing the photo
    sessionStorage.setItem('lateReason', reason);
  };

  const handleCameraCapture = async (imageData: string) => {
    try {
      // Get current location
      const currentLocation = await getCurrentLocation();

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: t("mobileHome.error", "Error"),
          description: t("mobileHome.userNotFound", "User tidak ditemukan"),
          variant: "destructive",
          duration: 4000,
        });
        return;
      }

      // Get user's active organization from profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .single();
      const profile = profileData as unknown as { active_organization_id: string | null } | null;

      if (!profile?.active_organization_id) {
        toast({
          title: t("mobileHome.error", "Error"),
          description: t("mobileHome.orgNotFound", "Organisasi aktif tidak ditemukan"),
          variant: "destructive",
          duration: 4000,
        });
        return;
      }

      // Get employee data for the active organization
      // @ts-ignore Supabase client types can cause "excessively deep" instantiation here
      const employeeRes = await supabase
        .from('employees')
        .select('id, organization_id')
        .eq('user_id', user.id)
        .eq('organization_id', profile.active_organization_id)
        .limit(1)
        .single();
      const { data: employeeData, error: employeeError } = employeeRes as { data: unknown; error: unknown };
      const employee = employeeData as unknown as { id: string; organization_id: string } | null;

      if (employeeError || !employee) {
        toast({
          title: t("mobileHome.error", "Error"),
          description: t("mobileHome.employeeNotFound", "Data karyawan tidak ditemukan"),
          variant: "destructive",
          duration: 4000,
        });
        return;
      }

      // Get office location and validate distance
      const { data: officesData, error: officeError } = await supabase
        .from('office_locations')
        .select('*')
        .eq('organization_id', employee.organization_id)
        .eq('is_active', true);
      const offices = officesData as unknown as Array<{ id: string; latitude: number; longitude: number; radius_meters: number }> | null;

      if (officeError) {
        toast({
          title: t("mobileHome.error", "Error"),
          description: t("mobileHome.failedToLoadOffice", "Gagal mengambil data kantor"),
          variant: "destructive",
          duration: 4000,
        });
        return;
      }

      // Calculate distance to each office and find the closest valid one
      let validOffice = null;
      let minDistance = Infinity;
      for (const office of offices || []) {
        const distance = calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          office.latitude,
          office.longitude
        );

        // Check if within radius and closer than previous offices
        if (distance <= office.radius_meters && distance < minDistance) {
          validOffice = office;
          minDistance = distance;
        }
      }

      if (!validOffice) {
        toast({
          title: t("mobileHome.locationInvalid", "Lokasi Tidak Valid"),
          description: t("mobileHome.locationInvalidDesc", "Anda tidak berada dalam radius area kantor yang diizinkan"),
          variant: "destructive",
          duration: 4000,
        });
        return;
      }

      if (cameraModal.type === 'clockin') {
        // Get late reason from session storage if exists
        const lateReason = sessionStorage.getItem('lateReason');

        // Pastikan work_schedule_id tersedia. Jika belum, ambil dari DB.
        let scheduleId: string | null = (workSchedule?.id as string) || null;
        if (!scheduleId) {
          // Try default first
          let { data: ws } = await supabase
            .from('work_schedule_settings')
            .select('id')
            .eq('organization_id', employee.organization_id)
            .eq('is_active', true)
            .eq('is_default', true)
            .maybeSingle();
          type WsRow = { id: string } | null;
          let wsRow: WsRow = ws as unknown as WsRow;

          // If no default, get any active schedule
          if (!wsRow) {
            const { data: fallbackWs } = await supabase
              .from('work_schedule_settings')
              .select('id')
              .eq('organization_id', employee.organization_id)
              .eq('is_active', true)
              .limit(1)
              .maybeSingle();
            wsRow = fallbackWs as unknown as WsRow;
          }

          scheduleId = wsRow?.id || null;
        }
        
        if (!scheduleId) {
          toast({
            title: t("mobileHome.scheduleNotFound", "Jadwal Kerja Tidak Ditemukan"),
            description: t("mobileHome.scheduleNotFoundDesc", "Silakan hubungi admin untuk mengatur jadwal kerja aktif."),
            variant: "destructive",
            duration: 4000,
          });
          return;
        }

        // Calculate lateness - using check-in time not current time
        const checkInTime = new Date();
        const checkInTimeMinutes = checkInTime.getHours() * 60 + checkInTime.getMinutes();
        
        // Get schedule info for lateness calculation
        let scheduledStartTime = "08:00:00";
        let lateToleranceMinutes = 0;
        
        if (workSchedule) {
          scheduledStartTime = workSchedule.start_time || "08:00:00";
          lateToleranceMinutes = workSchedule.late_tolerance_minutes || 0;
        } else {
          // Fetch from DB if workSchedule not available
          const { data: scheduleData } = await supabase
            .from('work_schedule_settings')
            .select('start_time, late_tolerance_minutes')
            .eq('id', scheduleId)
            .single();
          const schedule = scheduleData as unknown as { start_time?: string; late_tolerance_minutes?: number } | null;
          if (schedule) {
            scheduledStartTime = schedule.start_time || "08:00:00";
            lateToleranceMinutes = schedule.late_tolerance_minutes || 0;
          }
        }
        
        const [startHour, startMinute] = scheduledStartTime.split(':').map(Number);
        const scheduledStartMinutes = startHour * 60 + startMinute;
        
        // Calculate actual late minutes
        const actualLateMinutes = Math.max(0, checkInTimeMinutes - scheduledStartMinutes);
        const isLate = actualLateMinutes > lateToleranceMinutes;
        
        logger.debug('Lateness calculation', {
          checkInTimeMinutes,
          scheduledStartMinutes,
          lateToleranceMinutes,
          actualLateMinutes,
          isLate
        });

        // Clock In Logic - sanitize all values to prevent UUID null errors
        const attendanceData = {
          employee_id: employee.id,
          organization_id: employee.organization_id,
          attendance_date: new Date().toISOString().split('T')[0],
          check_in_time: new Date().toISOString(),
          check_in_location: {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            address: "Location captured"
          },
          office_location_id: validOffice.id,
          work_schedule_id: scheduleId || null, // Ensure no undefined values
          is_late: isLate,
          late_minutes: isLate ? actualLateMinutes : 0,
          // Fitur upload foto attendance belum diimplementasi; path saat ini placeholder. TODO: upload imageData ke Supabase Storage dan gunakan path/URL yang dikembalikan.
          check_in_photo_path: `attendance/${user.id}/${Date.now()}_checkin.jpg`,
          notes: lateReason || null
        };

        // Clean up session storage
        if (lateReason) {
          sessionStorage.removeItem('lateReason');
        }

        const { data: insertedRecordData, error: insertError } = await supabase
          .from('attendance_records')
          .insert(attendanceData)
          .select()
          .single();
        const insertedRecord = insertedRecordData as unknown as { id: string; check_in_time: string } | null;

        if (insertError) {
          logger.error('Clock in error:', insertError);
          toast({
            title: t("mobileHome.clockInFailed", "Clock In Gagal"),
            description: t("mobileHome.saveError", "Terjadi kesalahan saat menyimpan data"),
            variant: "destructive",
            duration: 4000,
          });
          return;
        }

        if (insertedRecord) lastCheckInTimeRef.current = insertedRecord.check_in_time;

        // Create attendance validation record
        const validationData = insertedRecord ? {
          attendance_record_id: insertedRecord.id,
          organization_id: employee.organization_id,
          validation_type: 'overall',
          validation_status: 'valid',
          validation_details: {
            location_valid: true,
            schedule_valid: true,
            work_schedule_id: scheduleId
          },
          validated_at: new Date().toISOString()
        } : null;

        if (validationData) {
        const { error: validationError } = await supabase
          .from('attendance_validations')
          .insert(validationData);

        if (validationError) {
          logger.error('Validation error:', validationError);
          // Continue even if validation fails, as attendance is already recorded
        }
        }

        toast({
          title: t("mobileHome.clockInSuccess", "Clock In Berhasil"),
          description: t("mobileHome.clockInSuccessDesc", "Selamat! Anda telah berhasil melakukan clock in"),
          variant: "default",
          duration: 3000,
        });

        // Trigger confetti celebration
        setTimeout(() => {
          triggerConfetti();
        }, 500);

      } else if (cameraModal.type === 'clockout') {
        // Clock Out Logic - use ref so working_hours_minutes is correct even before refetch
        const checkInTime = lastCheckInTimeRef.current ?? todayAttendance?.check_in_time;
        const working_hours_minutes = checkInTime
          ? Math.floor((Date.now() - new Date(checkInTime).getTime()) / (1000 * 60))
          : 0;

        const { error: updateError } = await supabase
          .from('attendance_records')
          .update({
            check_out_time: new Date().toISOString(),
            check_out_location: {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              address: "Location captured"
            },
            // Fitur upload foto attendance belum diimplementasi; path saat ini placeholder. TODO: upload imageData ke Supabase Storage dan gunakan path/URL yang dikembalikan.
            check_out_photo_path: `attendance/${user.id}/${Date.now()}_checkout.jpg`,
            working_hours_minutes
          })
          .eq('employee_id', employee.id)
          .eq('attendance_date', new Date().toISOString().split('T')[0])
          .is('check_out_time', null);

        if (updateError) {
          logger.error('Clock out error:', updateError);
          toast({
            title: t("mobileHome.clockOutFailed", "Clock Out Gagal"),
            description: t("mobileHome.saveError", "Terjadi kesalahan saat menyimpan data"),
            variant: "destructive",
            duration: 4000,
          });
          return;
        }

        toast({
          title: t("mobileHome.clockOutSuccess", "Clock Out Berhasil"),
          description: t("mobileHome.clockOutSuccessDesc", "Selamat! Anda telah menyelesaikan hari kerja"),
          variant: "default",
          duration: 3000,
        });

        // Trigger confetti celebration
        setTimeout(() => {
          triggerConfetti();
        }, 500);
      }

      // Refresh attendance data
      refetch();
    } catch (error) {
      logger.error('Attendance error:', error);
      toast({
        title: t("mobileHome.error", "Error"),
        description: error instanceof Error ? error.message : t("mobileHome.unexpectedError", "Terjadi kesalahan tidak terduga"),
        variant: "destructive",
        duration: 4000,
      });
    }
  };

  const handleCameraClose = () => {
    setCameraModal({
      isOpen: false,
      type: null
    });
  };

  const handlePullRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setPullDistance(0);
    try {
      await refetch();
    } catch {
      toast({
        title: t("mobileHome.error", "Error"),
        description: t("mobileHome.refreshFailed", "Gagal memperbarui"),
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch, isRefreshing, toast, t]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    const el = listScrollRef.current;
    if (el?.scrollTop <= 2) setIsPulling(true);
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const el = listScrollRef.current;
      if (!el || isRefreshing) return;
      if (el.scrollTop > 2) {
        setIsPulling(false);
        setPullDistance(0);
        pullDistanceRef.current = 0;
        return;
      }
      const y = e.touches[0].clientY;
      const delta = y - touchStartY.current;
      if (delta > 0) {
        const d = Math.min(delta * PULL_RESISTANCE, MAX_PULL);
        setPullDistance(d);
        pullDistanceRef.current = d;
      } else {
        setPullDistance(0);
        pullDistanceRef.current = 0;
      }
    },
    [isRefreshing]
  );

  const onTouchEnd = useCallback(() => {
    setIsPulling(false);
    const d = pullDistanceRef.current;
    setPullDistance(0);
    pullDistanceRef.current = 0;
    if (d >= PULL_THRESHOLD) {
      handlePullRefresh();
    }
  }, [handlePullRefresh]);

  const currentOfficeLocation = officeLocation;
  const currentSchedule = todaySchedule;

  const { mainFixedStyle } = useVisualViewport();

  return (
    <DesktopWarning>
      <LiveChatAppBadgeSync />
      <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        {/* Layout per .cursor/rules/mobile-tools-layout-android.mdc: main fixed + useVisualViewport, header safe-area-top, scroll area seamless-scroll, NavigationFooter safe-area-bottom-lower */}
        <main className="flex flex-col bg-background fixed inset-x-0 z-0" style={mainFixedStyle}>
          <header className="flex-shrink-0 sticky top-0 z-30 flex items-center justify-between p-3 bg-card border-b border-border safe-area-top min-h-[3.25rem]">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <SidebarTrigger className="md:hidden shrink-0" />
              <div className="min-w-0">
                <p className="text-base font-bold text-foreground truncate leading-tight">
                  {greeting}
                </p>
                <p className="text-base font-light text-foreground truncate leading-tight">
                  {displayName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <RealtimeStatusIndicator
                isConnected={realtimeConnected}
                onlineUsers={totalOnline}
                className="text-xs"
              />
              <button
                type="button"
                onClick={() => setNotificationsOpen(true)}
                className="relative p-2 hover:bg-muted rounded-lg transition-colors"
                aria-label={t("mobileHome.notificationsTitle", "Notifikasi")}
              >
                <Bell className="h-5 w-5 text-muted-foreground" />
                {notificationBadgeCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-semibold">
                    {notificationBadgeCount > 99 ? '99+' : notificationBadgeCount}
                  </span>
                )}
              </button>
            </div>
          </header>

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div
              ref={listScrollRef}
              className="flex-1 overflow-y-auto overflow-x-hidden seamless-scroll min-h-0 flex flex-col"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <div
                className="shrink-0 overflow-hidden flex items-center justify-center text-muted-foreground text-sm"
                style={{
                  height: pullDistance > 0 ? Math.min(pullDistance, MAX_PULL) : isRefreshing ? INDICATOR_HEIGHT : 0,
                  minHeight: 0,
                  transition: isPulling ? 'none' : 'height 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), min-height 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                }}
              >
                {isRefreshing ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" aria-hidden />
                ) : pullDistance >= PULL_THRESHOLD ? (
                  <span className="text-xs font-medium text-primary whitespace-nowrap">
                    {t('common.pullToRefresh.release', 'Lepas untuk refresh')}
                  </span>
                ) : (
                  <RefreshCw
                    className="h-5 w-5 opacity-80 shrink-0"
                    style={{
                      transform: `rotate(${Math.min((pullDistance / PULL_THRESHOLD) * 180, 180)}deg)`,
                      transition: isPulling ? 'none' : 'transform 0.2s ease-out',
                    }}
                    aria-hidden
                  />
                )}
              </div>
              {(loading && !isRefreshing) ? (
                <div className="mx-auto w-full max-w-md px-2 pt-2 content-padding-above-nav-home">
                  <AbsensiSkeleton />
                </div>
              ) : error ? (
                <div className="mx-auto w-full max-w-md px-2 pt-2 content-padding-above-nav-home">
                  <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                    <p className="text-sm text-destructive font-medium mb-1">{t('mobileHome.error', 'Error')}</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      {error.message === 'NO_USER'
                        ? t('mobileHome.userNotFound', 'User tidak ditemukan')
                        : error.message === 'NO_ORG'
                          ? t('mobileHome.orgNotFound', 'Organisasi aktif tidak ditemukan')
                          : error.message === 'NO_EMPLOYEE'
                            ? t('mobileHome.employeeNotFound', 'Data karyawan tidak ditemukan')
                            : error.message === 'FETCH_PROFILE_FAILED'
                              ? t('mobileHome.failedToLoadProfile', 'Gagal memuat profil')
                              : error.message}
                    </p>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => { clearError(); refetch(); }}
                    >
                      {t("mobileHome.retry", "Coba lagi")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mx-auto w-full max-w-md px-2 pt-2 content-padding-above-nav-home space-y-1">
                  {/* pt-2 = spasi ke header; space-y-1 = jarak antar section sama seperti daily task */}
                  <div>
                    <div className="bg-card rounded-lg border border-border overflow-hidden">
                      <TimeDisplay />

                      {/* Location Button - di antara jam atas dan jam check in/out */}
                      {currentOfficeLocation && <LocationButton officeLocation={currentOfficeLocation} />}

                      <AttendanceStatus
                        checkIn={todayAttendance?.check_in_time ? new Date(todayAttendance.check_in_time).toLocaleTimeString(timeLocale, {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: false
                        }) : undefined}
                        checkOut={todayAttendance?.check_out_time ? new Date(todayAttendance.check_out_time).toLocaleTimeString(timeLocale, {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: false
                        }) : undefined}
                        workingHours={calculateWorkingHours()}
                      />

                      <AttendanceActions onClockIn={handleClockIn} onClockOut={handleClockOut} />
                    </div>
                  </div>

                  {/* Shortcuts: max 4 per row, modern icons, small text */}
                  <div>
                    <div className="bg-card rounded-lg border border-border p-3">
                      <div className="grid grid-cols-4 gap-2">
                        <button
                          type="button"
                          onClick={() => navigate("/tools/habits-tracker")}
                          className="flex flex-col items-center justify-center py-2 px-0.5 rounded-xl text-primary hover:bg-primary/10 active:bg-primary/15 transition-colors"
                        >
                          <CircleCheck className="h-6 w-6 mb-1" strokeWidth={1.75} />
                          <span className="text-[10px] font-medium text-foreground text-center leading-tight">
                            {t("mobileHome.shortcuts.habits", "Habits")}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate("/tools/daily-task")}
                          className="flex flex-col items-center justify-center py-2 px-0.5 rounded-xl text-primary hover:bg-primary/10 active:bg-primary/15 transition-colors"
                        >
                          <ClipboardList className="h-6 w-6 mb-1" strokeWidth={1.75} />
                          <span className="text-[10px] font-medium text-foreground text-center leading-tight">
                            {t("mobileHome.shortcuts.dailyTask", "Daily Task")}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate("/tools/meeting-notes")}
                          className="flex flex-col items-center justify-center py-2 px-0.5 rounded-xl text-primary hover:bg-primary/10 active:bg-primary/15 transition-colors"
                        >
                          <NotebookPen className="h-6 w-6 mb-1" strokeWidth={1.75} />
                          <span className="text-[10px] font-medium text-foreground text-center leading-tight">
                            {t("mobileHome.shortcuts.notes", "Meeting Notes")}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {currentSchedule && workSchedule && (
                    <div>
                      <TodaySchedule schedule={currentSchedule} />
                    </div>
                  )}

                  {currentOfficeLocation && (
                    <div>
                      <LocationChecker officeLocation={currentOfficeLocation} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Spacer so content doesn't scroll under the fixed footer; same as LiveChatListView */}
          <NavigationFooter className="safe-area-bottom-lower" />
        </main>

        <CameraModal
          isOpen={cameraModal.isOpen}
          onClose={handleCameraClose}
          onCapture={handleCameraCapture}
          title={cameraModal.type === 'clockin' ? 'Foto Clock In' : 'Foto Clock Out'}
        />

        <LateAttendanceModal
          isOpen={lateModal.isOpen}
          onClose={() => setLateModal({
            isOpen: false,
            lateMinutes: 0,
            scheduledTime: '',
            pendingClockIn: false
          })}
          onSubmit={handleLateClockIn}
          lateMinutes={lateModal.lateMinutes}
          scheduledTime={lateModal.scheduledTime}
        />

        <NotificationsModal
          open={notificationsOpen}
          onOpenChange={(open) => {
            if (!open) {
              setInitialNotificationsTab(undefined);
              setInitialPostedLinksPlanId(undefined);
              setInitialPostedLinksPlanTitle(undefined);
              setInitialPostedLinksForceOpen(false);
            }
            setNotificationsOpen(open);
          }}
          initialTab={initialNotificationsTab}
          initialPostedLinksPlanId={initialPostedLinksPlanId}
          initialPostedLinksPlanTitle={initialPostedLinksPlanTitle}
          initialPostedLinksForceOpen={initialPostedLinksForceOpen}
        />
      </div>
    </SidebarProvider>
    </DesktopWarning>
  );
};

export default Absensi;

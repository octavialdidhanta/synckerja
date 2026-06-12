import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, RefreshCw, Loader2, CircleCheck, ClipboardList, NotebookPen, CalendarDays } from "lucide-react";
import { TimeDisplay } from "@/mobile-app/components/TimeDisplay";
import { LocationChecker, LocationButton } from "@/mobile-app/components/LocationChecker";
import { AttendanceStatus } from "@/mobile-app/components/AttendanceStatus";
import { AttendanceActions } from "@/mobile/1-home/components/AttendanceActions";
import { TodaySchedule } from "@/mobile/1-home/components/TodaySchedule";
import { NavigationFooter } from "@/mobile-app/components/NavigationFooter";
import { DesktopWarning } from "@/mobile-app/components/DesktopWarning";
import { AppSidebar } from "@/mobile-app/components/AppSidebar";
import { CameraModal } from "@/mobile-app/components/CameraModal";
import { LateAttendanceModal } from "@/mobile-app/components/LateAttendanceModal";
import { SidebarProvider, SidebarTrigger } from "@/mobile-app/components/ui/sidebar";
import { Button } from "@/mobile-app/components/ui/button";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/shared/lib/supabaseClient";
import { logger } from "@/shared/lib/logger";
import { useAttendanceData } from "@/mobile/1-home/hooks/useAttendanceData";
import { AbsensiPageSkeleton } from "@/mobile/1-home/pages/AbsensiPageSkeleton";
import { RealtimeStatusIndicator } from "@/mobile-app/components/RealtimeStatusIndicator";
import { useRealtimePresence } from "@/mobile-app/hooks/useRealtimePresence";
import { useStatusBarStyle } from "@/shared/hooks/useStatusBarStyle";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { cn } from "@/shared/lib/utils";
import { LiveChatAppBadgeSync } from "@/5-3-whatsapp/components/LiveChatAppBadgeSync";
import { getCurrentPosition } from "@/mobile-app/utils/geolocation";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useProfile } from "@/mobile-app/hooks/useProfile";
import { NotificationsModal } from "@/mobile-app/components/NotificationsModal";
import { useNotificationBadgeCount } from "@/shared/hooks/useNotificationBadgeCount";
import confetti from "canvas-confetti";
import { formatAttendanceClockFromRecord } from "@/mobile-app/utils/postgresAttendanceTime";
import {
  dateToPostgresLocalWallTime,
  formatLocalDateYmd,
  parseAttendanceInstant,
} from "@/1-home/utils/attendanceDateTime";
import { parseAttendanceValidationRow, parseCheckoutValidationRow } from "@/shared/attendance/resolveEffectiveSchedule";
import { uploadAttendancePhoto } from "@/shared/lib/attendance/uploadAttendancePhoto";
import { getCheckInValidationFailureMessage } from "@/shared/lib/attendance/attendanceValidationMessages";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { SubscriptionExpiryBannerSlot } from "@/10-subscription/shared/SubscriptionExpiryBannerSlot";
import { MOBILE_PAGE_PATH } from "@/shared/auth/page-access/mobileRoutePagePaths";
import { LeaveRequestMobileModal } from "@/mobile/1-home/components/LeaveRequestMobileModal";

function formatLocalCheckinTimeString(d: Date): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0") +
    " " +
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0") +
    ":" +
    String(d.getSeconds()).padStart(2, "0")
  );
}

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

const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
const PULL_RESISTANCE = 0.55;

const Absensi = () => {
  useStatusBarStyle('light');
  const { mainFixedStyle } = useVisualViewport();
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
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
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
    mergeTodayAttendance,
    clearError,
    userForPresence,
    organizationId,
  } = useAttendanceData();

  // Setup user presence tracking (user/org from same source as attendance data)
  const { onlineUsers, totalOnline } = useRealtimePresence(organizationId, userForPresence ?? undefined);

  const { profile, loading: profileLoading } = useProfile();
  const {
    totalCount: notificationBadgeCount,
    isLoading: notificationBadgeQueryLoading,
  } = useNotificationBadgeCount();

  /** Satu overlay skeleton sampai data absensi + profil header + badge notifikasi (jika org ada) siap — hindari konten setengah jadi. */
  const hasOrgForBadge = Boolean(organizationId?.length);
  const dataPending =
    !error &&
    (loading ||
      profileLoading ||
      (hasOrgForBadge && notificationBadgeQueryLoading));

  const [showPageSkeleton, setShowPageSkeleton] = useState(true);
  useEffect(() => {
    if (dataPending) {
      setShowPageSkeleton(true);
      return;
    }
    const t = window.setTimeout(() => {
      requestAnimationFrame(() => setShowPageSkeleton(false));
    }, 200);
    return () => window.clearTimeout(t);
  }, [dataPending]);

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
    const checkInTime = parseAttendanceInstant(
      todayAttendance.attendance_date,
      todayAttendance.check_in_time,
      todayAttendance.check_in_at,
    );
    const endTime = todayAttendance.check_out_time
      ? parseAttendanceInstant(
          todayAttendance.attendance_date,
          todayAttendance.check_out_time,
          todayAttendance.check_out_at,
        )
      : new Date();
    if (!checkInTime || !endTime) {
      return t("mobileHome.zeroHoursMinutes", "0 jam 0 menit");
    }
    const diffMs = endTime.getTime() - checkInTime.getTime();
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return t("mobileHome.hoursMinutesFormat", "{{hours}} jam {{minutes}} menit", { hours, minutes });
  };

  const hasCheckedIn = Boolean(todayAttendance?.check_in_time);
  const hasCheckedOut = Boolean(todayAttendance?.check_out_time);

  const handleClockIn = () => {
    if (todayAttendance?.check_in_time || lastCheckInTimeRef.current) {
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

    // Minimum work hours (same row as desktop: prefer check_in_at / full ISO check_in_time)
    if (workSchedule && todayAttendance?.check_in_time) {
      const checkInInstant = parseAttendanceInstant(
        todayAttendance.attendance_date,
        todayAttendance.check_in_time,
        todayAttendance.check_in_at,
      );
      const now = new Date();
      const workedHours =
        checkInInstant != null ? (now.getTime() - checkInInstant.getTime()) / (1000 * 60 * 60) : 0;

      if (workedHours >= 0 && workedHours < 4) {
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

  const getCurrentLocation = (): Promise<{
    latitude: number;
    longitude: number;
    accuracy?: number;
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

      const gpsAccuracyMeters =
        typeof currentLocation.accuracy === "number" && currentLocation.accuracy > 0
          ? currentLocation.accuracy
          : null;

      const photoType = cameraModal.type === "clockin" ? "check_in" : "check_out";
      let uploadedPhoto: { path: string; url: string };
      try {
        uploadedPhoto = await uploadAttendancePhoto(employee.id, imageData, photoType);
      } catch (uploadError) {
        logger.error("Photo upload error:", uploadError);
        toast({
          title: cameraModal.type === "clockin"
            ? t("mobileHome.clockInFailed", "Clock In Gagal")
            : t("mobileHome.clockOutFailed", "Clock Out Gagal"),
          description: t(
            "mobileHome.photoUploadFailed",
            "Gagal mengunggah foto. Silakan coba lagi.",
          ),
          variant: "destructive",
          duration: 4000,
        });
        return;
      }

      if (cameraModal.type === 'clockin') {
        const lateReason = sessionStorage.getItem('lateReason');
        const checkInTime = new Date();

        const { data: validationRaw, error: validationError } = await supabase.rpc(
          'validate_attendance_comprehensive',
          {
            employee_id_param: employee.id,
            organization_id_param: employee.organization_id,
            latitude_param: currentLocation.latitude,
            longitude_param: currentLocation.longitude,
            face_image_data: imageData,
            gps_accuracy_meters: gpsAccuracyMeters,
            is_manual_location: false,
          },
        );

        const validation = parseAttendanceValidationRow(validationRaw);

        if (validationError || !validation) {
          toast({
            title: t("mobileHome.clockInFailed", "Clock In Gagal"),
            description: validationError?.message ?? t("mobileHome.saveError", "Terjadi kesalahan saat menyimpan data"),
            variant: "destructive",
            duration: 4000,
          });
          return;
        }

        if (!validation.can_attend) {
          toast({
            title: t("mobileHome.clockInFailed", "Clock In Gagal"),
            description: getCheckInValidationFailureMessage(validation, t),
            variant: "destructive",
            duration: 4000,
          });
          return;
        }

        const { data: recordResult, error: insertError } = await supabase.rpc(
          'record_attendance_with_timezone',
          {
            employee_id_param: employee.id,
            organization_id_param: employee.organization_id,
            local_checkin_time: formatLocalCheckinTimeString(checkInTime),
            latitude_param: currentLocation.latitude,
            longitude_param: currentLocation.longitude,
            timezone_param: 'Asia/Jakarta',
            photo_path_param: uploadedPhoto.path,
            location_data: {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              address: 'Location captured',
            },
            notes_param: lateReason || null,
          },
        );

        if (lateReason) {
          sessionStorage.removeItem('lateReason');
        }

        if (insertError) {
          logger.error('Clock in error:', insertError);
          toast({
            title: t("mobileHome.clockInFailed", "Clock In Gagal"),
            description: insertError.message || t("mobileHome.saveError", "Terjadi kesalahan saat menyimpan data"),
            variant: "destructive",
            duration: 4000,
          });
          return;
        }

        const recordPayload = Array.isArray(recordResult) ? recordResult[0] : recordResult;
        const attendanceId = recordPayload?.attendance_id as string | undefined;

        let insertedRecord: Record<string, unknown> | null = null;
        if (attendanceId) {
          const { data: fetchedRecord } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('id', attendanceId)
            .maybeSingle();
          insertedRecord = fetchedRecord as Record<string, unknown> | null;
        }

        if (insertedRecord) {
          const checkInTimeValue = insertedRecord.check_in_time as string | undefined;
          if (checkInTimeValue) lastCheckInTimeRef.current = checkInTimeValue;
          mergeTodayAttendance(insertedRecord);
        }

        const validationData = insertedRecord ? {
          attendance_record_id: insertedRecord.id,
          organization_id: employee.organization_id,
          validation_type: 'overall',
          validation_status: 'valid',
          validation_details: {
            location_valid: validation.location_valid,
            schedule_valid: validation.schedule_valid,
            work_schedule_id: validation.work_schedule_id,
            shift_id: validation.shift_id,
            schedule_source: validation.schedule_source,
          },
          validated_at: new Date().toISOString()
        } : null;

        if (validationData) {
        const { error: validationInsertError } = await supabase
          .from('attendance_validations')
          .insert(validationData);

        if (validationInsertError) {
          logger.error('Validation error:', validationInsertError);
        }
        }

        toast({
          title: t("mobileHome.clockInSuccess", "Clock In Berhasil"),
          description: validation.is_late
            ? t("mobileHome.clockInLateDesc", "Clock in berhasil. Anda terlambat {{minutes}} menit.", {
                minutes: String(validation.late_minutes),
              })
            : t("mobileHome.clockInSuccessDesc", "Selamat! Anda telah berhasil melakukan clock in"),
          variant: "default",
          duration: 3000,
        });

        // Trigger confetti celebration
        setTimeout(() => {
          triggerConfetti();
        }, 500);

      } else if (cameraModal.type === 'clockout') {
        const { data: checkoutValidationRaw, error: checkoutValidationError } = await supabase.rpc(
          'validate_checkout_comprehensive',
          {
            employee_id_param: employee.id,
            organization_id_param: employee.organization_id,
            photo_path_param: uploadedPhoto.path,
            face_image_data: imageData,
          },
        );

        const checkoutValidation = parseCheckoutValidationRow(checkoutValidationRaw);
        if (checkoutValidationError || !checkoutValidation?.can_checkout) {
          toast({
            title: t("mobileHome.clockOutFailed", "Clock Out Gagal"),
            description:
              checkoutValidationError?.message ??
              (checkoutValidation?.photo_required && !checkoutValidation.photo_valid
                ? t("mobileHome.photoCheckoutRequired", "Foto wajib untuk check-out")
                : t("mobileHome.saveError", "Terjadi kesalahan saat menyimpan data")),
            variant: "destructive",
            duration: 4000,
          });
          return;
        }

        const checkInTimeStr = lastCheckInTimeRef.current ?? todayAttendance?.check_in_time;
        const checkInDate = parseAttendanceInstant(
          todayAttendance?.attendance_date,
          checkInTimeStr ?? null,
          todayAttendance?.check_in_at,
        );
        const checkOutTime = new Date();
        const working_hours_minutes = checkInDate
          ? Math.floor((checkOutTime.getTime() - checkInDate.getTime()) / (1000 * 60))
          : 0;

        const recordId = (todayAttendance as { id?: string } | null)?.id;
        const attendanceDateKey =
          (todayAttendance?.attendance_date as string | undefined)?.trim() || formatLocalDateYmd(new Date());

        let checkoutQuery = supabase
          .from('attendance_records')
          .update({
            check_out_time: dateToPostgresLocalWallTime(checkOutTime),
            check_out_at: checkOutTime.toISOString(),
            check_out_location: {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              address: "Location captured"
            },
            check_out_photo_path: uploadedPhoto.path,
            working_hours_minutes
          })
          .eq('employee_id', employee.id)
          .is('check_out_time', null);

        checkoutQuery = recordId
          ? checkoutQuery.eq('id', recordId)
          : checkoutQuery.eq('attendance_date', attendanceDateKey);

        const { error: updateError } = await checkoutQuery;

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

        mergeTodayAttendance({
          ...(todayAttendance ?? {}),
          check_out_time: dateToPostgresLocalWallTime(checkOutTime),
          check_out_at: checkOutTime.toISOString(),
          working_hours_minutes,
        });

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

      await refetch();
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

  return (
    <DesktopWarning>
      <LiveChatAppBadgeSync />
      <SidebarProvider>
      {/* Layout per android-mobile/rules/mobile-tools-layout-android.mdc — selaras Schedule, Reports */}
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        {showPageSkeleton ? (
          <AbsensiPageSkeleton />
        ) : (
        <main
          className="flex flex-col bg-background fixed inset-x-0 z-0"
          style={mainFixedStyle}
        >
          <header className="flex-shrink-0 sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card p-3 safe-area-top">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <SidebarTrigger className="md:hidden shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold leading-tight text-foreground">
                  {greeting}
                </p>
                <p className="truncate text-xs leading-tight text-muted-foreground">
                  {displayName}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <RealtimeStatusIndicator
                isConnected={realtimeConnected}
                onlineUsers={totalOnline}
                className="text-xs"
              />
              <button
                type="button"
                onClick={() => setNotificationsOpen(true)}
                className="relative translate-y-1 p-2 rounded-lg transition-colors hover:bg-muted"
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

          <SubscriptionExpiryBannerSlot />

          <ModuleShellContentGate
            pagePath={MOBILE_PAGE_PATH.home}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div
              ref={listScrollRef}
              className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto seamless-scroll"
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
              {error ? (
                <div className="mx-auto w-full max-w-md px-2 content-padding-above-nav-home">
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
                <div className="mx-auto w-full max-w-md space-y-1 px-2 content-padding-above-nav-home">
                  {/* padding atas/bawah simetris lewat .content-padding-above-nav-home; space-y-1 = antar section */}
                  <div>
                    <div className="bg-card rounded-lg border border-border overflow-hidden">
                      <TimeDisplay />

                      {/* Location Button - di antara jam atas dan jam check in/out */}
                      {currentOfficeLocation && <LocationButton officeLocation={currentOfficeLocation} />}

                      <AttendanceStatus
                        checkIn={formatAttendanceClockFromRecord(
                          todayAttendance?.check_in_time,
                          todayAttendance?.check_in_at,
                          timeLocale,
                        )}
                        checkOut={formatAttendanceClockFromRecord(
                          todayAttendance?.check_out_time,
                          todayAttendance?.check_out_at,
                          timeLocale,
                        )}
                        workingHours={calculateWorkingHours()}
                      />

                      <AttendanceActions
                        onClockIn={handleClockIn}
                        onClockOut={handleClockOut}
                        clockInDisabled={hasCheckedIn}
                        clockOutDisabled={!hasCheckedIn || hasCheckedOut}
                      />
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
                            {t("mobileHome.shortcuts.dailyTask", "task")}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate("/tools/meeting-notes")}
                          className="flex flex-col items-center justify-center py-2 px-0.5 rounded-xl text-primary hover:bg-primary/10 active:bg-primary/15 transition-colors"
                        >
                          <NotebookPen className="h-6 w-6 mb-1" strokeWidth={1.75} />
                          <span className="text-[10px] font-medium text-foreground text-center leading-tight">
                            {t("mobileHome.shortcuts.notes", "Notes")}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLeaveModalOpen(true)}
                          className="flex flex-col items-center justify-center py-2 px-0.5 rounded-xl text-primary hover:bg-primary/10 active:bg-primary/15 transition-colors"
                        >
                          <CalendarDays className="h-6 w-6 mb-1" strokeWidth={1.75} />
                          <span className="text-[10px] font-medium text-foreground text-center leading-tight">
                            {t("mobileHome.shortcuts.leave", "Leave")}
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
          </ModuleShellContentGate>

          <NavigationFooter className="safe-area-bottom-lower" />
        </main>
        )}

        <CameraModal
          isOpen={cameraModal.isOpen}
          onClose={handleCameraClose}
          onCapture={handleCameraCapture}
          title={
            cameraModal.type === "clockin"
              ? t("mobileHome.cameraClockInTitle", "Foto Clock In")
              : t("mobileHome.cameraClockOutTitle", "Foto Clock Out")
          }
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

        <LeaveRequestMobileModal open={leaveModalOpen} onOpenChange={setLeaveModalOpen} />

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

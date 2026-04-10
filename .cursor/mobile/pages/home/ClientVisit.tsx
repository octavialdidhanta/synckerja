import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { TimeDisplay } from "@/mobile/components/TimeDisplay";
import { LocationChecker, LocationButton } from "@/mobile/components/LocationChecker";
import { AttendanceStatus } from "@/mobile/components/AttendanceStatus";
import { ClientVisitActions } from "@/mobile/components/ClientVisitActions";
import { TodayVisitSchedule } from "@/mobile/components/TodayVisitSchedule";
import { VisitAnalyticsCard } from "@/mobile/components/VisitAnalyticsCard";
import { VisitNotifications } from "@/mobile/components/VisitNotifications";
import { NavigationFooter } from "@/mobile/components/NavigationFooter";
import { DesktopWarning } from "@/mobile/components/DesktopWarning";
import { AppSidebar } from "@/mobile/components/AppSidebar";
import { CameraModal } from "@/mobile/components/CameraModal";
import { LateAttendanceModal } from "@/mobile/components/LateAttendanceModal";
import { SalesActivityModal, SalesActivityData } from "@/mobile/components/SalesActivityModal";
import { CustomDatePicker } from "@/mobile/components/CustomDatePicker";
import { SidebarProvider, SidebarTrigger } from "@/mobile/components/ui/sidebar";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subMonths, isWithinInterval, format } from "date-fns";
import { id as idLocale, enUS as enLocale } from "date-fns/locale";
import { Button } from "@/features/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from "@/mobile/components/ui/drawer";
import { ChevronDown, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClientVisitSkeleton } from "./ClientVisitSkeleton";
import { useToast } from "@/features/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useClientVisitData } from "@/mobile/hooks/useClientVisitData";
import { RealtimeStatusIndicator } from "@/mobile/components/RealtimeStatusIndicator";
import { useRealtimePresence } from "@/mobile/hooks/useRealtimePresence";
import { useVisualViewport } from "@/mobile/hooks/useVisualViewport";
import { useStatusBarStyle } from "@/mobile/hooks/useStatusBarStyle";
import { getCurrentPosition } from "@/mobile/utils/geolocation";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { logger } from "@/config/logger";

const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
const PULL_RESISTANCE = 0.55;

let confetti: ((opts?: object) => void) | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  confetti = require("canvas-confetti");
} catch {}

export default function ClientVisit() {
  useStatusBarStyle('light');
  const { toast } = useToast();
  const { t, language } = useAppTranslation();
  const [cameraModal, setCameraModal] = useState<{
    isOpen: boolean;
    type: 'start' | 'end' | null;
  }>({
    isOpen: false,
    type: null
  });
  
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [activeVisit, setActiveVisit] = useState<any>(null);
  const [locationValidation, setLocationValidation] = useState<any>(null);
  
  // Late attendance modal states
  const [showLateModal, setShowLateModal] = useState(false);
  const [lateMinutes, setLateMinutes] = useState(0);
  const [scheduledTime, setScheduledTime] = useState('');
  const [onLateSubmit, setOnLateSubmit] = useState<(reason: string) => Promise<void>>(() => async () => {});
  const [showSalesActivityModal, setShowSalesActivityModal] = useState(false);
  const [clientData, setClientData] = useState<{company_name: string; contact_phone?: string} | null>(null);
  const [dateFilter, setDateFilter] = useState("this_month");
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{start: Date; end: Date} | null>(null);
  const [periodDrawerOpen, setPeriodDrawerOpen] = useState(false);
  const confettiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const {
    todayVisits,
    todaySchedule,
    loading,
    error,
    realtimeConnected,
    refetch
  } = useClientVisitData();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef(0);
  const pullDistanceRef = useRef(0);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const didRecoveryRefetch = useRef(false);

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  useEffect(() => {
    if (didRecoveryRefetch.current || loading || error) return;
    const hasData = (todayVisits?.length ?? 0) > 0 || todaySchedule != null;
    if (hasData) return;
    didRecoveryRefetch.current = true;
    refetch().catch(() => {});
  }, [loading, error, todayVisits, todaySchedule, refetch]);

  // Setup user presence tracking
  const { onlineUsers, totalOnline } = useRealtimePresence(organizationId, currentUser || undefined);

  // Get current user info for presence tracking
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, active_organization_id')
          .eq('user_id', user.id)
          .single();
        
        if (profile) {
          setCurrentUser({ 
            id: user.id, 
            name: profile.full_name ?? user.email ?? 'Unknown'
          });
          setOrganizationId(profile.active_organization_id ?? '');
        }
      }
    };
    getCurrentUser().catch((err) => {
      logger.error('ClientVisit getCurrentUser', err);
    });
  }, []);

  // Check for active visit
  useEffect(() => {
    const checkActiveVisit = () => {
      const active = todayVisits.find(visit => visit.status === 'in_progress');
      setActiveVisit(active || null);
    };
    checkActiveVisit();
  }, [todayVisits]);

  // Clear confetti timeout on unmount
  useEffect(() => {
    return () => {
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
        confettiTimeoutRef.current = null;
      }
    };
  }, []);

  // Get date range based on filter selection
  const getDateRange = useMemo(() => {
    const now = new Date();
    switch (dateFilter) {
      case "today":
        return {
          start: startOfDay(now),
          end: endOfDay(now)
        };
      case "yesterday":
        const yesterday = subDays(now, 1);
        return {
          start: startOfDay(yesterday),
          end: endOfDay(yesterday)
        };
      case "this_week":
        return {
          start: startOfWeek(now, {
            weekStartsOn: 1
          }),
          end: endOfWeek(now, {
            weekStartsOn: 1
          })
        };
      case "this_month":
        return {
          start: startOfMonth(now),
          end: endOfMonth(now)
        };
      case "last_month":
        const lastMonth = subMonths(now, 1);
        return {
          start: startOfMonth(lastMonth),
          end: endOfMonth(lastMonth)
        };
      case "custom":
        // Use custom date range if available, otherwise default to current month
        if (customDateRange) {
          return {
            start: startOfDay(customDateRange.start),
            end: endOfDay(customDateRange.end)
          };
        }
        return {
          start: startOfMonth(now),
          end: endOfMonth(now)
        };
      default:
        return {
          start: startOfMonth(now),
          end: endOfMonth(now)
        };
    }
  }, [dateFilter, customDateRange]);

  const periodOptions: { value: string; labelKey: string }[] = [
    { value: "today", labelKey: "reports.dateFilter.today" },
    { value: "yesterday", labelKey: "reports.dateFilter.yesterday" },
    { value: "this_week", labelKey: "reports.dateFilter.thisWeek" },
    { value: "this_month", labelKey: "reports.dateFilter.thisMonth" },
    { value: "last_month", labelKey: "reports.dateFilter.lastMonth" },
    { value: "custom", labelKey: "reports.dateFilter.custom" },
  ];
  const periodFallbacks: Record<string, string> = {
    today: "Today",
    yesterday: "Yesterday",
    this_week: "This Week",
    this_month: "This Month",
    last_month: "Last Month",
    custom: "Custom",
  };

  // Handle date filter change
  const handleDateFilterChange = (value: string) => {
    if (value === "custom") {
      setShowCustomDatePicker(true);
    } else {
      setDateFilter(value);
    }
  };

  // Handle custom date range selection
  const handleCustomDateRange = (startDate: Date, endDate: Date) => {
    setCustomDateRange({ start: startDate, end: endDate });
    setDateFilter("custom");
  };

  // Filter visit data based on selected date range
  const filteredTodayVisits = useMemo(() => {
    if (!todayVisits || todayVisits.length === 0) return [];
    return todayVisits.filter(visit => {
      const visitDate = new Date(visit.visit_date);
      return isWithinInterval(visitDate, getDateRange);
    });
  }, [todayVisits, getDateRange]);

  const triggerConfetti = () => {
    if (typeof confetti !== 'function') return;
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

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  };

  // Calculate visit duration real-time
  const calculateVisitDuration = () => {
    if (!activeVisit?.actual_start_time) {
      return t("mobileHome.zeroHoursMinutes", "0 jam 0 menit");
    }
    const startTime = new Date(activeVisit.actual_start_time);
    const endTime = activeVisit.actual_end_time ? new Date(activeVisit.actual_end_time) : new Date();
    const diffMs = endTime.getTime() - startTime.getTime();
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return t("mobileHome.hoursMinutesFormat", "{{hours}} jam {{minutes}} menit", { hours, minutes });
  };

  const handleStartVisit = () => {
    if (activeVisit) {
      toast({
        title: "Kunjungan Sedang Berlangsung",
        description: "Anda sudah memiliki kunjungan yang sedang berlangsung",
        variant: "destructive"
      });
      return;
    }

    setCameraModal({
      isOpen: true,
      type: 'start'
    });
  };

  const handleEndVisit = () => {
    if (!activeVisit) {
      toast({
        title: "Tidak Ada Kunjungan Aktif",
        description: "Anda harus memulai kunjungan terlebih dahulu",
        variant: "destructive"
      });
      return;
    }

    setCameraModal({
      isOpen: true,
      type: 'end'
    });
  };

  const getCurrentLocation = (): Promise<{
    latitude: number;
    longitude: number;
  }> => getCurrentPosition();

  const handleCameraCapture = async (imageData: string) => {
    try {
      // Get current location
      const currentLocation = await getCurrentLocation();

      // Get current user and organization for validation
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "User tidak ditemukan",
          variant: "destructive"
        });
        return;
      }

      // Get user's active organization from profile
      const { data: profile }: any = await (supabase as any)
        .from('profiles')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.active_organization_id) {
        toast({
          title: "Error", 
          description: "Organisasi aktif tidak ditemukan",
          variant: "destructive"
        });
        return;
      }

      // Get employee data for the active organization
      const { data: employee, error: employeeError }: any = await (supabase as any)
        .from('employees')
        .select('id, organization_id')
        .eq('user_id', user.id)
        .eq('organization_id', profile.active_organization_id)
        .limit(1)
        .single();
        
      if (employeeError || !employee) {
        toast({
          title: "Error",
          description: "Data karyawan tidak ditemukan",
          variant: "destructive"
        });
        return;
      }

      // Perform location validation
      const { data: validationResult, error: validationError }: any = await (supabase as any).rpc(
        'validate_client_visit_location',
        {
          user_latitude: currentLocation.latitude,
          user_longitude: currentLocation.longitude,
          client_id_param: null,
          organization_id_param: profile.active_organization_id
        }
      );

      if (validationError) {
        logger.error('Location validation error:', validationError);
        toast({
          title: "Error Validasi Lokasi",
          description: "Gagal memvalidasi lokasi",
          variant: "destructive"
        });
        return;
      }

      // Type the validation result
      const validation = validationResult as any;

      // Check if location is valid first
      if (!validation?.is_valid) {
        toast({
          title: "Lokasi Tidak Valid",
          description: `Anda harus berada dalam radius ${validation?.allowed_radius_meters || 100}m dari lokasi yang valid. Jarak saat ini: ${Math.round(validation?.distance_meters || 0)}m`,
          variant: "destructive"
        });
        return;
      }
      if (!validation?.location_id) {
        toast({
          title: t("mobileHome.error", "Error"),
          description: "Lokasi tidak valid",
          variant: "destructive"
        });
        return;
      }

      // Get the office location details to check is_client_location and sales assignment
      const { data: officeLocation, error: officeError }: any = await (supabase as any)
        .from('office_locations')
        .select('id, name, is_client_location, planned_start_time, planned_end_time, sales_person_id')
        .eq('id', validation.location_id)
        .maybeSingle();

      if (officeError) {
        logger.error('Error fetching office location:', officeError);
        toast({
          title: "Error",
          description: "Gagal mendapatkan data lokasi kantor",
          variant: "destructive"
        });
        return;
      }

      // Check if this is a client location - ONLY allow visits for client locations
      if (!officeLocation?.is_client_location) {
        toast({
          title: "Akses Ditolak",
          description: "Lokasi ini tidak diizinkan untuk kunjungan client",
          variant: "destructive"
        });
        return;
      }

      // Check if current employee is assigned as sales person for this location
      if (officeLocation?.sales_person_id && officeLocation.sales_person_id !== employee.id) {
        toast({
          title: "Akses Ditolak",
          description: "Anda tidak ditugaskan untuk melakukan kunjungan ke lokasi ini",
          variant: "destructive"
        });
        return;
      }

      // Check if user is late based on current time and planned start time
      const currentTime = new Date();
      const currentTimeOnly = currentTime.toTimeString().slice(0, 8); // HH:MM:SS format
      let isLate = false;
      let lateMinutes = 0;

      if (officeLocation?.planned_start_time) {
        const plannedStartTime = officeLocation.planned_start_time;
        const plannedDate = new Date(`2000-01-01T${plannedStartTime}`);
        const currentDate = new Date(`2000-01-01T${currentTimeOnly}`);
        
        if (currentDate > plannedDate) {
          isLate = true;
          lateMinutes = Math.floor((currentDate.getTime() - plannedDate.getTime()) / (1000 * 60));
        }
      }

      if (cameraModal.type === 'start') {
        // Get the first available client for this organization
        let { data: clients }: any = await (supabase as any)
          .from('clients')
          .select('id')
          .eq('organization_id', employee.organization_id)
          .eq('is_active', true)
          .limit(1);

        // Product: auto-create default client when none exist for first visit.
        if (!clients || clients.length === 0) {
          const { data: newClient, error: clientError }: any = await (supabase as any)
            .from('clients')
            .insert({
              organization_id: employee.organization_id,
              company_name: 'Client Default',
              contact_person: 'Default Contact',
              is_active: true
            })
            .select('id')
            .single();

          if (clientError) {
            toast({
              title: "Error",
              description: "Gagal membuat client default",
              variant: "destructive"
            });
            return;
          }

          clients = [newClient];
        }

        // Function to create visit record
        const createVisitRecord = async (lateReason?: string) => {
          // Start Visit Logic - Create a new client visit record
          const visitData = {
            employee_id: employee.id,
            organization_id: employee.organization_id,
            lead_client_id: clients[0].id,
            visit_date: new Date().toISOString().split('T')[0],
            planned_start_time: officeLocation?.planned_start_time || null,
            planned_end_time: officeLocation?.planned_end_time || null,
            visit_purpose: 'Spontaneous client visit',
            actual_start_time: new Date().toISOString(),
            start_location: {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              address: "Location captured"
            },
            status: 'in_progress',
            start_photo_path: `visits/${user.id}/${Date.now()}_start.jpg`,
            created_by: user.id,
            validated_location_id: validation?.location_id || null,
            location_validation_result: validation || null,
            validation_accuracy_meters: validation?.accuracy_meters || null,
            notes: lateReason || null
          };

          const { data: insertedVisit, error: insertError }: any = await (supabase as any)
            .from('client_visits' as any)
            .insert(visitData)
            .select()
            .single();

          if (insertError) {
            logger.error('Start visit error:', insertError);
            toast({
              title: "Gagal Memulai Kunjungan",
              description: "Terjadi kesalahan saat menyimpan data",
              variant: "destructive"
            });
            return;
          }

          toast({
            title: "🎉 Kunjungan Dimulai!",
            description: "Selamat! Kunjungan client telah dimulai",
            className: "bg-success text-success-foreground"
          });

          if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
          confettiTimeoutRef.current = setTimeout(() => {
            triggerConfetti();
          }, 500);

          setActiveVisit(insertedVisit);
          await refetch();
        };

        // Check if user is late and show modal if needed
        if (isLate && lateMinutes > 0) {
          setLateMinutes(lateMinutes);
          setScheduledTime(officeLocation?.planned_start_time || '');
          setShowLateModal(true);
          setOnLateSubmit(() => createVisitRecord);
        } else {
          await createVisitRecord();
        }

      } else if (cameraModal.type === 'end') {
        // End Visit Logic
        const { error: updateError }: any = await (supabase as any)
          .from('client_visits' as any)
          .update({
            actual_end_time: new Date().toISOString(),
            end_location: {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              address: "Location captured"
            },
            end_photo_path: `visits/${user.id}/${Date.now()}_end.jpg`,
            status: 'completed',
            // End visit validation (validation is in scope from handleCameraCapture)
            ...(validation && {
              location_validation_result: {
                ...activeVisit.location_validation_result,
                end_validation: validation
              }
            })
          })
          .eq('id', activeVisit.id)
          .eq('status', 'in_progress');

        if (updateError) {
          logger.error('End visit error:', updateError);
          toast({
            title: "Gagal Mengakhiri Kunjungan",
            description: "Terjadi kesalahan saat menyimpan data",
            variant: "destructive"
          });
          return;
        }

        toast({
          title: "🎉 Kunjungan Selesai!",
          description: "Selamat! Anda telah menyelesaikan kunjungan client",
          className: "bg-success text-success-foreground"
        });

        if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
        confettiTimeoutRef.current = setTimeout(() => {
          triggerConfetti();
        }, 500);

        // Fetch client data for the modal
        if (activeVisit?.lead_client_id) {
          const { data: client }: any = await (supabase as any)
            .from('clients')
            .select('company_name, contact_phone, contact_person')
            .eq('id', activeVisit.lead_client_id)
            .single();
          
          if (client) {
            setClientData({
              company_name: client.company_name,
              contact_phone: client.contact_phone || client.contact_person // Use contact_person if contact_phone is empty
            });
          }
        }

        // Show sales activity modal
        setShowSalesActivityModal(true);
      }

      // Refresh visit data
      setCameraModal({ isOpen: false, type: null });
      refetch();
    } catch (error) {
      logger.error('Visit error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Terjadi kesalahan tidak terduga",
        variant: "destructive"
      });
    }
  };

  const handleCameraClose = () => {
    if (confettiTimeoutRef.current) {
      clearTimeout(confettiTimeoutRef.current);
      confettiTimeoutRef.current = null;
    }
    setCameraModal({
      isOpen: false,
      type: null
    });
  };

  const handleSalesActivitySubmit = async (data: SalesActivityData) => {
    try {
      // Get current user and organization
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User tidak ditemukan');
      }

      const { data: profile }: any = await (supabase as any)
        .from('profiles')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.active_organization_id) {
        throw new Error('Organization tidak ditemukan');
      }

      const salesActivityData = {
        organization_id: profile.active_organization_id,
        client_name: data.client_name,
        client_phone: data.client_phone,
        activity_type: data.activity_type,
        status: data.status,
        amount: data.amount,
        total_amount: data.total_amount,
        down_payment_amount: data.down_payment_amount,
        remaining_amount: data.total_amount && data.down_payment_amount 
          ? data.total_amount - data.down_payment_amount 
          : undefined,
        is_down_payment: data.is_down_payment,
        date: new Date().toISOString().split('T')[0], // Today's date
        description: data.description,
        is_paid: data.is_paid,
        payment_method: data.payment_method,
        receipt_url: data.receipt_url,
        follow_up_date: data.follow_up_date || null,
        notes: data.notes,
        created_by: user.id
      };

      const { error }: any = await (supabase as any)
        .from('sales_activities')
        .insert(salesActivityData);

      if (error) {
        logger.error('Sales activity error:', error);
        toast({
          title: "Gagal Menyimpan",
          description: `Error: ${error.message}`,
          variant: "destructive"
        });
        throw error;
      }

      toast({
        title: "✅ Aktivitas Tersimpan!",
        description: "Aktivitas penjualan berhasil disimpan",
        className: "bg-success text-success-foreground"
      });

      // Close modal after successful save
      setShowSalesActivityModal(false);

    } catch (error) {
      logger.error('Error saving sales activity:', error);
      throw error;
    }
  };

  // Calculate real analytics from filtered data
  const calculateAnalytics = useMemo(() => {
    const totalVisits = filteredTodayVisits.length;
    const completedVisits = filteredTodayVisits.filter(visit => visit.status === 'completed').length;
    const inProgressVisits = filteredTodayVisits.filter(visit => visit.status === 'in_progress').length;
    const upcomingVisits = filteredTodayVisits.filter(visit => visit.status === 'scheduled').length;
    
    // Calculate average duration for completed visits
    const completedVisitsWithDuration = filteredTodayVisits.filter(visit => 
      visit.status === 'completed' && visit.actual_start_time && visit.actual_end_time
    );
    
    let averageDuration = 0;
    if (completedVisitsWithDuration.length > 0) {
      const totalDuration = completedVisitsWithDuration.reduce((total, visit) => {
        const startTime = new Date(visit.actual_start_time);
        const endTime = new Date(visit.actual_end_time);
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationMinutes = Math.floor(durationMs / (1000 * 60));
        return total + durationMinutes;
      }, 0);
      averageDuration = Math.floor(totalDuration / completedVisitsWithDuration.length);
    }

    return {
      totalVisits,
      completedVisits,
      averageDuration,
      upcomingVisits: upcomingVisits + inProgressVisits // Include in-progress as upcoming
    };
  }, [filteredTodayVisits]);

  const getPeriodLabel = () => {
    switch (dateFilter) {
      case "today":
        return t("reports.dateFilter.today", "Hari Ini");
      case "yesterday":
        return t("reports.dateFilter.yesterday", "Kemarin");
      case "this_week":
        return t("reports.dateFilter.thisWeek", "Minggu Ini");
      case "this_month":
        return t("reports.dateFilter.thisMonth", "Bulan Ini");
      case "last_month":
        return t("reports.dateFilter.lastMonth", "Bulan Lalu");
      case "custom":
        if (customDateRange) {
          const locale = language === "id" ? idLocale : enLocale;
          const startDate = format(customDateRange.start, "dd MMM", { locale });
          const endDate = format(customDateRange.end, "dd MMM yyyy", { locale });
          return `${startDate} - ${endDate}`;
        }
        return t("reports.dateFilter.custom", "Kustom");
      default:
        return t("reports.dateFilter.thisMonth", "Bulan Ini");
    }
  };

  const mockNotifications: any[] = [];

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

  const { mainFixedStyle } = useVisualViewport();

  return (
    <DesktopWarning>
      <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        {/* Layout per .cursor/rules/mobile-tools-layout-android.mdc */}
        <main className="flex flex-col bg-background fixed inset-x-0 z-0" style={mainFixedStyle}>
          <header className="flex-shrink-0 sticky top-0 z-30 flex items-center justify-between p-3 bg-card border-b border-border safe-area-top">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="md:hidden" />
              <div>
                <h1 className="text-base font-semibold text-foreground">{t("clientVisit.pageTitle", "Client Visit")}</h1>
                <p className="text-xs text-muted-foreground">{t("clientVisit.pageSubtitle", "Kunjungan dan aktivitas client")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <RealtimeStatusIndicator
                isConnected={realtimeConnected}
                onlineUsers={totalOnline}
                className="text-xs md:hidden"
              />
              <div className="hidden md:block">
                <RealtimeStatusIndicator isConnected={realtimeConnected} onlineUsers={totalOnline} />
              </div>
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
                <div className="mx-auto w-full max-w-md px-2 pt-2 content-padding-above-nav-client-visit">
                  <ClientVisitSkeleton />
                </div>
              ) : error ? (
                <div className="mx-auto w-full max-w-md px-2 pt-2 content-padding-above-nav-client-visit">
                  <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                    <p className="text-sm text-destructive font-medium mb-1">{t('mobileHome.error', 'Error')}</p>
                    <p className="text-sm text-muted-foreground mb-3">{error}</p>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => refetch()}
                    >
                      {t("mobileHome.retry", "Coba lagi")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mx-auto w-full max-w-md px-2 pt-2 content-padding-above-nav-client-visit space-y-1">
                  <div>
                    <div className="bg-card rounded-lg border border-border overflow-hidden">
                      <TimeDisplay />
                      <LocationButton />
                      <AttendanceStatus
                        checkIn={activeVisit?.actual_start_time ? new Date(activeVisit.actual_start_time).toLocaleTimeString(language === "id" ? "id-ID" : "en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        }) : undefined}
                        checkOut={activeVisit?.actual_end_time ? new Date(activeVisit.actual_end_time).toLocaleTimeString(language === "id" ? "id-ID" : "en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        }) : undefined}
                        workingHours={calculateVisitDuration()}
                      />
                      <ClientVisitActions
                        onStartVisit={handleStartVisit}
                        onEndVisit={handleEndVisit}
                        hasActiveVisit={!!activeVisit}
                      />
                    </div>
                  </div>

                  <div>
                    <VisitNotifications
                      headerAction={
                        <Drawer open={periodDrawerOpen} onOpenChange={setPeriodDrawerOpen}>
                          <DrawerTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-32 h-8 text-xs justify-between gap-1 px-2"
                            >
                              <span className="truncate min-w-0">{getPeriodLabel()}</span>
                              <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            </Button>
                          </DrawerTrigger>
                          <DrawerContent className="max-h-[85dvh] flex flex-col">
                            <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                              <DrawerTitle className="text-lg font-semibold">
                                {t("clientVisit.notificationsTitle", "Visit Notifications")}
                              </DrawerTitle>
                            </DrawerHeader>
                            <div className="overflow-y-auto flex-1 min-h-0 px-4 pb-4">
                              <div className="flex flex-col gap-2 w-full">
                                {periodOptions.map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                      handleDateFilterChange(opt.value);
                                      setPeriodDrawerOpen(false);
                                    }}
                                    className={cn(
                                      "w-full px-3 py-2.5 rounded-md text-sm border text-left transition-colors",
                                      dateFilter === opt.value
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-background border-input hover:bg-muted"
                                    )}
                                  >
                                    {t(opt.labelKey, periodFallbacks[opt.value] ?? "Custom")}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="flex-shrink-0 border-t bg-muted/30 px-4 pt-3 pb-3">
                              <DrawerClose asChild>
                                <Button className="w-full" size="sm">
                                  {t("dailyTaskReport.filters.done", "Done")}
                                </Button>
                              </DrawerClose>
                            </div>
                          </DrawerContent>
                        </Drawer>
                      }
                    />
                  </div>

                  {todaySchedule && (
                    <div>
                      <TodayVisitSchedule visits={filteredTodayVisits} periodLabel={getPeriodLabel()} />
                    </div>
                  )}

                  <div>
                    <VisitAnalyticsCard {...calculateAnalytics} periodLabel={getPeriodLabel()} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Spacer so content doesn't scroll under the fixed footer */}
          <NavigationFooter className="safe-area-bottom-lower" />
        </main>

        <CameraModal
          isOpen={cameraModal.isOpen}
          onClose={handleCameraClose}
          onCapture={handleCameraCapture}
          title={cameraModal.type === "start" ? t("clientVisit.photoStart", "Foto Mulai Kunjungan") : t("clientVisit.photoEnd", "Foto Selesai Kunjungan")}
        />

        <LateAttendanceModal
          isOpen={showLateModal}
          onClose={() => setShowLateModal(false)}
          onSubmit={onLateSubmit}
          lateMinutes={lateMinutes}
          scheduledTime={scheduledTime}
        />

        <SalesActivityModal
          isOpen={showSalesActivityModal}
          onClose={() => setShowSalesActivityModal(false)}
          onSubmit={handleSalesActivitySubmit}
          clientData={clientData}
        />

        <CustomDatePicker
          isOpen={showCustomDatePicker}
          onClose={() => setShowCustomDatePicker(false)}
          onDateRangeSelect={handleCustomDateRange}
          initialStartDate={customDateRange?.start}
          initialEndDate={customDateRange?.end}
        />
      </div>
    </SidebarProvider>
    </DesktopWarning>
  );
}
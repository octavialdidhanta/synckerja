import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { getLocalDateYmd } from "@/shared/lib/date/getLocalDateYmd";
import { supabase } from "@/shared/lib/supabaseClient";
import { logger } from "@/shared/lib/logger";
import { useRealtimeData } from "@/mobile-app/hooks/useRealtimeData";

export interface ClientVisit {
  id: string;
  client_id?: string;
  lead_client_id?: string;
  employee_id: string;
  organization_id: string;
  visit_date: string;
  planned_start_time?: string;
  planned_end_time?: string;
  actual_start_time?: string;
  actual_end_time?: string;
  start_location?: any;
  end_location?: any;
  visit_purpose: string;
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  notes?: string;
  validated_location_id?: string | null;
  start_photo_path?: string;
  end_photo_path?: string;
  created_at: string;
  updated_at: string;
  validated_location?: {
    id: string;
    name?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    radius_meters?: number;
  } | null;
  client?: {
    id: string;
    company_name: string;
    contact_person?: string;
    contact_phone?: string;
    address?: string;
  };
}

export interface TodayVisitSchedule {
  isVisitDay: boolean;
  hasScheduledVisits: boolean;
  visits: ClientVisit[];
}

export interface ClientVisitDateRange {
  start: Date;
  end: Date;
}

const VISIT_SELECT = `
  *,
  client:clients(*),
  validated_location:office_locations(id, name, address, latitude, longitude, radius_meters)
`;

function toYmd(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function todayYmdLocal(): string {
  return getLocalDateYmd();
}

export const useClientVisitData = (dateRange: ClientVisitDateRange) => {
  const [visits, setVisits] = useState<ClientVisit[]>([]);
  const [todayVisits, setTodayVisits] = useState<ClientVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const startYmd = toYmd(dateRange.start);
  const endYmd = toYmd(dateRange.end);
  const todayYmd = todayYmdLocal();

  const fetchClientVisitData = useCallback(async () => {
    try {
      cancelledRef.current = false;
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (cancelledRef.current) return;
      if (!user) {
        setError("User not authenticated");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .single();

      if (cancelledRef.current) return;
      if (profileError && profileError.code !== 'PGRST116') {
        setError(profileError.message ?? 'Failed to load profile');
        return;
      }
      if (!profile?.active_organization_id) {
        setError("No active organization found");
        return;
      }

      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', profile.active_organization_id)
        .single();

      if (cancelledRef.current) return;
      if (!employee) {
        setError("Employee data not found");
        return;
      }

      const periodQuery = supabase
        .from('client_visits' as any)
        .select(VISIT_SELECT)
        .eq('employee_id', employee.id)
        .gte('visit_date', startYmd)
        .lte('visit_date', endYmd)
        .order('visit_date', { ascending: true })
        .order('planned_start_time', { ascending: true });

      const todayInPeriod = startYmd <= todayYmd && todayYmd <= endYmd;
      const todayQuery = todayInPeriod
        ? null
        : supabase
            .from('client_visits' as any)
            .select(VISIT_SELECT)
            .eq('employee_id', employee.id)
            .eq('visit_date', todayYmd)
            .order('planned_start_time', { ascending: true });

      const [periodResult, todayResult] = await Promise.all([
        periodQuery,
        todayQuery ?? Promise.resolve({ data: null, error: null }),
      ]);

      if (cancelledRef.current) return;
      if (periodResult.error) {
        logger.error('Error fetching visits:', periodResult.error);
        setVisits([]);
        setTodayVisits([]);
        setError("Failed to fetch visit data");
        return;
      }
      if (todayResult.error) {
        logger.error('Error fetching today visits:', todayResult.error);
        setVisits([]);
        setTodayVisits([]);
        setError("Failed to fetch visit data");
        return;
      }

      const typedPeriodVisits = (periodResult.data || []) as ClientVisit[];
      const typedTodayVisits = todayInPeriod
        ? typedPeriodVisits.filter((visit) => visit.visit_date === todayYmd)
        : ((todayResult.data || []) as ClientVisit[]);

      if (cancelledRef.current) return;
      setVisits(typedPeriodVisits);
      setTodayVisits(typedTodayVisits);
    } catch (err) {
      logger.error('Error in fetchClientVisitData:', err);
      if (!cancelledRef.current) setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [startYmd, endYmd, todayYmd]);

  const { isConnected: realtimeConnected } = useRealtimeData([
    {
      table: 'clients',
      onInsert: () => {
        logger.debug('New client, refetching visit data');
        fetchClientVisitData();
      },
      onUpdate: () => {
        logger.debug('Client updated, refetching visit data');
        fetchClientVisitData();
      },
      onDelete: () => {
        logger.debug('Client deleted, refetching visit data');
        fetchClientVisitData();
      }
    },
    {
      table: 'client_visits',
      onInsert: () => {
        logger.debug('Client visit inserted, refetching visit data');
        fetchClientVisitData();
      },
      onUpdate: () => {
        logger.debug('Client visit updated, refetching visit data');
        fetchClientVisitData();
      },
      onDelete: () => {
        logger.debug('Client visit deleted, refetching visit data');
        fetchClientVisitData();
      }
    }
  ]);

  useEffect(() => {
    fetchClientVisitData();
    return () => { cancelledRef.current = true; };
  }, [fetchClientVisitData]);

  const todaySchedule = useMemo<TodayVisitSchedule>(() => ({
    isVisitDay: todayVisits.length > 0,
    hasScheduledVisits: todayVisits.length > 0,
    visits: todayVisits,
  }), [todayVisits]);

  const visitsForNotifications = useMemo(() => {
    const byId = new Map<string, ClientVisit>();
    for (const visit of visits) byId.set(visit.id, visit);
    for (const visit of todayVisits) byId.set(visit.id, visit);
    return Array.from(byId.values());
  }, [visits, todayVisits]);

  return {
    visits,
    todayVisits,
    visitsForNotifications,
    todaySchedule,
    loading,
    error,
    realtimeConnected,
    refetch: fetchClientVisitData,
  };
};

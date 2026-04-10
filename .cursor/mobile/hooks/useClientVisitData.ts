import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/config/logger";
import { useRealtimeData } from "./useRealtimeData";

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
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  start_photo_path?: string;
  end_photo_path?: string;
  created_at: string;
  updated_at: string;
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

export const useClientVisitData = () => {
  const [todayVisits, setTodayVisits] = useState<ClientVisit[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<TodayVisitSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const fetchClientVisitData = useCallback(async () => {
    try {
      cancelledRef.current = false;
      setLoading(true);
      setError(null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelledRef.current) return;
      if (!user) {
        setError("User not authenticated");
        return;
      }

      // Get user's active organization
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

      // Get employee data
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

      const today = new Date().toISOString().split('T')[0];

      // Get today's client visits with client data for current employee
      const { data: visits, error: visitsError } = await supabase
        .from('client_visits' as any)
        .select(`
          *,
          client:clients(*)
        `)
        .eq('employee_id', employee.id)
        .eq('visit_date', today)
        .order('planned_start_time', { ascending: true });

      if (cancelledRef.current) return;
      if (visitsError) {
        logger.error('Error fetching visits:', visitsError);
        setError("Failed to fetch visit data");
        return;
      }

      const typedVisits = (visits || []) as any[];
      if (cancelledRef.current) return;
      setTodayVisits(typedVisits);
      setTodaySchedule({
        isVisitDay: typedVisits.length > 0,
        hasScheduledVisits: typedVisits.length > 0,
        visits: typedVisits
      });

    } catch (err) {
      logger.error('Error in fetchClientVisitData:', err);
      if (!cancelledRef.current) setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, []);

  // Setup realtime updates
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

  return {
    todayVisits,
    todaySchedule,
    loading,
    error,
    realtimeConnected,
    refetch: fetchClientVisitData
  };
};
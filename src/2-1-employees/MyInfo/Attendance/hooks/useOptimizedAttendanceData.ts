
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { attendanceHRQueryDefaults } from '@/shared/lib/attendanceHRQueryDefaults';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useEffect } from 'react';

// Centralized query keys
export const attendanceQueryKeys = {
  all: ['attendance'] as const,
  officeLocations: (orgId: string) => [...attendanceQueryKeys.all, 'office-locations', orgId] as const,
  locationTypes: () => [...attendanceQueryKeys.all, 'location-types'] as const,
  clients: (orgId: string) => [...attendanceQueryKeys.all, 'clients', orgId] as const,
  locationSettings: (orgId: string) => [...attendanceQueryKeys.all, 'location-settings', orgId] as const,
  workSchedules: (orgId: string) => [...attendanceQueryKeys.all, 'work-schedules', orgId] as const,
  nationalHolidays: (orgId: string) => [...attendanceQueryKeys.all, 'national-holidays', orgId] as const,
};

// Office Locations
export const useOptimizedOfficeLocations = () => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: attendanceQueryKeys.officeLocations(organizationId || ''),
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('office_locations')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
    ...attendanceHRQueryDefaults,
  });

  // Prefetch related data
  useEffect(() => {
    if (organizationId) {
      queryClient.prefetchQuery({
        queryKey: attendanceQueryKeys.locationTypes(),
        queryFn: async () => {
          const { data, error } = await supabase
            .from('location_types')
            .select('*')
            .eq('is_active', true)
            .order('name');

          if (error) throw error;
          return data || [];
        },
        staleTime: attendanceHRQueryDefaults.staleTime,
        gcTime: attendanceHRQueryDefaults.gcTime,
      });

      queryClient.prefetchQuery({
        queryKey: attendanceQueryKeys.clients(organizationId),
        queryFn: async () => {
          const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('is_active', true)
            .order('company_name');

          if (error) throw error;
          return data || [];
        },
        staleTime: attendanceHRQueryDefaults.staleTime,
        gcTime: attendanceHRQueryDefaults.gcTime,
      });
    }
  }, [organizationId, queryClient]);

  return query;
};

// Location Types
export const useOptimizedLocationTypes = () => {
  return useQuery({
    queryKey: attendanceQueryKeys.locationTypes(),
    queryFn: async () => {
      console.log('Fetching location types...');
      const { data, error } = await supabase
        .from('location_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      console.log('Location types response:', { data, error });
      
      if (error) {
        console.error('Error fetching location types:', error);
        throw error;
      }
      return data || [];
    },
    ...attendanceHRQueryDefaults,
  });
};

// Clients
export const useOptimizedClients = () => {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: attendanceQueryKeys.clients(organizationId || ''),
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('company_name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
    ...attendanceHRQueryDefaults,
  });
};

// Location Settings - removed (table deleted)

// Work Schedules
export const useOptimizedWorkSchedules = () => {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: attendanceQueryKeys.workSchedules(organizationId || ''),
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('work_schedule_settings')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('is_default', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
    ...attendanceHRQueryDefaults,
  });
};

// National Holidays
export const useOptimizedNationalHolidays = () => {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: attendanceQueryKeys.nationalHolidays(organizationId || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('national_holidays')
        .select('*')
        .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
        .eq('is_active', true)
        .eq('applies_to_attendance', true)
        .order('date', { ascending: true });

      if (error) throw error;
      console.log('National holidays data (filtered for active/attendance):', data);
      return data || [];
    },
    enabled: !!organizationId,
    ...attendanceHRQueryDefaults,
  });
};

// Main optimized attendance data hook
export const useOptimizedAttendanceData = () => {
  const officeLocations = useOptimizedOfficeLocations();
  const locationTypes = useOptimizedLocationTypes();
  const clients = useOptimizedClients();
  const workSchedules = useOptimizedWorkSchedules();
  const nationalHolidays = useOptimizedNationalHolidays();

  return {
    officeLocations,
    locationTypes,
    clients,
    workSchedules,
    nationalHolidays,
    isLoading: officeLocations.isLoading || locationTypes.isLoading || clients.isLoading || workSchedules.isLoading || nationalHolidays.isLoading,
    error: officeLocations.error || locationTypes.error || clients.error || workSchedules.error || nationalHolidays.error,
  };
};



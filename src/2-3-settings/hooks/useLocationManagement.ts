import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useToast } from '@/shared/components/ui/use-toast';
import {
  attendanceQueryKeys,
  useOptimizedOfficeLocations,
  useOptimizedLocationTypes,
  useOptimizedClients,
} from '@/2-1-employees/MyInfo/Attendance/hooks/useOptimizedAttendanceData';

export interface PenaltyRule {
  id: string;
  organization_id: string;
  name: string;
  rule_type: 'late_arrival' | 'early_departure' | 'no_checkout' | 'invalid_location';
  threshold_minutes: number;
  penalty_amount: number | null;
  penalty_type: 'deduction' | 'warning' | 'points';
  calculation_type: 'fixed' | 'hourly' | 'salary_percentage';
  hourly_rate: number | null;
  salary_percentage: number | null;
  max_penalty_per_month: number | null;
  description: string | null;
  is_active: boolean;
  applies_to_all: boolean;
  created_at: string;
  updated_at: string;
}

const penaltyRulesQueryKey = (organizationId?: string) => ['attendance-penalty-rules', organizationId] as const;

interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export const useClients = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { toast } = useToast();
  const clientsQuery = useOptimizedClients();

  const invalidate = useCallback(() => {
    if (organizationId) {
      queryClient.invalidateQueries({ queryKey: attendanceQueryKeys.clients(organizationId) });
    }
  }, [organizationId, queryClient]);

  const addClient = useCallback(
    async (client: Record<string, any>) => {
      if (!organizationId) {
        toast({ title: 'Organization not found', description: 'Cannot add client without organization context.', variant: 'destructive' });
        return null;
      }

      try {
        const { data, error } = await supabase
          .from('clients')
          .insert({ ...client, organization_id: organizationId })
          .select()
          .single();

        if (error) throw error;

        toast({ title: 'Client added', description: `${data?.company_name ?? 'Client'} berhasil ditambahkan.` });
        invalidate();
        return data;
      } catch (error) {
        console.error('useClients.addClient error:', error);
        toast({ title: 'Failed to add client', description: 'Periksa kembali data yang diinput.', variant: 'destructive' });
        return null;
      }
    },
    [invalidate, organizationId, toast]
  );

  const updateClient = useCallback(
    async (id: string, updates: Record<string, any>) => {
      try {
        const { error } = await supabase
          .from('clients')
          .update(updates)
          .eq('id', id);

        if (error) throw error;

        toast({ title: 'Client updated', description: 'Data klien berhasil diperbarui.' });
        invalidate();
        return true;
      } catch (error) {
        console.error('useClients.updateClient error:', error);
        toast({ title: 'Failed to update client', description: 'Perubahan tidak tersimpan.', variant: 'destructive' });
        return false;
      }
    },
    [invalidate, toast]
  );

  const deleteClient = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase
          .from('clients')
          .delete()
          .eq('id', id);

        if (error) throw error;

        toast({ title: 'Client deleted', description: 'Klien berhasil dihapus.' });
        invalidate();
        return true;
      } catch (error) {
        console.error('useClients.deleteClient error:', error);
        toast({ title: 'Failed to delete client', description: 'Klien tidak dapat dihapus.', variant: 'destructive' });
        return false;
      }
    },
    [invalidate, toast]
  );

  return {
    clients: clientsQuery.data ?? [],
    loading: clientsQuery.isLoading,
    error: clientsQuery.error,
    addClient,
    updateClient,
    deleteClient,
    refetch: clientsQuery.refetch,
  };
};

export const useOfficeLocations = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { toast } = useToast();
  const locationsQuery = useOptimizedOfficeLocations();

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: attendanceQueryKeys.officeLocations(organizationId || '') });
  }, [organizationId, queryClient]);

  const addLocation = useCallback(
    async (location: Record<string, any>) => {
      if (!organizationId) {
        toast({ title: 'Organization not found', description: 'Tidak dapat menambahkan lokasi tanpa organisasi.', variant: 'destructive' });
        return null;
      }

      try {
        const payload = {
          ...location,
          organization_id: organizationId,
        };

        const { data, error } = await supabase
          .from('office_locations')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        toast({ title: 'Lokasi ditambahkan', description: `${data?.name ?? 'Lokasi'} berhasil disimpan.` });
        invalidate();
        return data;
      } catch (error) {
        console.error('useOfficeLocations.addLocation error:', error);
        toast({ title: 'Gagal menambahkan lokasi', description: 'Silakan coba lagi.', variant: 'destructive' });
        return null;
      }
    },
    [invalidate, organizationId, toast]
  );

  return {
    locations: locationsQuery.data ?? [],
    loading: locationsQuery.isLoading,
    error: locationsQuery.error,
    addLocation,
    refetch: locationsQuery.refetch,
  };
};

export const useLocationTypes = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { toast } = useToast();
  const locationTypesQuery = useOptimizedLocationTypes();

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: attendanceQueryKeys.locationTypes() });
  }, [queryClient]);

  const addLocationType = useCallback(
    async (locationType: Record<string, any>) => {
      try {
        const payload = {
          ...locationType,
          organization_id: locationType.organization_id ?? organizationId ?? null,
        };

        const { data, error } = await supabase
          .from('location_types')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        toast({ title: 'Location type added', description: `${data?.name ?? 'Location type'} berhasil ditambahkan.` });
        invalidate();
        return data;
      } catch (error) {
        console.error('useLocationTypes.addLocationType error:', error);
        toast({ title: 'Failed to add location type', description: 'Silakan coba lagi.', variant: 'destructive' });
        return null;
      }
    },
    [invalidate, organizationId, toast]
  );

  const updateLocationType = useCallback(
    async (id: string, updates: Record<string, any>) => {
      try {
        const { error } = await supabase
          .from('location_types')
          .update(updates)
          .eq('id', id);

        if (error) throw error;

        toast({ title: 'Location type updated', description: 'Data berhasil diperbarui.' });
        invalidate();
        return true;
      } catch (error) {
        console.error('useLocationTypes.updateLocationType error:', error);
        toast({ title: 'Failed to update location type', description: 'Perubahan tidak tersimpan.', variant: 'destructive' });
        return false;
      }
    },
    [invalidate, toast]
  );

  const deleteLocationType = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase
          .from('location_types')
          .delete()
          .eq('id', id);

        if (error) throw error;

        toast({ title: 'Location type deleted', description: 'Jenis lokasi berhasil dihapus.' });
        invalidate();
        return true;
      } catch (error) {
        console.error('useLocationTypes.deleteLocationType error:', error);
        toast({ title: 'Failed to delete location type', description: 'Jenis lokasi tidak dapat dihapus.', variant: 'destructive' });
        return false;
      }
    },
    [invalidate, toast]
  );

  return {
    locationTypes: locationTypesQuery.data ?? [],
    loading: locationTypesQuery.isLoading,
    error: locationTypesQuery.error,
    addLocationType,
    updateLocationType,
    deleteLocationType,
    refetch: locationTypesQuery.refetch,
  };
};

export const useLocationVisits = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { toast } = useToast();

  const visitsQuery = useQuery({
    queryKey: ['location-visits', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('location_visits')
        .select(`
          *,
          office_locations ( id, name ),
          employees ( id, full_name )
        `)
        .eq('organization_id', organizationId)
        .order('scheduled_start_time', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!organizationId,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['location-visits', organizationId] });
  }, [organizationId, queryClient]);

  const scheduleVisit = useCallback(
    async (visit: Record<string, any>) => {
      if (!organizationId) {
        toast({ title: 'Organization not found', description: 'Tidak dapat menjadwalkan kunjungan.', variant: 'destructive' });
        return null;
      }

      try {
        const payload = {
          ...visit,
          organization_id: organizationId,
        };

        const { data, error } = await supabase
          .from('location_visits')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        toast({ title: 'Visit scheduled', description: 'Kunjungan berhasil dijadwalkan.' });
        invalidate();
        return data;
      } catch (error) {
        console.error('useLocationVisits.scheduleVisit error:', error);
        toast({ title: 'Failed to schedule visit', description: 'Silakan coba lagi.', variant: 'destructive' });
        return null;
      }
    },
    [invalidate, organizationId, toast]
  );

  const checkInToVisit = useCallback(
    async (visitId: string, coords: LocationCoordinates) => {
      try {
        const { error } = await supabase
          .from('location_visits')
          .update({
            status: 'ongoing',
            actual_check_in_time: new Date().toISOString(),
            check_in_latitude: coords.latitude,
            check_in_longitude: coords.longitude,
          })
          .eq('id', visitId);

        if (error) throw error;

        toast({ title: 'Check-in success', description: 'Anda berhasil check-in ke lokasi.' });
        invalidate();
        return true;
      } catch (error) {
        console.error('useLocationVisits.checkInToVisit error:', error);
        toast({ title: 'Failed to check-in', description: 'Tidak dapat melakukan check-in.', variant: 'destructive' });
        return false;
      }
    },
    [invalidate, toast]
  );

  const checkOutFromVisit = useCallback(
    async (visitId: string, coords: LocationCoordinates) => {
      try {
        const { error } = await supabase
          .from('location_visits')
          .update({
            status: 'completed',
            actual_check_out_time: new Date().toISOString(),
            check_out_latitude: coords.latitude,
            check_out_longitude: coords.longitude,
          })
          .eq('id', visitId);

        if (error) throw error;

        toast({ title: 'Check-out success', description: 'Kunjungan telah diselesaikan.' });
        invalidate();
        return true;
      } catch (error) {
        console.error('useLocationVisits.checkOutFromVisit error:', error);
        toast({ title: 'Failed to check-out', description: 'Tidak dapat melakukan check-out.', variant: 'destructive' });
        return false;
      }
    },
    [invalidate, toast]
  );

  return {
    visits: visitsQuery.data ?? [],
    loading: visitsQuery.isLoading,
    scheduleVisit,
    checkInToVisit,
    checkOutFromVisit,
    refetch: visitsQuery.refetch,
  };
};

export const usePenaltyRules = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { toast } = useToast();

  const rulesQuery = useQuery({
    queryKey: penaltyRulesQueryKey(organizationId),
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('penalty_rules')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as PenaltyRule[];
    },
    enabled: !!organizationId,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: penaltyRulesQueryKey(organizationId) });
  }, [organizationId, queryClient]);

  const createRule = useCallback(
    async (rule: Partial<PenaltyRule>) => {
      if (!organizationId) {
        toast({ title: 'Organization not found', description: 'Tidak dapat membuat aturan.', variant: 'destructive' });
        return null;
      }

      try {
        const payload = {
          ...rule,
          organization_id: organizationId,
        };

        const { data, error } = await supabase
          .from('penalty_rules')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        toast({ title: 'Rule created', description: 'Aturan denda berhasil disimpan.' });
        invalidate();
        return data as PenaltyRule;
      } catch (error) {
        console.error('usePenaltyRules.createRule error:', error);
        toast({ title: 'Failed to create rule', description: 'Silakan periksa data dan coba lagi.', variant: 'destructive' });
        return null;
      }
    },
    [invalidate, organizationId, toast]
  );

  const updateRule = useCallback(
    async (id: string, updates: Partial<PenaltyRule>) => {
      try {
        const { error } = await supabase
          .from('penalty_rules')
          .update(updates)
          .eq('id', id);

        if (error) throw error;

        toast({ title: 'Rule updated', description: 'Aturan denda berhasil diperbarui.' });
        invalidate();
        return true;
      } catch (error) {
        console.error('usePenaltyRules.updateRule error:', error);
        toast({ title: 'Failed to update rule', description: 'Perubahan tidak tersimpan.', variant: 'destructive' });
        return false;
      }
    },
    [invalidate, toast]
  );

  const deleteRule = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase
          .from('penalty_rules')
          .delete()
          .eq('id', id);

        if (error) throw error;

        toast({ title: 'Rule deleted', description: 'Aturan denda berhasil dihapus.' });
        invalidate();
        return true;
      } catch (error) {
        console.error('usePenaltyRules.deleteRule error:', error);
        toast({ title: 'Failed to delete rule', description: 'Aturan tidak dapat dihapus.', variant: 'destructive' });
        return false;
      }
    },
    [invalidate, toast]
  );

  const isPenaltyMigrationComplete = !rulesQuery.error;

  return {
    rules: rulesQuery.data ?? [],
    penaltyRules: rulesQuery.data ?? [],
    loading: rulesQuery.isLoading,
    error: rulesQuery.error,
    createRule,
    updateRule,
    deleteRule,
    refetch: rulesQuery.refetch,
    isPenaltyMigrationComplete,
  };
};

export const usePenaltySettings = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { organizationId } = useCurrentOrg();

  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isMutatingExemption, setIsMutatingExemption] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ['penalty-settings', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      if (!organizationId) return null;

      const { data, error } = await supabase
        .from('penalty_settings')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data ?? null;
    },
  });

  const exemptionsQuery = useQuery({
    queryKey: ['penalty-exemptions', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('penalty_exemptions')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidateSettings = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['penalty-settings', organizationId] });
  }, [organizationId, queryClient]);

  const invalidateExemptions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['penalty-exemptions', organizationId] });
  }, [organizationId, queryClient]);

  const updateSettings = useCallback(
    async (nextSettings: any) => {
      if (!organizationId) {
        toast({
          title: 'Organisasi tidak ditemukan',
          description: 'Tidak dapat memperbarui pengaturan denda.',
          variant: 'destructive',
        });
        return false;
      }

      setIsSavingSettings(true);
      try {
        if (settingsQuery.data?.id) {
          const { error } = await supabase
            .from('penalty_settings')
            .update({
              ...nextSettings,
              organization_id: organizationId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', settingsQuery.data.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('penalty_settings')
            .insert({
              ...nextSettings,
              organization_id: organizationId,
            });

          if (error) throw error;
        }

        toast({
          title: 'Pengaturan disimpan',
          description: 'Pengaturan denda berhasil diperbarui.',
        });
        invalidateSettings();
        return true;
      } catch (error) {
        console.error('usePenaltySettings.updateSettings error:', error);
        toast({
          title: 'Gagal menyimpan pengaturan',
          description: 'Silakan coba lagi.',
          variant: 'destructive',
        });
        return false;
      } finally {
        setIsSavingSettings(false);
      }
    },
    [organizationId, invalidateSettings, settingsQuery.data, toast]
  );

  const createExemption = useCallback(
    async (exemption: any) => {
      if (!organizationId) {
        toast({
          title: 'Organisasi tidak ditemukan',
          description: 'Tidak dapat menambahkan pengecualian.',
          variant: 'destructive',
        });
        return null;
      }

      setIsMutatingExemption(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        const { created_by: _cb, penalty_rule_id: prid, ...rest } = exemption as Record<string, unknown>;
        const penalty_rule_id =
          typeof prid === "string" && prid.length > 0 ? prid : null;
        const { data, error } = await supabase
          .from('penalty_exemptions')
          .insert({
            ...rest,
            penalty_rule_id,
            organization_id: organizationId,
            created_by: typeof _cb === "string" && _cb.length > 0 ? _cb : uid ?? null,
          })
          .select()
          .single();

        if (error) throw error;

        toast({
          title: 'Pengecualian ditambahkan',
          description: 'Pengecualian baru berhasil dibuat.',
        });
        invalidateExemptions();
        return data;
      } catch (error) {
        console.error('usePenaltySettings.createExemption error:', error);
        toast({
          title: 'Gagal menambahkan pengecualian',
          description: 'Silakan coba lagi.',
          variant: 'destructive',
        });
        return null;
      } finally {
        setIsMutatingExemption(false);
      }
    },
    [organizationId, invalidateExemptions, toast]
  );

  const updateExemption = useCallback(
    async (id: string, updates: any) => {
      setIsMutatingExemption(true);
      try {
        const { error } = await supabase
          .from('penalty_exemptions')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (error) throw error;

        toast({
          title: 'Pengecualian diperbarui',
          description: 'Data pengecualian berhasil diperbarui.',
        });
        invalidateExemptions();
        return true;
      } catch (error) {
        console.error('usePenaltySettings.updateExemption error:', error);
        toast({
          title: 'Gagal memperbarui pengecualian',
          description: 'Silakan coba lagi.',
          variant: 'destructive',
        });
        return false;
      } finally {
        setIsMutatingExemption(false);
      }
    },
    [invalidateExemptions, toast]
  );

  const deleteExemption = useCallback(
    async (id: string) => {
      setIsMutatingExemption(true);
      try {
        const { error } = await supabase
          .from('penalty_exemptions')
          .delete()
          .eq('id', id);

        if (error) throw error;

        toast({
          title: 'Pengecualian dihapus',
          description: 'Pengecualian berhasil dihapus.',
        });
        invalidateExemptions();
        return true;
      } catch (error) {
        console.error('usePenaltySettings.deleteExemption error:', error);
        toast({
          title: 'Gagal menghapus pengecualian',
          description: 'Silakan coba lagi.',
          variant: 'destructive',
        });
        return false;
      } finally {
        setIsMutatingExemption(false);
      }
    },
    [invalidateExemptions, toast]
  );

  const loading =
    settingsQuery.isLoading ||
    exemptionsQuery.isLoading ||
    isSavingSettings ||
    isMutatingExemption;

  return {
    settings: settingsQuery.data,
    loading,
    error: settingsQuery.error || exemptionsQuery.error,
    updateSettings,
    exemptions: exemptionsQuery.data ?? [],
    createExemption,
    updateExemption,
    deleteExemption,
  };
};

export const usePenaltyMigrationStatus = () => {
  return { isPenaltyMigrationComplete: true };
};

export const useAttendanceHolidays = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { toast } = useToast();

  const { data: holidaysData, isLoading, error } = useQuery({
    queryKey: ['attendance-holidays', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('national_holidays')
        .select('*')
        .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
        .order('date', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const holidays = useMemo(() => holidaysData ?? [], [holidaysData]);

  const computeWorkingDaysSummary = useCallback(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    let workingDays = 0;
    let weekendDays = 0;
    let holidayDays = 0;

    const activeHolidays = holidays.filter((holiday) => holiday.is_active !== false);

    for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
      const current = new Date(day);
      const dayOfWeek = current.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isoDate = current.toISOString().split('T')[0];

      const matchingHoliday = activeHolidays.find((holiday) => holiday.date === isoDate);

      if (matchingHoliday) {
        holidayDays += 1;
      } else if (isWeekend) {
        weekendDays += 1;
      } else {
        workingDays += 1;
      }
    }

    return {
      summary: {
        working_days: workingDays,
        weekend_days: weekendDays,
        holiday_days: holidayDays,
      },
      calculated_at: new Date().toISOString(),
    };
  }, [holidays]);

  const [workingDaysSummary, setWorkingDaysSummary] = useState(() => computeWorkingDaysSummary());

  const fetchWorkingDaysSummary = useCallback(() => {
    const summary = computeWorkingDaysSummary();
    setWorkingDaysSummary(summary);
    return summary;
  }, [computeWorkingDaysSummary]);

  const invalidateHolidays = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['attendance-holidays', organizationId] });
  }, [organizationId, queryClient]);

  const createHoliday = useCallback(
    async (holiday: Record<string, any>) => {
      if (!organizationId) {
        toast({
          title: 'Organisasi tidak ditemukan',
          description: 'Tidak dapat menambahkan hari libur.',
          variant: 'destructive',
        });
        return null;
      }

      try {
        const payload = { ...holiday, organization_id: organizationId };
        const { data, error } = await supabase.from('national_holidays').insert(payload).select().single();

        if (error) throw error;

        toast({
          title: 'Hari libur ditambahkan',
          description: `${data?.name ?? 'Hari libur'} berhasil disimpan.`,
        });

        invalidateHolidays();
        fetchWorkingDaysSummary();
        return data;
      } catch (error) {
        console.error('useAttendanceHolidays.createHoliday error:', error);
        toast({
          title: 'Gagal menambahkan hari libur',
          description: 'Silakan coba lagi.',
          variant: 'destructive',
        });
        return null;
      }
    },
    [organizationId, toast, invalidateHolidays, fetchWorkingDaysSummary]
  );

  const toggleHolidayStatus = useCallback(
    async (id: string, isActive: boolean) => {
      try {
        const { error } = await supabase
          .from('national_holidays')
          .update({ is_active: !isActive })
          .eq('id', id);

        if (error) throw error;

        toast({
          title: 'Status diperbarui',
          description: 'Status hari libur berhasil diperbarui.',
        });

        invalidateHolidays();
        fetchWorkingDaysSummary();
        return true;
      } catch (error) {
        console.error('useAttendanceHolidays.toggleHolidayStatus error:', error);
        toast({
          title: 'Gagal memperbarui status',
          description: 'Silakan coba lagi.',
          variant: 'destructive',
        });
        return false;
      }
    },
    [toast, invalidateHolidays, fetchWorkingDaysSummary]
  );

  const deleteHoliday = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase.from('national_holidays').delete().eq('id', id);

        if (error) throw error;

        toast({
          title: 'Hari libur dihapus',
          description: 'Hari libur berhasil dihapus.',
        });

        invalidateHolidays();
        fetchWorkingDaysSummary();
        return true;
      } catch (error) {
        console.error('useAttendanceHolidays.deleteHoliday error:', error);
        toast({
          title: 'Gagal menghapus hari libur',
          description: 'Silakan coba lagi.',
          variant: 'destructive',
        });
        return false;
      }
    },
    [toast, invalidateHolidays, fetchWorkingDaysSummary]
  );

  return {
    holidays,
    loading: isLoading,
    error,
    createHoliday,
    toggleHolidayStatus,
    deleteHoliday,
    workingDaysSummary,
    fetchWorkingDaysSummary,
  };
};

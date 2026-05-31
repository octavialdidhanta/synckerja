import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { attendanceHRQueryDefaults } from '@/shared/lib/attendanceHRQueryDefaults';
import { useToast } from '@/shared/components/ui/use-toast';

export interface AttendanceRulesSettingsRow {
  id?: string;
  organization_id: string;
  enforce_national_holidays: boolean;
  require_photo_checkin: boolean;
  require_photo_checkout: boolean;
  auto_checkout_enabled: boolean;
  auto_checkout_time: string;
  default_max_radius_meters: number;
  gps_accuracy_threshold_meters: number;
  require_gps_accuracy: boolean;
  allow_manual_location: boolean;
  enable_visit_attendance_integration: boolean;
  travel_threshold_minutes: number;
  field_first_overlap_minutes: number;
  urban_travel_speed_kmh: number;
}

export const ATTENDANCE_RULES_DEFAULTS: Omit<AttendanceRulesSettingsRow, 'organization_id'> = {
  enforce_national_holidays: true,
  require_photo_checkin: true,
  require_photo_checkout: true,
  auto_checkout_enabled: false,
  auto_checkout_time: '18:00',
  default_max_radius_meters: 100,
  gps_accuracy_threshold_meters: 50,
  require_gps_accuracy: false,
  allow_manual_location: false,
  enable_visit_attendance_integration: true,
  travel_threshold_minutes: 90,
  field_first_overlap_minutes: 30,
  urban_travel_speed_kmh: 35,
};

export function mergeAttendanceRulesSettings(
  organizationId: string,
  row: Partial<AttendanceRulesSettingsRow> | null | undefined,
): AttendanceRulesSettingsRow {
  return {
    organization_id: organizationId,
    ...ATTENDANCE_RULES_DEFAULTS,
    ...(row ?? {}),
    auto_checkout_time: (row?.auto_checkout_time ?? ATTENDANCE_RULES_DEFAULTS.auto_checkout_time).slice(0, 5),
  };
}

export const useAttendanceRulesSettings = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { organizationId } = useCurrentOrg();
  const [isSaving, setIsSaving] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ['attendance-rules-settings', organizationId],
    enabled: !!organizationId,
    ...attendanceHRQueryDefaults,
    queryFn: async () => {
      if (!organizationId) return null;

      const { data, error } = await supabase
        .from('attendance_rules_settings')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data ?? null;
    },
  });

  const settings = useMemo(
    () =>
      organizationId
        ? mergeAttendanceRulesSettings(organizationId, settingsQuery.data ?? undefined)
        : null,
    [organizationId, settingsQuery.data],
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['attendance-rules-settings', organizationId] });
  }, [organizationId, queryClient]);

  const saveSettings = useCallback(
    async (nextSettings: AttendanceRulesSettingsRow) => {
      if (!organizationId) {
        toast({
          title: 'Organization not found',
          description: 'Cannot save attendance rules.',
          variant: 'destructive',
        });
        return false;
      }

      setIsSaving(true);
      try {
        const payload = {
          enforce_national_holidays: nextSettings.enforce_national_holidays,
          require_photo_checkin: nextSettings.require_photo_checkin,
          require_photo_checkout: nextSettings.require_photo_checkout,
          auto_checkout_enabled: nextSettings.auto_checkout_enabled,
          auto_checkout_time: nextSettings.auto_checkout_time,
          default_max_radius_meters: nextSettings.default_max_radius_meters,
          gps_accuracy_threshold_meters: nextSettings.gps_accuracy_threshold_meters,
          require_gps_accuracy: nextSettings.require_gps_accuracy,
          allow_manual_location: nextSettings.allow_manual_location,
          enable_visit_attendance_integration: nextSettings.enable_visit_attendance_integration,
          travel_threshold_minutes: nextSettings.travel_threshold_minutes,
          field_first_overlap_minutes: nextSettings.field_first_overlap_minutes,
          urban_travel_speed_kmh: nextSettings.urban_travel_speed_kmh,
          organization_id: organizationId,
        };

        if (settingsQuery.data?.id) {
          const { error } = await supabase
            .from('attendance_rules_settings')
            .update(payload)
            .eq('id', settingsQuery.data.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('attendance_rules_settings').insert(payload);
          if (error) throw error;
        }

        toast({
          title: 'Settings saved',
          description: 'Attendance rules updated successfully.',
        });
        invalidate();
        return true;
      } catch (error) {
        console.error('useAttendanceRulesSettings.saveSettings error:', error);
        toast({
          title: 'Failed to save settings',
          description: 'Please try again.',
          variant: 'destructive',
        });
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [organizationId, invalidate, settingsQuery.data, toast],
  );

  return {
    settings,
    settingsData: settingsQuery.data,
    loading: settingsQuery.isLoading,
    error: settingsQuery.error,
    saveSettings,
    isSaving,
    refetch: settingsQuery.refetch,
    isMigrationComplete: !settingsQuery.error,
  };
};

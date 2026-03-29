
import { useState, useEffect } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useToast } from '@/shared/components/ui/use-toast';

export interface WorkScheduleSettings {
  id: string;
  organization_id: string;
  name: string;
  working_days: number[];
  start_time: string;
  end_time: string;
  break_start_time?: string;
  break_end_time?: string;
  late_tolerance_minutes: number;
  overtime_threshold_minutes: number;
  is_default: boolean;
  is_active: boolean;
  timezone: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export const useWorkScheduleSettings = () => {
  const [settings, setSettings] = useState<WorkScheduleSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const { organizationId } = useCurrentOrg();
  const { toast } = useToast();

  const fetchSettings = async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('work_schedule_settings')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('is_default', { ascending: false });

      if (error) throw error;
      setSettings(data || []);
    } catch (error) {
      console.error('Error fetching work schedule settings:', error);
      toast({
        title: "Error",
        description: "Failed to fetch work schedule settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createSettings = async (settingsData: Omit<WorkScheduleSettings, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('work_schedule_settings')
        .insert(settingsData)
        .select()
        .single();

      if (error) throw error;

      setSettings(prev => [...prev, data]);
      toast({
        title: "Success",
        description: "Work schedule created successfully",
      });

      return data;
    } catch (error) {
      console.error('Error creating work schedule settings:', error);
      toast({
        title: "Error",
        description: "Failed to create work schedule settings",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateSettings = async (id: string, updates: Partial<WorkScheduleSettings>) => {
    try {
      const { data, error } = await supabase
        .from('work_schedule_settings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setSettings(prev => prev.map(setting => setting.id === id ? data : setting));
      toast({
        title: "Success",
        description: "Work schedule updated successfully",
      });

      return data;
    } catch (error) {
      console.error('Error updating work schedule settings:', error);
      toast({
        title: "Error",
        description: "Failed to update work schedule settings",
        variant: "destructive",
      });
      return null;
    }
  };

  const deleteSettings = async (id: string) => {
    try {
      const { error } = await supabase
        .from('work_schedule_settings')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      setSettings(prev => prev.filter(setting => setting.id !== id));
      toast({
        title: "Success",
        description: "Work schedule deleted successfully",
      });

      return true;
    } catch (error) {
      console.error('Error deleting work schedule settings:', error);
      toast({
        title: "Error",
        description: "Failed to delete work schedule settings",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [organizationId]);
  
  // Add real-time subscription for work schedule changes
  useEffect(() => {
    if (!organizationId) return;
    
    const channel = supabase
      .channel('work-schedule-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_schedule_settings',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload) => {
          console.log('🔄 Work schedule settings changed:', payload);
          fetchSettings(); // Refetch settings when they change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId]);

  return {
    settings,
    loading,
    createSettings,
    updateSettings,
    deleteSettings,
    refetch: fetchSettings,
  };
};




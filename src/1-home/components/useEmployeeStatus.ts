import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { logger } from '@/shared/lib/logger';

export interface EmployeeStatus {
  id: string;
  employee_id: string;
  organization_id: string;
  status_text: string;
  location: string;
  status_type: 'work' | 'meeting' | 'break' | 'call' | 'wfh';
  created_at: string;
  expires_at: string;
  employees?: {
    full_name: string;
    profile_photo_url?: string | null;
    departments?: {
      name: string;
    } | null;
  } | null;
}

export const useEmployeeStatus = () => {
  const [statuses, setStatuses] = useState<EmployeeStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const { toast } = useToast();
  const { organizationId } = useCurrentOrg();
  const { t } = useTranslation();

  const fetchStatuses = useCallback(async () => {
    try {
      setLoadError(null);
      if (!organizationId) {
        logger.query('âš ï¸ No organization ID found for employee status');
        setStatuses([]);
        setLoading(false);
        return;
      }

      logger.query('ðŸ” Fetching employee statuses for organization:', organizationId);

      const { data, error } = await supabase
        .from('employee_status')
        .select(`
          *,
          employees!inner (
            full_name,
            organization_id,
            profile_photo_url,
            departments (
              name
            )
          )
        `)
        .eq('employees.organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching employee statuses:', error);
        setLoadError(new Error(error.message));
        toast({
          title: "Error",
          description: t("home.employeeStatus.loadError"),
          variant: "destructive",
        });
        return;
      }

      setStatuses((data as unknown as EmployeeStatus[]) || []);
    } catch (error) {
      console.error('Error fetching employee statuses:', error);
      setLoadError(
        error instanceof Error ? error : new Error(String(error)),
      );
      toast({
        title: "Error",
        description: t("home.employeeStatus.loadErrorGeneric"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [organizationId, t, toast]);

  const createStatus = async (statusData: {
    status_text: string;
    location: string;
    status_type: 'work' | 'meeting' | 'break' | 'call' | 'wfh';
  }) => {
    try {
      // Get current user's employee data using organization context
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !organizationId) throw new Error('User not authenticated or no organization');

      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('id, organization_id')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (empError || !employee) {
        logger.debug('Employee not found for current user, this is normal for some users');
        toast({
          title: "Info",
          description: t("home.employeeStatus.notAvailable"),
          variant: "default",
        });
        return false;
      }

      const { error } = await supabase
        .from('employee_status')
        .insert([{
          ...statusData,
          employee_id: employee.id,
          organization_id: employee.organization_id,
        }]);

      if (error) {
        console.error('Error creating status:', error);
        toast({
          title: "Error",
          description: t("home.employeeStatus.createError"),
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Berhasil",
        description: t("home.employeeStatus.createSuccess"),
      });

      // Refresh the statuses
      fetchStatuses();
      return true;
    } catch (error) {
      console.error('Error creating status:', error);
      toast({
        title: "Error",
        description: t("home.employeeStatus.createErrorGeneric"),
        variant: "destructive",
      });
      return false;
    }
  };

  const updateStatus = async (statusId: string, statusData: {
    status_text: string;
    location: string;
    status_type: 'work' | 'meeting' | 'break' | 'call' | 'wfh';
  }) => {
    try {
      const { error } = await supabase
        .from('employee_status')
        .update(statusData)
        .eq('id', statusId);

      if (error) {
        console.error('Error updating status:', error);
        toast({
          title: "Error",
          description: t("home.employeeStatus.updateError"),
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Berhasil",
        description: t("home.employeeStatus.updateSuccess"),
      });

      fetchStatuses();
      return true;
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: t("home.employeeStatus.updateErrorGeneric"),
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteStatus = async (statusId: string) => {
    try {
      const { error } = await supabase
        .from('employee_status')
        .delete()
        .eq('id', statusId);

      if (error) {
        console.error('Error deleting status:', error);
        toast({
          title: "Error",
          description: t("home.employeeStatus.deleteError"),
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Berhasil",
        description: t("home.employeeStatus.deleteSuccess"),
      });

      fetchStatuses();
      return true;
    } catch (error) {
      console.error('Error deleting status:', error);
      toast({
        title: "Error",
        description: t("home.employeeStatus.deleteErrorGeneric"),
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchStatuses();
    }
  }, [organizationId, fetchStatuses]);

  return {
    statuses,
    loading,
    error: loadError,
    createStatus,
    updateStatus,
    deleteStatus,
    refetch: fetchStatuses,
  };
};

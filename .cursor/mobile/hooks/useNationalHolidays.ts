import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/config/logger';

interface NationalHoliday {
  id: string;
  name: string;
  date: string;
  is_recurring: boolean;
  is_active: boolean;
  applies_to_attendance: boolean;
  recurring_type?: string;
  country_code?: string;
}

export const useNationalHolidays = () => {
  const [holidays, setHolidays] = useState<NationalHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrentMonthHolidays = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get user's active organization first
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profileData?.active_organization_id) {
        throw profileError || new Error('No active organization found');
      }

      // Get employee data for the active organization
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('organization_id', profileData.active_organization_id)
        .single();

      if (employeeError) {
        throw employeeError;
      }

      // Get current month start and end dates
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Fetch national holidays for current month
      const { data: holidaysData, error: holidaysError } = await supabase
        .from('national_holidays')
        .select('id, name, date, is_recurring, is_active, applies_to_attendance, recurring_type, country_code')
        .or(`organization_id.eq.${employeeData.organization_id},organization_id.is.null`)
        .eq('is_active', true)
        .eq('applies_to_attendance', true)
        .or(`date.gte.${monthStart.toISOString().split('T')[0]},is_recurring.eq.true`)
        .lte('date', monthEnd.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (holidaysError) {
        throw holidaysError;
      }

      // Filter holidays for current month
      const currentMonthHolidays = holidaysData?.filter(holiday => {
        const holidayDate = new Date(holiday.date);
        if (holiday.is_recurring) {
          // For recurring holidays, check if month matches
          return holidayDate.getMonth() === now.getMonth();
        } else {
          // For non-recurring holidays, check if it's in current month and year
          return holidayDate.getMonth() === now.getMonth() && 
                 holidayDate.getFullYear() === now.getFullYear();
        }
      }) || [];

      setHolidays(currentMonthHolidays);

    } catch (err) {
      logger.error('Error fetching national holidays:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch holidays');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentMonthHolidays();

    // Set up realtime listener for automatic updates
    const holidayChannel = supabase
      .channel('national-holidays-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'national_holidays'
        },
        () => {
          logger.debug('National holidays updated, refreshing...');
          fetchCurrentMonthHolidays();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(holidayChannel);
    };
  }, []);

  return {
    holidays,
    loading,
    error,
    refetch: fetchCurrentMonthHolidays,
  };
};
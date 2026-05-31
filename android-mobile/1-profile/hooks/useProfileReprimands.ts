import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { logger } from '@/shared/lib/logger';

export interface ProfileReprimandRecord {
  id: string;
  reprimand_type: string;
  severity_level: string;
  violation_category: string;
  incident_date: string;
  incident_time?: string;
  incident_location?: string;
  violation_description: string;
  status: string;
  created_at: string;
}

const REPRIMAND_SELECT = `
  id,
  reprimand_type,
  severity_level,
  violation_category,
  incident_date,
  incident_time,
  incident_location,
  violation_description,
  status,
  created_at
`;

async function fetchProfileReprimands(
  employeeId: string,
  organizationId: string,
): Promise<ProfileReprimandRecord[]> {
  try {
    const { data, error } = await supabase
      .from('reprimands')
      .select(REPRIMAND_SELECT)
      .eq('employee_id', employeeId)
      .eq('organization_id', organizationId)
      .neq('status', 'cancelled')
      .order('incident_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      logger.warn('Error fetching profile reprimands:', error);
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      reprimand_type: row.reprimand_type,
      severity_level: row.severity_level,
      violation_category: row.violation_category,
      incident_date: row.incident_date,
      incident_time: row.incident_time ?? undefined,
      incident_location: row.incident_location ?? undefined,
      violation_description: row.violation_description,
      status: row.status,
      created_at: row.created_at,
    }));
  } catch (err) {
    logger.warn('Failed to fetch profile reprimands:', err);
    return [];
  }
}

export function useProfileReprimands(
  employeeId: string | null,
  organizationId: string | null,
  enabled: boolean,
) {
  const [reprimands, setReprimands] = useState<ProfileReprimandRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!employeeId || !organizationId) {
      setReprimands([]);
      return;
    }

    cancelledRef.current = false;
    setLoading(true);
    setError(null);

    try {
      const result = await fetchProfileReprimands(employeeId, organizationId);

      if (cancelledRef.current) return;

      setReprimands(result);
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch reprimands');
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [employeeId, organizationId]);

  useEffect(() => {
    if (!enabled) {
      cancelledRef.current = true;
      return;
    }

    void fetchData();

    return () => {
      cancelledRef.current = true;
    };
  }, [enabled, fetchData]);

  return {
    reprimands,
    loading,
    error,
    refetch: fetchData,
  };
}

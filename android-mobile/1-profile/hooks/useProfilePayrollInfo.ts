import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { logger } from '@/shared/lib/logger';

export interface ProfilePayrollInfoData {
  bpjs_ketenagakerjaan_number?: string;
  bpjs_kesehatan_number?: string;
  bpjs_kesehatan_family_members?: number;
  bpjs_ketenagakerjaan_date?: string;
  bpjs_kesehatan_date?: string;
  bpjs_kesehatan_configuration?: string;
  npwp?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_holder?: string;
  currency?: string;
  ptkp_status?: string;
  beginning_netto?: number;
  pph21_paid?: number;
}

const PAYROLL_INFO_SELECT =
  'bpjs_ketenagakerjaan_number, bpjs_kesehatan_number, bpjs_kesehatan_family_members, bpjs_ketenagakerjaan_date, bpjs_kesehatan_date, bpjs_kesehatan_configuration, npwp, bank_name, bank_account_number, bank_account_holder, currency, ptkp_status, beginning_netto, pph21_paid';

async function fetchPayrollInfo(employeeId: string): Promise<ProfilePayrollInfoData | null> {
  try {
    const { data, error } = await supabase
      .from('employee_payroll_info')
      .select(PAYROLL_INFO_SELECT)
      .eq('employee_id', employeeId)
      .maybeSingle();

    if (error) {
      logger.warn('Error fetching payroll info:', error);
      return null;
    }

    if (!data) return null;

    return {
      bpjs_ketenagakerjaan_number: data.bpjs_ketenagakerjaan_number ?? undefined,
      bpjs_kesehatan_number: data.bpjs_kesehatan_number ?? undefined,
      bpjs_kesehatan_family_members: data.bpjs_kesehatan_family_members ?? undefined,
      bpjs_ketenagakerjaan_date: data.bpjs_ketenagakerjaan_date ?? undefined,
      bpjs_kesehatan_date: data.bpjs_kesehatan_date ?? undefined,
      bpjs_kesehatan_configuration: data.bpjs_kesehatan_configuration ?? undefined,
      npwp: data.npwp ?? undefined,
      bank_name: data.bank_name ?? undefined,
      bank_account_number: data.bank_account_number ?? undefined,
      bank_account_holder: data.bank_account_holder ?? undefined,
      currency: data.currency ?? undefined,
      ptkp_status: data.ptkp_status ?? undefined,
      beginning_netto: data.beginning_netto ?? undefined,
      pph21_paid: data.pph21_paid ?? undefined,
    };
  } catch (err) {
    logger.warn('Failed to fetch payroll info:', err);
    return null;
  }
}

export function useProfilePayrollInfo(employeeId: string | null, enabled: boolean) {
  const [payrollInfo, setPayrollInfo] = useState<ProfilePayrollInfoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!employeeId) {
      setPayrollInfo(null);
      return;
    }

    cancelledRef.current = false;
    setLoading(true);
    setError(null);

    try {
      const result = await fetchPayrollInfo(employeeId);

      if (cancelledRef.current) return;

      setPayrollInfo(result);
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch payroll info');
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [employeeId]);

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
    payrollInfo,
    loading,
    error,
    refetch: fetchData,
  };
}

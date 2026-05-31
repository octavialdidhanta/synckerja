import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { logger } from '@/shared/lib/logger';

export interface FormalEducationData {
  id: string;
  institution_name: string;
  degree: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string;
  grade_gpa?: string;
  description?: string;
  is_current?: boolean;
}

export interface InformalEducationData {
  id: string;
  course_name: string;
  provider?: string;
  field_of_certification?: string;
  certificate_number?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
}

export interface WorkExperienceData {
  id: string;
  company_name: string;
  position: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  job_description?: string;
}

async function fetchFormalEducations(employeeId: string): Promise<FormalEducationData[]> {
  try {
    const { data, error } = await supabase
      .from('employee_educations')
      .select(
        'id, institution_name, degree, field_of_study, start_date, end_date, grade_gpa, description, is_current',
      )
      .eq('employee_id', employeeId)
      .order('start_date', { ascending: false });

    if (error) {
      logger.warn('Error fetching formal educations:', error);
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      institution_name: row.institution_name,
      degree: row.degree,
      field_of_study: row.field_of_study ?? undefined,
      start_date: row.start_date ?? undefined,
      end_date: row.end_date ?? undefined,
      grade_gpa: row.grade_gpa ?? undefined,
      description: row.description ?? undefined,
      is_current: row.is_current ?? undefined,
    }));
  } catch (err) {
    logger.warn('Failed to fetch formal educations:', err);
    return [];
  }
}

async function fetchInformalEducations(employeeId: string): Promise<InformalEducationData[]> {
  try {
    const { data, error } = await supabase
      .from('employee_informal_educations')
      .select(
        'id, course_name, provider, field_of_certification, certificate_number, start_date, end_date, description',
      )
      .eq('employee_id', employeeId)
      .order('start_date', { ascending: false });

    if (error) {
      logger.warn('Error fetching informal educations:', error);
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      course_name: row.course_name,
      provider: row.provider ?? undefined,
      field_of_certification: row.field_of_certification ?? undefined,
      certificate_number: row.certificate_number ?? undefined,
      start_date: row.start_date ?? undefined,
      end_date: row.end_date ?? undefined,
      description: row.description ?? undefined,
    }));
  } catch (err) {
    logger.warn('Failed to fetch informal educations:', err);
    return [];
  }
}

async function fetchWorkExperiences(employeeId: string): Promise<WorkExperienceData[]> {
  try {
    const { data, error } = await supabase
      .from('employee_work_experiences')
      .select('id, company_name, position, location, start_date, end_date, is_current, job_description')
      .eq('employee_id', employeeId)
      .order('start_date', { ascending: false });

    if (error) {
      logger.warn('Error fetching work experiences:', error);
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      company_name: row.company_name,
      position: row.position,
      location: row.location ?? undefined,
      start_date: row.start_date ?? undefined,
      end_date: row.end_date ?? undefined,
      is_current: row.is_current ?? undefined,
      job_description: row.job_description ?? undefined,
    }));
  } catch (err) {
    logger.warn('Failed to fetch work experiences:', err);
    return [];
  }
}

export function useProfileEducationExperience(employeeId: string | null, enabled: boolean) {
  const [formalEducations, setFormalEducations] = useState<FormalEducationData[]>([]);
  const [informalEducations, setInformalEducations] = useState<InformalEducationData[]>([]);
  const [workExperiences, setWorkExperiences] = useState<WorkExperienceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const fetchAll = useCallback(async () => {
    if (!employeeId) {
      setFormalEducations([]);
      setInformalEducations([]);
      setWorkExperiences([]);
      return;
    }

    cancelledRef.current = false;
    setLoading(true);
    setError(null);

    try {
      const [formal, informal, work] = await Promise.all([
        fetchFormalEducations(employeeId),
        fetchInformalEducations(employeeId),
        fetchWorkExperiences(employeeId),
      ]);

      if (cancelledRef.current) return;

      setFormalEducations(formal);
      setInformalEducations(informal);
      setWorkExperiences(work);
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch education and experience');
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

    void fetchAll();

    return () => {
      cancelledRef.current = true;
    };
  }, [enabled, fetchAll]);

  return {
    formalEducations,
    informalEducations,
    workExperiences,
    loading,
    error,
    refetch: fetchAll,
  };
}

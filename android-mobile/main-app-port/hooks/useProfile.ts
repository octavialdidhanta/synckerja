import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { logger } from '@/shared/lib/logger';

export interface EmergencyContactData {
  id: string;
  name: string;
  relationship?: string;
  gender?: string;
  age?: number;
  occupation?: string;
  phone?: string;
  address?: string;
}

export interface FamilyMemberData {
  id: string;
  name: string;
  relationship?: string;
  gender?: string;
  age?: number;
  occupation?: string;
  phone?: string;
  address?: string;
  is_emergency_contact?: boolean;
}

export interface ProfileData {
  id: string;
  full_name: string;
  email: string;
  mobile_phone?: string;
  address?: string;
  join_date?: string;
  status?: string;
  department_name?: string;
  job_position_name?: string;
  job_level_name?: string;
  employee_id?: string;
  photo_url?: string;
  birth_place?: string;
  birth_date?: string;
  gender?: string;
  marital_status?: string;
  religion?: string;
  nik?: string;
  citizen_address?: string;
  hasEmployeeRecord?: boolean;
  emergencyContacts?: EmergencyContactData[];
  familyMembers?: FamilyMemberData[];
}

async function fetchEmergencyContacts(employeeId: string): Promise<EmergencyContactData[]> {
  try {
    const { data, error } = await supabase
      .from('employee_family_members')
      .select('id, name, relationship, gender, age, occupation, phone, address')
      .eq('employee_id', employeeId)
      .eq('is_emergency_contact', true)
      .order('created_at', { ascending: true });

    if (error) {
      logger.warn('Error fetching emergency contacts:', error);
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      relationship: row.relationship ?? undefined,
      gender: row.gender ?? undefined,
      age: row.age ?? undefined,
      occupation: row.occupation ?? undefined,
      phone: row.phone ?? undefined,
      address: row.address ?? undefined,
    }));
  } catch (err) {
    logger.warn('Failed to fetch emergency contacts:', err);
    return [];
  }
}

async function fetchFamilyMembers(employeeId: string): Promise<FamilyMemberData[]> {
  try {
    const { data, error } = await supabase
      .from('employee_family_members')
      .select('id, name, relationship, gender, age, occupation, phone, address, is_emergency_contact')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.warn('Error fetching family members:', error);
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      relationship: row.relationship ?? undefined,
      gender: row.gender ?? undefined,
      age: row.age ?? undefined,
      occupation: row.occupation ?? undefined,
      phone: row.phone ?? undefined,
      address: row.address ?? undefined,
      is_emergency_contact: row.is_emergency_contact ?? undefined,
    }));
  } catch (err) {
    logger.warn('Failed to fetch family members:', err);
    return [];
  }
}

export const useProfile = () => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const realtimeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProfile = async () => {
    try {
      cancelledRef.current = false;
      setLoading(true);
      setError(null);

      // Get current user with better error handling
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        logger.error('Auth error:', userError);
        // Clean up invalid auth state
        await cleanupAuthState();
        throw new Error('Authentication failed');
      }

      if (!user) {
        throw new Error('User not authenticated');
      }
      if (cancelledRef.current) return;

      // Get user's active organization from profile
      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        setError(profileError.message ?? 'Failed to load profile');
        return;
      }
      if (cancelledRef.current) return;

      if (!profileRow?.active_organization_id) {
        // Fallback to auth user data if no active organization
        if (cancelledRef.current) return;
        setProfile({
          id: user.id,
          full_name: user.user_metadata?.full_name || 'User',
          email: user.email || '',
          hasEmployeeRecord: false,
          emergencyContacts: [],
          familyMembers: [],
        });
        return;
      }
      if (cancelledRef.current) return;

      logger.debug('Active organization ID:', profileRow.active_organization_id);

      // Fetch employee data for the active organization only
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select(`
          id,
          employee_id,
          full_name,
          email,
          mobile_phone,
          address,
          join_date,
          birth_place,
          birth_date,
          gender,
          marital_status,
          religion,
          nik,
          citizen_address,
          employee_status_id,
          employee_statuses(name),
          profile_photo_url,
          departments(name),
          job_positions(name),
          job_levels(name),
          organization_id
        `)
        .eq('user_id', user.id)
        .eq('organization_id', profileRow.active_organization_id)
        .maybeSingle();

      logger.debug('Employee data query result:', { employeeData, employeeError });

      if (employeeError && employeeError.code !== 'PGRST116') {
        logger.error('Error fetching employee data:', employeeError);
        throw employeeError;
      }
      if (cancelledRef.current) return;

      if (employeeData) {
        // Verify the employee belongs to the correct organization
        if (employeeData.organization_id === profileRow.active_organization_id) {
          if (cancelledRef.current) return;
          const [emergencyContacts, familyMembers] = await Promise.all([
            fetchEmergencyContacts(employeeData.id),
            fetchFamilyMembers(employeeData.id),
          ]);
          if (cancelledRef.current) return;
          setProfile({
            id: employeeData.id,
            full_name: employeeData.full_name,
            email: employeeData.email || user.email || '',
            mobile_phone: employeeData.mobile_phone ?? undefined,
            address: employeeData.address ?? undefined,
            join_date: employeeData.join_date ?? undefined,
            birth_place: employeeData.birth_place ?? undefined,
            birth_date: employeeData.birth_date ?? undefined,
            gender: employeeData.gender ?? undefined,
            marital_status: employeeData.marital_status ?? undefined,
            religion: employeeData.religion ?? undefined,
            nik: employeeData.nik ?? undefined,
            citizen_address: employeeData.citizen_address ?? undefined,
            status: employeeData.employee_statuses?.name ?? 'active',
            department_name: employeeData.departments?.name,
            job_position_name: employeeData.job_positions?.name,
            job_level_name: employeeData.job_levels?.name,
            employee_id: employeeData.employee_id,
            photo_url: employeeData.profile_photo_url ?? undefined,
            hasEmployeeRecord: true,
            emergencyContacts,
            familyMembers,
          });
        } else {
          logger.warn('Employee organization mismatch');
          if (cancelledRef.current) return;
          setProfile({
            id: user.id,
            full_name: user.user_metadata?.full_name || 'User',
            email: user.email || '',
            hasEmployeeRecord: false,
            emergencyContacts: [],
            familyMembers: [],
          });
        }
      } else {
        logger.debug('No employee data found for active organization');
        if (cancelledRef.current) return;
        setProfile({
          id: user.id,
          full_name: user.user_metadata?.full_name || 'User',
          email: user.email || '',
          hasEmployeeRecord: false,
          emergencyContacts: [],
          familyMembers: [],
        });
      }
    } catch (err) {
      logger.error('Error fetching profile:', err);
      if (!cancelledRef.current) setError(err instanceof Error ? err.message : 'Failed to fetch profile');
      
      // If it's an auth error, redirect to login
      if (err instanceof Error && (err.message.includes('not authenticated') || err.message.includes('Authentication failed'))) {
        window.location.href = '/login';
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  };

  const cleanupAuthState = async () => {
    try {
      // Remove all auth-related keys from localStorage
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          localStorage.removeItem(key);
        }
      });
      
      // Sign out
      await supabase.auth.signOut({ scope: 'global' });
    } catch (error) {
      logger.error('Error cleaning up auth state:', error);
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // Clear profile data
      setProfile(null);
    } catch (err) {
      logger.error('Error logging out:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchProfile();
    return () => { cancelledRef.current = true; };
  }, []);

  // Listen for profile changes (organization switching)
  useEffect(() => {
    const channel = supabase
      .channel('profile-organization-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          logger.debug('Profile organization updated:', payload);
          if (realtimeTimeoutRef.current) clearTimeout(realtimeTimeoutRef.current);
          realtimeTimeoutRef.current = setTimeout(() => {
            fetchProfile();
          }, 150);
        }
      )
      .subscribe();

    return () => {
      if (realtimeTimeoutRef.current) {
        clearTimeout(realtimeTimeoutRef.current);
        realtimeTimeoutRef.current = null;
      }
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        // Avoid noisy errors when socket already closed
        logger.warn('Cleanup channel skipped:', e);
      }
    };
  }, []);

  return {
    profile,
    loading,
    error,
    logout,
    refetch: fetchProfile,
  };
};

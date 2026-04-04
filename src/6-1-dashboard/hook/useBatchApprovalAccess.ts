import { useState, useEffect } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { devLog } from '@/shared/lib/logger';

// Shared cache for approval access checks
const approvalCheckCache = new Map<string, { result: boolean; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

interface ApprovalAccess {
  approved: boolean;
  prodApproved: boolean;
  loading: boolean;
}

/**
 * Hook to batch check approval access for all column types
 * This prevents duplicate checks across multiple ContentPlanRow components
 */
export const useBatchApprovalAccess = (): ApprovalAccess => {
  const [access, setAccess] = useState<ApprovalAccess>({
    approved: false,
    prodApproved: false,
    loading: true
  });

  useEffect(() => {
    const checkApprovalAccess = async (columnType: string): Promise<boolean> => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        // Get user's active organization
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('active_organization_id')
          .eq('user_id', user.id)
          .single();

        if (profileError || !profile?.active_organization_id) {
          devLog.error('Error fetching user profile:', profileError);
          return false;
        }

        // Check cache first
        const cacheKey = `approval_${columnType}_${user.id}_${profile.active_organization_id}`;
        const cached = approvalCheckCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
          // Cache hit - return cached result
          return cached.result;
        }

        // Get user's role in the organization
        const { data: userRole, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('organization_id', profile.active_organization_id)
          .single();

        if (roleError || !userRole) {
          devLog.error('Error fetching user role:', roleError);
          return false;
        }

        // Get user's employee record to check exceptions
        const { data: employee, error: employeeError } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', user.id)
          .eq('organization_id', profile.active_organization_id)
          .single();

        if (employeeError || !employee) {
          devLog.error('Error fetching employee:', employeeError);
          return false;
        }

        // Get approval configuration for this column type
        const { data: config, error: configError } = await supabase
          .from('approval_access_configurations')
          .select('*')
          .eq('organization_id', profile.active_organization_id)
          .eq('column_type', columnType)
          .eq('is_active', true)
          .maybeSingle();

        if (configError || !config) {
          // If no configuration found, fall back to admin-only access
          const result = userRole.role === 'owner' || userRole.role === 'admin';
          // Cache the result
          approvalCheckCache.set(cacheKey, { result, timestamp: Date.now() });
          return result;
        }

        // Check if user's role is in the allowed roles
        const hasRoleAccess = config.allowed_roles?.includes(userRole.role);

        // Check if user is in the exceptions list
        const isException = config.exceptions?.includes(employee.id);
        const result = hasRoleAccess || isException;

        // Cache the result
        approvalCheckCache.set(cacheKey, { result, timestamp: Date.now() });

        return result;
      } catch (error) {
        devLog.error('Error checking approval access:', error);
        return false;
      }
    };

    const fetchApprovalAccess = async () => {
      try {
        // Batch check both column types in parallel
        const [approved, prodApproved] = await Promise.all([
          checkApprovalAccess('approved'),
          checkApprovalAccess('prod_approved')
        ]);

        setAccess({
          approved,
          prodApproved,
          loading: false
        });
      } catch (error) {
        devLog.error('Error fetching approval access:', error);
        setAccess({
          approved: false,
          prodApproved: false,
          loading: false
        });
      }
    };

    fetchApprovalAccess();
  }, []);

  return access;
};


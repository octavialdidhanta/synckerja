import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { logger } from '@/shared/lib/logger';
import { filterValidCycleIds } from '@/shared/lib/uuidValidation';
import { globalDepartmentObjectivesCache } from './globalDepartmentObjectivesCache';
import { useOKRSectionVisibility } from '../OKRSectionVisibilityContext';

export interface DepartmentObjective {
  id: string;
  organization_id: string;
  cycle_id: string;
  company_objective_id: string;
  department_id: string;
  title: string;
  description?: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  progress_percentage: number;
  weight: number;
  start_date?: string;
  end_date?: string;
  owner_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Relations
  departments?: { name: string };
  company_objectives?: { title: string };
  okr_cycles?: { name: string; year: number; quarter?: string };
  individual_objectives?: Array<{
    id: string;
    title: string;
    description?: string;
    progress_percentage: number;
    status: string;
    employees?: { full_name: string };
  }>;
}

interface CreateDepartmentObjectiveData {
  organization_id: string;
  cycle_id: string;
  company_objective_id: string;
  department_id: string;
  title: string;
  description?: string;
  why_important?: string;
  status?: 'draft' | 'active' | 'completed' | 'cancelled';
  weight?: number;
  start_date?: string;
  end_date?: string;
  owner_id: string;
  created_by: string;
}

interface CreateDepartmentObjectiveWithKeyResults extends CreateDepartmentObjectiveData {
  key_results?: Array<{
    title: string;
    description?: string;
    metric_type: 'number' | 'percentage' | 'currency' | 'boolean';
    calculation_type: 'increase' | 'decrease' | 'maintain';
    start_value: number;
    target_value: number;
    unit: string;
    weight: number;
  }>;
}

export const useDepartmentObjectives = (
  organizationId?: string,
  cycleIds?: string[],
  includeIndividualObjectives: boolean = false,
  queryEnabled: boolean = true,
) => {
  const queryClient = useQueryClient();
  const subscriptionRef = useRef<any>(null);
  const isOKRSectionVisible = useOKRSectionVisibility();

  // Real-time subscription for department objectives
  useEffect(() => {
    if (!organizationId) return;

    // Prevent duplicate subscriptions
    if (subscriptionRef.current) {
      return;
    }

    logger.realtime('🔄 Setting up real-time subscription for department objectives with org:', organizationId);

    subscriptionRef.current = supabase
      .channel(`department_objectives_realtime_${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'department_objectives',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload) => {
          logger.realtime('📡 REAL-TIME UPDATE for department objectives:', {
            event: payload.eventType,
            table: payload.table,
            new: payload.new,
            old: payload.old
          });
          
          // Force immediate invalidation
          queryClient.invalidateQueries({ 
            queryKey: ['department-objectives'],
            exact: false 
          });
          
          // Also invalidate specific org queries
          queryClient.invalidateQueries({ 
            queryKey: ['department-objectives', organizationId],
            exact: false 
          });
        }
      )
      .subscribe((status) => {
        logger.realtime('📊 Department objectives subscription status:', status);
      });

    return () => {
      if (subscriptionRef.current) {
        logger.realtime('🔄 Cleaning up department objectives subscription');
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [organizationId, queryClient]);

  return useQuery({
    queryKey: ['department-objectives', organizationId, cycleIds, includeIndividualObjectives],
    queryFn: async () => {
      if (!organizationId) {
        logger.debug('❌ No organizationId provided');
        return [];
      }
      
      // 🌐 GLOBAL CACHE: Use singleton cache for deduplication
      return globalDepartmentObjectivesCache.getDepartmentObjectives(
        organizationId, 
        cycleIds, 
        includeIndividualObjectives
      );
    },
    enabled: !!organizationId && isOKRSectionVisible && queryEnabled,
    staleTime: 120 * 1000, // 120 seconds - increased cache time to reduce refetch frequency
    refetchOnMount: false, // Don't refetch on mount if data is fresh
    refetchOnWindowFocus: false, // Don't refetch on window focus (global cache handles this)
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache longer
  });
};

export const useCreateDepartmentObjective = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (objectiveData: CreateDepartmentObjectiveWithKeyResults) => {
      if (import.meta.env?.DEV) {
        console.log('🚀 Creating department objective:', objectiveData);
      }

      // Extract key_results from objective data
      const { key_results, ...departmentObjectiveData } = objectiveData;

      // First, create the department objective
      const { data: departmentObjective, error: objectiveError } = await supabase
        .from('department_objectives')
        .insert(departmentObjectiveData)
        .select()
        .single();

      if (objectiveError) {
        if (import.meta.env?.DEV) {
          console.error('❌ Error creating department objective:', objectiveError);
        }
        throw objectiveError;
      }

      if (import.meta.env?.DEV) {
        console.log('✅ Department objective created successfully:', departmentObjective);
        // Automatically create a key result in the parent company objective
        console.log('🔑 Creating key result in company objective for department objective:', departmentObjective.id);
      }
      
      const companyKeyResultData = {
        organization_id: departmentObjectiveData.organization_id,
        company_objective_id: departmentObjectiveData.company_objective_id,
        department_objective_id: departmentObjective.id,
        title: departmentObjective.title,
        description: '', // Keep description empty to prevent auto-generation issue
        metric_type: 'percentage' as const,
        calculation_type: 'increase' as const,
        start_value: 0,
        target_value: 100,
        current_value: departmentObjective.progress_percentage || 0,
        unit: '%',
        weight: departmentObjective.weight || 100,
        progress_percentage: departmentObjective.progress_percentage || 0,
        is_inverse: false,
        owner_level: 'department' as const,
        created_by: departmentObjectiveData.created_by,
        department_id: departmentObjectiveData.department_id,
      };

      const { data: companyKeyResult, error: companyKRError } = await supabase
        .from('key_results')
        .insert(companyKeyResultData)
        .select()
        .single();

      if (companyKRError) {
        if (import.meta.env?.DEV) {
          console.error('❌ Error creating key result in company objective:', companyKRError);
        }
      } else {
        if (import.meta.env?.DEV) {
          console.log('✅ Key result created in company objective:', companyKeyResult);
        }
      }

      // If key_results are provided, create them separately for the department objective
      if (key_results && key_results.length > 0) {
        if (import.meta.env?.DEV) {
          console.log('🔑 Creating key results for department objective:', departmentObjective.id);
        }
        
        const keyResultsData = key_results.map(kr => ({
          organization_id: departmentObjectiveData.organization_id,
          department_objective_id: departmentObjective.id,
          title: kr.title,
          description: kr.description || '',
          metric_type: kr.metric_type,
          calculation_type: kr.calculation_type,
          start_value: kr.start_value,
          target_value: kr.target_value,
          current_value: kr.start_value,
          unit: kr.unit,
          weight: kr.weight,
          progress_percentage: 0,
          is_inverse: false,
          owner_level: 'department' as const,
          created_by: departmentObjectiveData.created_by,
          department_id: departmentObjectiveData.department_id,
        }));

        const { data: keyResults, error: keyResultsError } = await supabase
          .from('key_results')
          .insert(keyResultsData)
          .select();

        if (keyResultsError) {
          if (import.meta.env?.DEV) {
            console.error('❌ Error creating key results:', keyResultsError);
            // Don't throw here, just log the error as the main objective was created
            console.warn('Department objective created but key results failed');
          }
        } else {
          if (import.meta.env?.DEV) {
            console.log('✅ Key results created successfully:', keyResults);
          }
        }
      }

      return departmentObjective;
    },
    onSuccess: () => {
      // Invalidate all related queries for immediate UI update
      queryClient.invalidateQueries({ queryKey: ['department-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['company-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['individual-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      queryClient.invalidateQueries({ queryKey: ['okr-hierarchy'] });
      // Invalidate objective stats queries for all types
      queryClient.invalidateQueries({ queryKey: ['objective-stats'] });
      toast({
        title: 'Success',
        description: 'Department objective created successfully',
      });
    },
    onError: (error) => {
      console.error('❌ Failed to create department objective:', error);
      toast({
        title: 'Error',
        description: 'Failed to create department objective',
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateDepartmentObjective = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DepartmentObjective> }) => {
      if (import.meta.env?.DEV) {
        console.log('🔄 Updating department objective:', { id, updates });
      }

      const { data, error } = await supabase
        .from('department_objectives')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (import.meta.env?.DEV) {
          console.error('❌ Error updating department objective:', error);
        }
        throw error;
      }

      if (import.meta.env?.DEV) {
        console.log('✅ Department objective updated successfully:', data);
      }

      // If progress_percentage was updated, sync it to the corresponding key result
      if (updates.progress_percentage !== undefined) {
        if (import.meta.env?.DEV) {
          console.log('🔄 Syncing progress to company objective key result');
        }
        
        const { data: keyResult, error: keyResultError } = await supabase
          .from('key_results')
          .update({
            current_value: updates.progress_percentage,
            progress_percentage: updates.progress_percentage,
            updated_at: new Date().toISOString()
          })
          .eq('department_objective_id', id)
          .select()
          .single();

        if (keyResultError) {
          if (import.meta.env?.DEV) {
            console.error('❌ Error syncing progress to key result:', keyResultError);
          }
        } else {
          if (import.meta.env?.DEV) {
            console.log('✅ Progress synced to key result:', keyResult);
          }
        }
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate all related queries for immediate UI update
      queryClient.invalidateQueries({ queryKey: ['department-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['company-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['individual-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      queryClient.invalidateQueries({ queryKey: ['okr-hierarchy'] });
      // Invalidate objective stats queries for all types
      queryClient.invalidateQueries({ queryKey: ['objective-stats'] });
      toast({
        title: 'Success',
        description: 'Department objective updated successfully',
      });
    },
    onError: (error) => {
      console.error('❌ Failed to update department objective:', error);
      toast({
        title: 'Error',
        description: 'Failed to update department objective',
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteDepartmentObjective = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (objectiveId: string) => {
      console.log('🗑️ Deleting department objective:', objectiveId);

      try {
        // First, delete related individual objectives
        const { error: individualError } = await supabase
          .from('individual_objectives')
          .delete()
          .eq('department_objective_id', objectiveId);

        if (individualError) {
          console.warn('⚠️ Warning deleting individual objectives:', individualError);
        } else {
          console.log('✅ Deleted individual objectives for department objective');
        }

        // Delete related key results in company objectives
        const { error: keyResultError } = await supabase
          .from('key_results')
          .delete()
          .eq('department_objective_id', objectiveId);

        if (keyResultError) {
          console.warn('⚠️ Warning deleting key results:', keyResultError);
        } else {
          console.log('✅ Deleted key results for department objective');
        }

        // Finally, delete the department objective itself
        const { error } = await supabase
          .from('department_objectives')
          .delete()
          .eq('id', objectiveId);

        if (error) {
          console.error('❌ Error deleting department objective:', error);
          throw error;
        }

        if (import.meta.env?.DEV) {
          console.log('✅ Department objective deleted successfully');
        }
      } catch (error) {
        if (import.meta.env?.DEV) {
          console.error('❌ Error in delete process:', error);
        }
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate all related queries for immediate UI update
      queryClient.invalidateQueries({ queryKey: ['department-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['company-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['individual-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      queryClient.invalidateQueries({ queryKey: ['okr-hierarchy'] });
      // Invalidate objective stats queries for all types
      queryClient.invalidateQueries({ queryKey: ['objective-stats'] });
      toast({
        title: 'Success',
        description: 'Department objective deleted successfully',
      });
    },
    onError: (error) => {
      console.error('❌ Failed to delete department objective:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete department objective',
        variant: 'destructive',
      });
    },
  });
};
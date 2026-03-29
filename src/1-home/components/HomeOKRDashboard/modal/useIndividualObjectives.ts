import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { logger } from '@/shared/lib/logger';
import { filterValidCycleIds } from '@/shared/lib/uuidValidation';
import { globalIndividualObjectivesManager } from './globalIndividualObjectivesManager';

export interface IndividualObjective {
  id: string;
  organization_id: string;
  cycle_id: string;
  department_objective_id?: string;
  employee_id: string;
  title: string;
  description?: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  progress_percentage: number;
  weight: number;
  start_date?: string;
  end_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Relations
  employees?: { full_name: string; email: string };
  department_objectives?: { title: string; description: string };
  okr_cycles?: { name: string; year: number; quarter?: string };
}

interface CreateIndividualObjectiveData {
  organization_id: string;
  cycle_id: string;
  department_objective_id?: string;
  employee_id: string;
  owner_id: string;
  title: string;
  description?: string;
  why_important?: string;
  status?: 'draft' | 'active' | 'completed' | 'cancelled';
  weight?: number;
  start_date?: string;
  end_date?: string;
  created_by: string;
}

export const useIndividualObjectives = (organizationId?: string, cycleIds?: string[]) => {
  const queryClient = useQueryClient();

  // Urutan hook: useQueryClient → useEffect → useQuery (jangan sisipkan useRef di sini — merusak HMR & urutan hook di induk).
  useEffect(() => {
    if (!organizationId) return;
    const unsubscribe = globalIndividualObjectivesManager.subscribe(organizationId, queryClient);
    return () => unsubscribe();
  }, [organizationId, queryClient]);

  return useQuery({
    queryKey: ['individual-objectives', organizationId, cycleIds],
    queryFn: async () => {
      if (!organizationId) {
        logger.debug('❌ No organizationId provided');
        return [];
      }
      
      logger.query('🔍 Fetching individual objectives:', { organizationId, cycleIds });
      
      // OPTIMIZATION: Simplified query to prevent timeout
      // Only select essential fields, reduced joins depth
      // Use left join (no !inner) so objectives are returned even when employee or okr_cycle is missing
      let query = supabase
        .from('individual_objectives')
        .select(`
          id,
          title,
          description,
          status,
          progress_percentage,
          weight,
          start_date,
          end_date,
          cycle_id,
          department_objective_id,
          employee_id,
          organization_id,
          created_at,
          updated_at,
          employees(full_name),
          okr_cycles(name, year, quarter)
        `)
        .eq('organization_id', organizationId)
        .limit(50); // Limit results to prevent timeout

      // Filter by multiple cycle IDs if provided (only valid UUIDs)
      const validCycleIds = filterValidCycleIds(cycleIds);
      if (validCycleIds.length > 0) {
        query = query.in('cycle_id', validCycleIds);
      }

      // Allow query to complete: longer timeout so slow DB/network can finish (no aggressive cutoff)
      const INDIVIDUAL_OBJECTIVES_TIMEOUT_MS = 25000;
      const queryPromise = query.order('created_at', { ascending: false });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Individual objectives query timeout')), INDIVIDUAL_OBJECTIVES_TIMEOUT_MS)
      );

      let data: any;
      let error: any;
      
      try {
        const result = await Promise.race([queryPromise, timeoutPromise]) as any;
        data = result.data;
        error = result.error;
      } catch (timeoutError: any) {
        try {
          logger.rateLimited('indiv-obj-timeout', 60000, () => logger.warn('⚠️ Individual objectives query timed out, using empty array'));
        } catch {
          console.warn('⚠️ Individual objectives query timed out, using empty array');
        }
        return []; // Graceful degradation - return empty array
      }

      if (error) {
        console.error('❌ Error fetching individual objectives:', error);
        // Graceful degradation - return empty array instead of throwing
        return [];
      }

      if (process.env.NODE_ENV === 'development') {
        logger.query('✅ Individual objectives fetched:', data);
      }
      return data || [];
    },
    enabled: !!organizationId,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
};

export const useCreateIndividualObjective = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (objectiveData: CreateIndividualObjectiveData) => {
      logger.debug('🚀 Creating individual objective:', objectiveData);

      const { data, error } = await supabase
        .from('individual_objectives')
        .insert(objectiveData)
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating individual objective:', error);
        throw error;
      }

      logger.debug('✅ Individual objective created successfully:', data);
      return data;
    },
    onSuccess: () => {
      // Invalidate all related queries for immediate UI update
      queryClient.invalidateQueries({ queryKey: ['individual-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['department-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['company-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      queryClient.invalidateQueries({ queryKey: ['okr-hierarchy'] });
      // Invalidate objective stats queries for all types
      queryClient.invalidateQueries({ queryKey: ['objective-stats'] });
      toast({
        title: 'Success',
        description: 'Individual objective created successfully',
      });
    },
    onError: (error) => {
      console.error('❌ Failed to create individual objective:', error);
      toast({
        title: 'Error',
        description: 'Failed to create individual objective',
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateIndividualObjective = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<IndividualObjective> }) => {
      logger.debug('🔄 Updating individual objective:', { id, updates });

      const { data, error } = await supabase
        .from('individual_objectives')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating individual objective:', error);
        throw error;
      }

      logger.debug('✅ Individual objective updated successfully:', data);
      return data;
    },
    onSuccess: () => {
      // Invalidate all related queries for immediate UI update
      queryClient.invalidateQueries({ queryKey: ['individual-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['department-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['company-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      queryClient.invalidateQueries({ queryKey: ['okr-hierarchy'] });
      // Invalidate objective stats queries for all types
      queryClient.invalidateQueries({ queryKey: ['objective-stats'] });
      toast({
        title: 'Success',
        description: 'Individual objective updated successfully',
      });
    },
    onError: (error) => {
      console.error('❌ Failed to update individual objective:', error);
      toast({
        title: 'Error',
        description: 'Failed to update individual objective',
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteIndividualObjective = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (objectiveId: string) => {
      logger.debug('🗑️ Deleting individual objective:', objectiveId);

      try {
        // First, delete related weekly check-ins via key results
        const { data: keyResults } = await supabase
          .from('key_results')
          .select('id')
          .eq('individual_objective_id', objectiveId);

        if (keyResults && keyResults.length > 0) {
          const keyResultIds = keyResults.map(kr => kr.id);
          
          // Delete weekly check-ins for these key results (correct table name: weekly_checkins)
          const { error: checkinError } = await supabase
            .from('weekly_checkins')
            .delete()
            .in('key_result_id', keyResultIds);

          if (checkinError) {
            console.warn('⚠️ Warning deleting weekly check-ins:', checkinError);
          } else {
            logger.debug('✅ Deleted weekly check-ins for key results');
          }

          // Delete activities for these key results (check if column exists)
          const { error: activityError } = await supabase
            .from('activities')
            .delete()
            .in('key_result_id', keyResultIds);

          if (activityError) {
            logger.warn('⚠️ Warning deleting activities by key_result_id:', activityError);
            // Try alternative column names
            const { error: altActivityError } = await supabase
              .from('activities')
              .delete()
              .in('objective_id', keyResultIds);

            if (altActivityError) {
              logger.warn('⚠️ Alternative activity deletion also failed:', altActivityError);
            } else {
              logger.debug('✅ Deleted activities using alternative column');
            }
          } else {
            logger.debug('✅ Deleted activities for key results');
          }

          // Delete the key results themselves
          const { error: keyResultError } = await supabase
            .from('key_results')
            .delete()
            .eq('individual_objective_id', objectiveId);

          if (keyResultError) {
            console.error('❌ Error deleting key results:', keyResultError);
            throw keyResultError;
          } else {
            logger.debug('✅ Deleted key results for individual objective');
          }
        }

        // Delete activities directly linked to the objective
        const { error: directActivityError } = await supabase
          .from('activities')
          .delete()
          .eq('individual_objective_id', objectiveId);

        if (directActivityError) {
          logger.warn('⚠️ Warning deleting direct activities:', directActivityError);
          // Try alternative column names
          const { error: altDirectActivityError } = await supabase
            .from('activities')
            .delete()
            .eq('objective_id', objectiveId);

          if (altDirectActivityError) {
            logger.warn('⚠️ Alternative direct activity deletion also failed:', altDirectActivityError);
          } else {
            logger.debug('✅ Deleted direct activities using alternative column');
          }
        } else {
          logger.debug('✅ Deleted direct activities for individual objective');
        }

        // Finally, delete the individual objective itself
        const { error } = await supabase
          .from('individual_objectives')
          .delete()
          .eq('id', objectiveId);

        if (error) {
          console.error('❌ Error deleting individual objective:', error);
          throw error;
        }

        logger.debug('✅ Individual objective deleted successfully');
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error('❌ Error in delete process:', err);
        throw err;
      }
    },
    onSuccess: () => {
      // Invalidate all related queries for immediate UI update
      queryClient.invalidateQueries({ queryKey: ['individual-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['department-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['company-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      queryClient.invalidateQueries({ queryKey: ['okr-hierarchy'] });
      // Invalidate objective stats queries for all types
      queryClient.invalidateQueries({ queryKey: ['objective-stats'] });
      toast({
        title: 'Success',
        description: 'Individual objective deleted successfully',
      });
    },
    onError: (error) => {
      console.error('❌ Failed to delete individual objective:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete individual objective',
        variant: 'destructive',
      });
    },
  });
};
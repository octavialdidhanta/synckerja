
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { Objective } from '@/types/okr';
import { useMemo } from 'react';
import { filterValidCycleIds } from '@/shared/lib/uuidValidation';

export type FilteredObjectivesQueryOptions = {
  enabled?: boolean;
};

/**
 * Hook for fetching objectives with multiple cycle filtering support
 */
export const useFilteredObjectives = (
  organizationId?: string, 
  cycleIds?: string[], 
  level?: 'company' | 'department' | 'individual',
  options?: FilteredObjectivesQueryOptions,
) => {
  const queryEnabled = options?.enabled ?? true;
  const { data: objectives = [], isLoading, error, refetch } = useQuery({
    queryKey: ['filtered-objectives', organizationId, cycleIds, level],
    queryFn: async () => {
      if (!organizationId) {
        // console.log('❌ No organizationId provided');
        return [];
      }
      
      // console.log('🔍 Fetching filtered objectives:', { organizationId, cycleIds, level });
      
      let query = supabase
        .from('company_objectives')
        .select(`*`)
        .eq('organization_id', organizationId);

      // Filter by multiple cycle IDs if provided (only valid UUIDs)
      const validCycleIds = filterValidCycleIds(cycleIds);
      if (validCycleIds.length > 0) {
        // console.log('🔍 Applying cycle filter:', { validCycleIds });
        query = query.in('cycle_id', validCycleIds);
      } else {
        // console.log('⚠️ No valid cycleIds provided - fetching all objectives');
      }

      // Note: company_objectives table doesn't have level column - all are company level

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching filtered objectives:', error);
        throw error;
      }
      
      if (!data) {
        // console.log('📊 No filtered objectives data returned');
        return [];
      }
      
      // console.log('📊 Raw filtered objectives data from database:', {
      //   count: data.length,
      //   objectives: data.map(obj => ({
      //     id: obj.id,
      //     title: obj.title,
      //     cycle_id: obj.cycle_id,
      //     organization_id: obj.organization_id
      //   }))
      // });

      // Check specifically for the objective the user mentioned
      const targetObjective = data.find(obj => obj.id === '30258d1c-2f08-4c12-86ca-5678adf3630b');
      if (targetObjective) {
        // console.log('🎯 Found target objective:', {
        //   id: targetObjective.id,
        //   title: targetObjective.title,
        //   cycle_id: targetObjective.cycle_id,
        //   organization_id: targetObjective.organization_id
        // });
      } else {
        // console.log('❌ Target objective 30258d1c-2f08-4c12-86ca-5678adf3630b not found in results');
        
        // Let's also check if it exists at all
        const checkQuery = await supabase
          .from('company_objectives')
          .select('*')
          .eq('id', '30258d1c-2f08-4c12-86ca-5678adf3630b');
          
        // console.log('🔍 Direct check for target objective:', checkQuery.data);
      }
      
      // Transform the data to match Objective type exactly
      const transformedData = data.map(obj => {
        const transformedObj = {
          ...obj,
          level: 'company' as const, // All company_objectives are company level
          key_results: [],
          child_objectives: [],
          why_important: obj.why_important || '', // Use actual why_important column
          entity_id: null,
          parent_objective_id: null,
          department_id: null,
          derived_from_kr_id: null,
          parent_objective: null
        } as Objective;

        return transformedObj;
      });
      
      // Filter by level if specified (though company_objectives are all company level)
      const filteredData = level ? (level === 'company' ? transformedData : []) : transformedData;
      
      // console.log('✅ Final filtered objectives result:', {
      //   organizationId,
      //   cycleIds,
      //   level,
      //   count: filteredData.length,
      //   objectives: filteredData.map(obj => ({
      //     id: obj.id,
      //     title: obj.title,
      //     level: obj.level,
      //     cycle_id: obj.cycle_id,
      //     status: obj.status,
      //     owner_id: obj.owner_id,
      //     department_id: obj.department_id,
      //     key_results_count: 0,
      //   }))
      // });
      
      return filteredData;
    },
    enabled: !!organizationId && queryEnabled,
  });

  return {
    objectives,
    isLoading,
    error,
    refetch
  };
};

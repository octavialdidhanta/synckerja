
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';

export interface WeeklyCheckinHistory {
  id: string;
  week_start_date: string;
  current_value: number;
  confidence_level: number;
  status: 'on_track' | 'at_risk' | 'off_track';
  comments?: string;
  blockers?: string;
  created_at: string;
  employee: {
    full_name: string;
  };
}

export const useWeeklyCheckinHistory = (keyResultId: string, organizationId: string) => {
  return useQuery({
    queryKey: ['weekly-checkin-history', keyResultId, organizationId],
    queryFn: async (): Promise<{ history: WeeklyCheckinHistory[], keyResult: any }> => {
      // Get key result details including metric type
      const { data: keyResult, error: keyResultError } = await supabase
        .from('key_results')
        .select('id, title, metric_type, start_value, target_value, unit, current_value')
        .eq('id', keyResultId)
        .single();

      if (keyResultError) {
        console.error('Error fetching key result:', keyResultError);
        throw keyResultError;
      }

      // Get weekly checkins
      const { data, error } = await supabase
        .from('weekly_checkins')
        .select(`
          id,
          week_start_date,
          current_value,
          confidence_level,
          status,
          comments,
          blockers,
          created_at,
          employees!weekly_checkins_employee_id_fkey (
            full_name
          )
        `)
        .eq('key_result_id', keyResultId)
        .eq('organization_id', organizationId)
        .order('week_start_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching weekly checkin history:', error);
        throw error;
      }

      const history = (data || []).map(item => ({
        ...item,
        employee: item.employees || { full_name: 'Unknown Employee' }
      })) as WeeklyCheckinHistory[];

      return { history, keyResult };
    },
    enabled: !!keyResultId && !!organizationId
  });
};

// Hook for objective-based weekly checkin history using new standardized structure
export const useObjectiveWeeklyCheckinHistory = (objectiveId: string, organizationId: string, objectiveType: 'company' | 'department' | 'individual' = 'company') => {
  return useQuery({
    queryKey: ['objective-weekly-checkin-history', objectiveId, organizationId, objectiveType],
    queryFn: async (): Promise<WeeklyCheckinHistory[]> => {
      console.log('🔍 Looking for key results for objective:', { objectiveId, objectiveType });
      
      // Get key results based on objective type using new standardized columns
      let keyResultsQuery = supabase.from('key_results').select('id');
      
      switch (objectiveType) {
        case 'company':
          keyResultsQuery = keyResultsQuery.eq('company_objective_id', objectiveId);
          break;
        case 'department':
          keyResultsQuery = keyResultsQuery.eq('department_objective_id', objectiveId);
          break;
        case 'individual':
          keyResultsQuery = keyResultsQuery.eq('individual_objective_id', objectiveId);
          break;
      }

      const { data: keyResults } = await keyResultsQuery;

      if (!keyResults || keyResults.length === 0) {
        console.log('📊 No direct key results found for objective:', objectiveId);
        
        // For company objectives, try to find key results from child department objectives
        if (objectiveType === 'company') {
          const { data: childKeyResults } = await supabase
            .from('key_results')
            .select(`
              id,
              department_objectives!inner(company_objective_id)
            `)
            .eq('department_objectives.company_objective_id', objectiveId);

          if (childKeyResults && childKeyResults.length > 0) {
            console.log('📊 Found key results from child department objectives');
            const allCheckins = await Promise.all(
              childKeyResults.map(kr => getCheckinsForKeyResult(kr.id, organizationId))
            );
            const flatCheckins = allCheckins.flat();
            return { history: flatCheckins, keyResult: null }; // Return proper structure
          }
        }
        
        // For department objectives, try to find key results from child individual objectives
        if (objectiveType === 'department') {
          const { data: childKeyResults } = await supabase
            .from('key_results')
            .select(`
              id,
              individual_objectives!inner(department_objective_id)
            `)
            .eq('individual_objectives.department_objective_id', objectiveId);

          if (childKeyResults && childKeyResults.length > 0) {
            console.log('📊 Found key results from child individual objectives');
            const allCheckins = await Promise.all(
              childKeyResults.map(kr => getCheckinsForKeyResult(kr.id, organizationId))
            );
            const flatCheckins = allCheckins.flat();
            
            // Get the first key result's details for metric type info
            const firstKeyResult = childKeyResults[0];
            const { data: keyResultDetails } = await supabase
              .from('key_results')
              .select('id, title, metric_type, start_value, target_value, unit, current_value')
              .eq('id', firstKeyResult.id)
              .single();
            
            return { history: flatCheckins, keyResult: keyResultDetails };
          }
        }
        
        return { history: [], keyResult: null };
      }

      // Get weekly checkins for all key results
      const allCheckins = await Promise.all(
        keyResults.map(kr => getCheckinsForKeyResult(kr.id, organizationId))
      );
      const flatCheckins = allCheckins.flat().sort((a, b) => 
        new Date(b.week_start_date).getTime() - new Date(a.week_start_date).getTime()
      );
      
      // Get the first key result's details for metric type info
      const firstKeyResult = keyResults[0];
      const { data: keyResultDetails } = await supabase
        .from('key_results')
        .select('id, title, metric_type, start_value, target_value, unit, current_value')
        .eq('id', firstKeyResult.id)
        .single();
      
      return { history: flatCheckins, keyResult: keyResultDetails };
    },
    enabled: !!objectiveId && !!organizationId
  });
};

// Helper function to get checkins for a specific key result
async function getCheckinsForKeyResult(keyResultId: string, organizationId: string): Promise<WeeklyCheckinHistory[]> {
  const { data, error } = await supabase
    .from('weekly_checkins')
    .select(`
      id,
      week_start_date,
      current_value,
      confidence_level,
      status,
      comments,
      blockers,
      created_at,
      employees!weekly_checkins_employee_id_fkey (
        full_name
      )
    `)
    .eq('key_result_id', keyResultId)
    .eq('organization_id', organizationId)
    .order('week_start_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching weekly checkin history:', error);
    throw error;
  }

  return (data || []).map(item => ({
    ...item,
    employee: item.employees || { full_name: 'Unknown Employee' }
  })) as WeeklyCheckinHistory[];
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';

// Hook to ensure department objectives also appear as key results in company objective
export const useDepartmentAsKeyResult = (organizationId: string, companyObjectiveId: string, departmentObjectives: any[]) => {
  return useQuery({
    queryKey: ['department-as-key-results', organizationId, companyObjectiveId, departmentObjectives.length],
    queryFn: async () => {
      console.log('🔍 Syncing department objectives as key results...');

      // Get existing key results for the company objective
      const { data: existingKRs, error: krError } = await supabase
        .from('key_results')
        .select('*')
        .eq('company_objective_id', companyObjectiveId);

      if (krError) {
        console.error('❌ Error fetching existing key results:', krError);
        throw krError;
      }

      // For each department objective, ensure it exists as a key result
      const newKRs = [];
      for (const deptObj of departmentObjectives) {
        // Check if this department objective already exists as a key result
        const existingKR = existingKRs?.find(kr => 
          kr.title === deptObj.title && kr.department_objective_id === deptObj.id
        );

        if (!existingKR) {
          // Create a new key result for this department objective
          const newKR = {
            organization_id: organizationId,
            company_objective_id: companyObjectiveId,
            department_objective_id: deptObj.id,
            title: deptObj.title,
            description: deptObj.description || `Department objective: ${deptObj.title}`,
            metric_type: 'percentage' as const,
            calculation_type: 'increase' as const,
            start_value: 0,
            target_value: 100,
            current_value: deptObj.progress_percentage || 0,
            unit: '%',
            weight: deptObj.weight || 100,
            progress_percentage: deptObj.progress_percentage || 0,
            is_inverse: false,
            owner_level: 'department' as const,
            created_by: deptObj.created_by,
            department_id: deptObj.department_id,
          };

          const { data: createdKR, error: createError } = await supabase
            .from('key_results')
            .insert(newKR)
            .select()
            .single();

          if (createError) {
            console.error('❌ Error creating key result for department objective:', createError);
          } else {
            console.log('✅ Created key result for department objective:', createdKR);
            newKRs.push(createdKR);
          }
        }
      }

      // Return the newly created key results
      return newKRs;
    },
    enabled: !!organizationId && !!companyObjectiveId && departmentObjectives.length > 0,
  });
};
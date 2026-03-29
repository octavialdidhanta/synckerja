import { supabase } from '@/shared/lib/supabaseClient';
import { RecentStepUpdate } from '../types/taskTypes';

/**
 * Fetch recent step updates for an organization
 */
export const fetchRecentStepUpdates = async (
  organizationId: string
): Promise<RecentStepUpdate[]> => {
  try {
    const { data, error } = await supabase
      .from('task_steps')
      .select(`
        id,
        task_id,
        title,
        is_completed,
        updated_at,
        daily_tasks!inner(title)
      `)
      .eq('daily_tasks.organization_id', organizationId)
      .order('updated_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    const recentUpdates: RecentStepUpdate[] = (data || []).map((step: any) => ({
      id: step.id,
      task_id: step.task_id,
      step_id: step.id, // Use step id as step_id
      step_title: step.title,
      task_title: step.daily_tasks.title,
      is_completed: step.is_completed,
      updated_at: step.updated_at,
      action: step.is_completed ? 'completed' : 'updated',
    }));

    return recentUpdates;
  } catch (error) {
    console.error('Error fetching recent step updates:', error);
    throw error;
  }
};


import { useQuery } from '@tanstack/react-query';
import { fetchMentionableEmployees } from '../services/taskStepCommentService';
import type { MentionableEmployee } from '../types';

export function useMentionableEmployees(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['task-step-comment-mention-employees', organizationId],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<MentionableEmployee[]> => {
      if (!organizationId) return [];
      return fetchMentionableEmployees(organizationId);
    },
    staleTime: 5 * 60 * 1000,
  });
}

import { supabase } from '@/shared/lib/supabaseClient';
import type { MentionableEmployee, TaskStepComment, TaskStepCommentReactionEmoji } from '../types';

type RawComment = TaskStepComment & {
  task_step_comment_reactions?: TaskStepComment['reactions'];
};

async function enrichAuthors(
  comments: RawComment[],
  organizationId: string,
): Promise<TaskStepComment[]> {
  const profileIds = [...new Set(comments.map((c) => c.profile_id).filter(Boolean))];
  if (profileIds.length === 0) {
    return comments.map((c) => ({
      ...c,
      reactions: c.task_step_comment_reactions ?? c.reactions ?? [],
    }));
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, user_id, email')
    .in('id', profileIds);

  const userIds = (profiles ?? []).map((p) => p.user_id).filter(Boolean) as string[];
  const profileToUser = new Map((profiles ?? []).map((p) => [p.id, p.user_id]));
  const profileEmail = new Map((profiles ?? []).map((p) => [p.id, p.email]));

  let employeeByUserId = new Map<string, { full_name: string; email: string | null }>();
  if (userIds.length > 0) {
    const { data: employees } = await supabase
      .from('employees')
      .select('user_id, full_name, email')
      .eq('organization_id', organizationId)
      .in('user_id', userIds);
    employeeByUserId = new Map(
      (employees ?? []).map((e) => [e.user_id as string, { full_name: e.full_name as string, email: e.email as string | null }]),
    );
  }

  return comments.map((c) => {
    const userId = profileToUser.get(c.profile_id);
    const emp = userId ? employeeByUserId.get(userId) : undefined;
    return {
      ...c,
      reactions: c.task_step_comment_reactions ?? c.reactions ?? [],
      author_name: emp?.full_name ?? profileEmail.get(c.profile_id) ?? 'User',
      author_email: emp?.email ?? profileEmail.get(c.profile_id) ?? null,
    };
  });
}

export async function fetchTaskStepComments(
  organizationId: string,
  taskStepId: string,
): Promise<TaskStepComment[]> {
  const { data, error } = await supabase
    .from('task_step_comments')
    .select('*, task_step_comment_reactions(*)')
    .eq('organization_id', organizationId)
    .eq('task_step_id', taskStepId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return enrichAuthors((data ?? []) as RawComment[], organizationId);
}

export async function fetchMentionableEmployees(organizationId: string): Promise<MentionableEmployee[]> {
  const { data: employees, error } = await supabase
    .from('employees')
    .select('user_id, full_name, email')
    .eq('organization_id', organizationId)
    .order('full_name', { ascending: true });

  if (error) throw error;
  const userIds = (employees ?? []).map((e) => e.user_id).filter(Boolean) as string[];
  if (userIds.length === 0) return [];

  const { data: profiles } = await supabase.from('profiles').select('id, user_id').in('user_id', userIds);
  const profileByUser = new Map((profiles ?? []).map((p) => [p.user_id, p.id]));

  return (employees ?? [])
    .map((e) => {
      const profileId = profileByUser.get(e.user_id as string);
      if (!profileId) return null;
      return {
        profileId,
        fullName: (e.full_name as string) || (e.email as string) || 'User',
        email: (e.email as string | null) ?? null,
      };
    })
    .filter((x): x is MentionableEmployee => x !== null);
}

export async function fetchCurrentProfileId(): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.id) return null;
  const { data } = await supabase.from('profiles').select('id').eq('user_id', auth.user.id).maybeSingle();
  return data?.id ?? null;
}

export async function insertTaskStepComment(params: {
  organizationId: string;
  taskStepId: string;
  profileId: string;
  body: string;
  mentionedProfileIds: string[];
  parentId?: string | null;
}): Promise<TaskStepComment> {
  const { data, error } = await supabase
    .from('task_step_comments')
    .insert({
      organization_id: params.organizationId,
      task_step_id: params.taskStepId,
      profile_id: params.profileId,
      body: params.body.trim(),
      mentioned_profile_ids: params.mentionedProfileIds,
      parent_id: params.parentId ?? null,
    })
    .select('*, task_step_comment_reactions(*)')
    .single();

  if (error) throw error;
  const enriched = await enrichAuthors([data as RawComment], params.organizationId);
  return enriched[0];
}

export async function updateTaskStepCommentBody(commentId: string, body: string, mentionedProfileIds: string[]): Promise<void> {
  const { error } = await supabase
    .from('task_step_comments')
    .update({
      body: body.trim(),
      mentioned_profile_ids: mentionedProfileIds,
    })
    .eq('id', commentId);
  if (error) throw error;
}

export async function softDeleteTaskStepComment(commentId: string): Promise<void> {
  const { error } = await supabase
    .from('task_step_comments')
    .update({ is_deleted: true, body: '' })
    .eq('id', commentId);
  if (error) throw error;
}

export async function upsertTaskStepCommentReaction(
  commentId: string,
  profileId: string,
  emoji: TaskStepCommentReactionEmoji,
): Promise<void> {
  const { error } = await supabase.from('task_step_comment_reactions').upsert(
    { comment_id: commentId, profile_id: profileId, emoji },
    { onConflict: 'comment_id,profile_id' },
  );
  if (error) throw error;
}

export async function removeTaskStepCommentReaction(commentId: string, profileId: string): Promise<void> {
  const { error } = await supabase
    .from('task_step_comment_reactions')
    .delete()
    .eq('comment_id', commentId)
    .eq('profile_id', profileId);
  if (error) throw error;
}

export async function markTaskStepCommentsRead(taskStepId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_task_step_comments_read', {
    p_task_step_id: taskStepId,
  });
  if (error) throw error;
}

export async function fetchTaskStepCommentUnreadCount(taskStepId: string): Promise<number> {
  const { data, error } = await supabase.rpc('task_step_comment_unread_count', {
    p_task_step_id: taskStepId,
  });
  if (error) throw error;
  return typeof data === 'number' ? data : Number(data ?? 0);
}

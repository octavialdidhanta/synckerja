export type TaskStepCommentReactionEmoji = 'like' | 'heart' | 'laugh' | 'celebrate' | 'question';

export interface TaskStepCommentReaction {
  id: string;
  comment_id: string;
  profile_id: string;
  emoji: TaskStepCommentReactionEmoji;
  created_at: string;
}

export interface TaskStepComment {
  id: string;
  organization_id: string;
  task_step_id: string;
  parent_id: string | null;
  profile_id: string;
  body: string;
  mentioned_profile_ids: string[];
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  reactions?: TaskStepCommentReaction[];
  author_name?: string;
  author_email?: string;
}

export interface MentionableEmployee {
  profileId: string;
  fullName: string;
  email: string | null;
}

export interface StepCommentWriteContext {
  taskCreatedBy?: string;
  /** Task assignee employee id */
  taskAssignedTo?: string | null;
  /** Step assignee employee id */
  stepAssignedTo?: string | null;
  hasCommented?: boolean;
  currentUserId?: string;
  currentEmployeeId?: string;
}

import type { OptimisticCommentReply } from "@/6-0-social-media-manage-comments/types/manageCommentsOptimisticTypes";

export type ManageCommentsReplyControls = {
  replyToCommentId: string | null;
  onReply: (commentId: string, mentionLabel?: string) => void;
  onCancelReply: () => void;
  onSubmitReply: (parentCommentId: string, text: string, mentionLabel: string) => Promise<void>;
  accountLabel: string;
  accountAvatarUrl?: string | null;
  isSubmittingReply: boolean;
  getOptimisticForParent: (parentCommentId: string) => OptimisticCommentReply[];
  pruneOptimisticForParent: (parentCommentId: string, serverTexts: string[]) => void;
};

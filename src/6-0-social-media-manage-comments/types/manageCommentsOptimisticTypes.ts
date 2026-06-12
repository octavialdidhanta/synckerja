export type OptimisticCommentReply = {
  tempId: string;
  parentCommentId: string;
  text: string;
  accountLabel: string;
  accountAvatarUrl?: string | null;
  mentionLabel: string;
  status: "posting" | "failed";
  createdAt: number;
};

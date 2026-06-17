export type YouTubeCommentRow = {
  id: string;
  video_id: string;
  text: string;
  display_name: string;
  avatar_url: string | null;
  like_count: number;
  reply_count: number;
  parent_comment_id: string | null;
  create_time: number | null;
  published_at: string | null;
  is_channel_owner: boolean;
  thread_id?: string | null;
  reply_parent_id?: string | null;
  can_reply?: boolean;
};

export type YouTubeCommentsListResponse = {
  comments: YouTubeCommentRow[];
  channel_id?: string;
  account_label?: string | null;
};

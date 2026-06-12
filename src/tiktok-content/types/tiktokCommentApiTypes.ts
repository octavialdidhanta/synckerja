export type TikTokCommentUser = {
  id?: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
};

export type TikTokCommentRow = {
  id: string;
  video_id?: string;
  text: string;
  like_count: number;
  reply_count: number;
  parent_comment_id?: string | null;
  create_time: number | null;
  user?: TikTokCommentUser;
  display_name?: string;
};

export type TikTokCommentsListResponse = {
  comments: TikTokCommentRow[];
  cursor: number | null;
  has_more: boolean;
};

export type TikTokCommentActionResponse = {
  ok: boolean;
  comment_id?: string;
};

export type TikTokConversationParticipant = {
  im_user_id?: string;
  avatar?: string;
  user_id?: string;
  role?: string;
  nickname?: string;
  buyer_platform?: string;
};

export type TikTokConversationMessage = {
  id?: string;
  type?: string;
  content?: string;
  create_time?: number;
  is_visible?: boolean;
  sender?: {
    im_user_id?: string;
    avatar?: string;
    role?: string;
    nickname?: string;
  };
  index?: string;
  data?: string;
  plaintext?: string;
};

export type TikTokConversation = {
  id: string;
  participant_count?: number;
  can_send_message?: boolean;
  unread_count?: number;
  create_time?: number;
  participants?: TikTokConversationParticipant[];
  latest_message?: TikTokConversationMessage;
  cur_session_id?: string;
};

export type TikTokConversationsPage = {
  next_page_token: string;
  conversations: TikTokConversation[];
  account?: {
    id: string;
    shop_id: string;
    shop_name: string | null;
  };
  request_id?: string | null;
};

export type TikTokMessagesPage = {
  next_page_token: string;
  unsupported_msg_tips?: string;
  messages: TikTokConversationMessage[];
  account?: {
    id: string;
    shop_id: string;
    shop_name: string | null;
  };
  request_id?: string | null;
};

export function getBuyerParticipant(
  conversation: TikTokConversation,
): TikTokConversationParticipant | null {
  const buyer = conversation.participants?.find((p) => p.role === 'BUYER');
  return buyer ?? conversation.participants?.[0] ?? null;
}

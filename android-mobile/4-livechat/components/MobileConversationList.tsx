import React from 'react';
import { ConversationList, type WhatsAppAccountForHint } from '@/5-3-whatsapp/components/inbox/ConversationList';
import type { LiveChatConversation } from '@/5-3-whatsapp/types';

interface MobileConversationListProps {
  conversations: LiveChatConversation[];
  selectedId: string | null;
  onSelect: (conv: LiveChatConversation) => void;
  initialConversationId?: string | null;
  initialTicketId?: string | null;
  searchQuery?: string;
  accountFilter?: string;
  waAccountsForHint?: WhatsAppAccountForHint[];
  isLoading?: boolean;
  error?: Error | null;
  /** When gesture locks to card swipe, parent should disable pull-to-refresh. */
  onSwipeLockChange?: (locked: boolean) => void;
}

export function MobileConversationList(props: MobileConversationListProps) {
  const { onSwipeLockChange, ...rest } = props;
  return (
    <div className="min-h-0">
      <ConversationList {...rest} onSwipeLockChange={onSwipeLockChange} />
    </div>
  );
}

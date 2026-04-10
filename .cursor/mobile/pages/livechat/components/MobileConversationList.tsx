import React from 'react';
import { ConversationList, type WhatsAppAccountForHint } from '@/features/5-3-whatsapp/components/inbox/ConversationList';
import type { LiveChatConversation } from '@/features/5-3-whatsapp/types';
import { ConversationListSkeleton } from './ConversationListSkeleton';

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
  /** When true (pull-to-refresh), do not show skeleton so content stays visible (anti-flicker). */
  isRefreshing?: boolean;
  error?: Error | null;
  /** When gesture locks to card swipe, parent should disable pull-to-refresh. */
  onSwipeLockChange?: (locked: boolean) => void;
}

export function MobileConversationList(props: MobileConversationListProps) {
  const { isRefreshing = false, onSwipeLockChange, ...rest } = props;
  const showSkeleton = rest.isLoading && !isRefreshing;
  if (showSkeleton) {
    return (
      <div className="min-h-0">
        <ConversationListSkeleton />
      </div>
    );
  }
  return (
    <div className="min-h-0">
      <ConversationList {...rest} onSwipeLockChange={onSwipeLockChange} />
    </div>
  );
}

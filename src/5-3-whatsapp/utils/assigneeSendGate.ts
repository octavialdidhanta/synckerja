/**
 * Livechat outbound / quick action: only the active conversation assignee (no Owner/Admin override).
 */

type AssigneeQueryClient = {
  getQueryData: <T>(queryKey: readonly unknown[]) => T | undefined;
};

export function readConversationAssigneeIdFromQueryCache(
  queryClient: AssigneeQueryClient,
  conversation: { id: string; source?: string } | null | undefined,
): string | null {
  if (!conversation?.id) return null;
  const key =
    conversation.source === 'email'
      ? (['email-conversation-status', conversation.id] as const)
      : conversation.source === 'instagram'
        ? (['instagram-conversation-status', conversation.id] as const)
        : conversation.source === 'facebook'
          ? (['facebook-conversation-status', conversation.id] as const)
          : (['whatsapp-conversation-status', conversation.id] as const);
  const row = queryClient.getQueryData<{ assignee_id?: string | null }>(key);
  const id = row?.assignee_id;
  return id == null || String(id).trim() === '' ? null : String(id);
}

export function canSendAsActiveAssignee(
  conversationAssigneeId: string | null | undefined,
  currentEmployeeId: string | null | undefined,
): boolean {
  if (!conversationAssigneeId || !currentEmployeeId) return false;
  return String(conversationAssigneeId) === String(currentEmployeeId);
}

export function isConversationUnassigned(
  conversationAssigneeId: string | null | undefined,
): boolean {
  return conversationAssigneeId == null || String(conversationAssigneeId).trim() === '';
}

export function isAssignedToOtherAgent(
  conversationAssigneeId: string | null | undefined,
  currentEmployeeId: string | null | undefined,
): boolean {
  if (isConversationUnassigned(conversationAssigneeId)) return false;
  if (!currentEmployeeId) return true;
  return String(conversationAssigneeId) !== String(currentEmployeeId);
}

/** True when quick action / resolve / status change is allowed for the logged-in employee. */
export function canUseOmnichannelQuickAction(
  conversationAssigneeId: string | null | undefined,
  currentEmployeeId: string | null | undefined,
): boolean {
  return canSendAsActiveAssignee(conversationAssigneeId, currentEmployeeId);
}

export type AssigneeActionBlockReason = 'unassigned' | 'not_assignee';

export function getAssigneeActionBlockReason(
  conversationAssigneeId: string | null | undefined,
  currentEmployeeId: string | null | undefined,
): AssigneeActionBlockReason | null {
  if (canSendAsActiveAssignee(conversationAssigneeId, currentEmployeeId)) return null;
  if (isConversationUnassigned(conversationAssigneeId)) return 'unassigned';
  return 'not_assignee';
}

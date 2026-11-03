import type { SupabaseClient } from "@supabase/supabase-js";
import type { McpAuthContext } from "../authz/context";
import type {
  InboxConversationRow,
  InboxConversationsQuery,
  InboxMessageRow,
  InboxMessagesQuery,
  InboxSummaryQuery,
  InboxSummaryRow,
} from "../tools/inbox/inboxQuery";
import { inboxEmployeeScope } from "../tools/inbox/inboxQuery";

function rpcError(message: string): Error {
  if (message.includes("not_a_member")) return new Error("forbidden");
  if (message.includes("not_found")) return new Error("not_found");
  if (message.includes("invalid_input")) return new Error("invalid_input");
  return new Error("query_failed");
}

async function callRpc<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw rpcError(error.message ?? "");
  return (Array.isArray(data) ? data : []) as T[];
}

export async function listInboxConversations(
  admin: SupabaseClient,
  ctx: McpAuthContext,
  query: InboxConversationsQuery,
): Promise<InboxConversationRow[]> {
  return callRpc<InboxConversationRow>(admin, "mcp_inbox_conversations", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_employee_id: inboxEmployeeScope(ctx),
    p_channel: query.channel,
    p_start: query.dateStart,
    p_end: query.dateEnd,
    p_awaiting_only: query.awaitingOnly,
    p_limit: query.limit,
  });
}

export async function listInboxMessages(
  admin: SupabaseClient,
  ctx: McpAuthContext,
  query: InboxMessagesQuery,
): Promise<InboxMessageRow[]> {
  return callRpc<InboxMessageRow>(admin, "mcp_inbox_messages", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_employee_id: inboxEmployeeScope(ctx),
    p_channel: query.channel,
    p_conversation_id: query.conversationId,
    p_limit: query.limit,
  });
}

export async function readInboxSummary(
  admin: SupabaseClient,
  ctx: McpAuthContext,
  query: InboxSummaryQuery,
): Promise<InboxSummaryRow[]> {
  return callRpc<InboxSummaryRow>(admin, "mcp_inbox_summary", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_employee_id: inboxEmployeeScope(ctx),
    p_channel: query.channel,
    p_start: query.dateStart,
    p_end: query.dateEnd,
  });
}

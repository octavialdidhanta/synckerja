import { supabase } from "@/shared/lib/supabaseClient";

export type AssignPayFirstTableArgs = {
  sessionId: string;
  posTableId: string;
  groupId: string;
  tableName: string;
};

export type AssignPayFirstPatches = {
  session: {
    pos_table_id: string;
    group_id: string;
    table_name: string;
  };
  tickets: {
    pos_table_id: string;
    table_name: string;
  };
};

export function planAssignPayFirstPatches(args: {
  posTableId: string;
  groupId: string;
  tableName: string;
}): AssignPayFirstPatches {
  const tableName = args.tableName.trim() || "Walk-in";
  return {
    session: {
      pos_table_id: args.posTableId,
      group_id: args.groupId,
      table_name: tableName,
    },
    tickets: {
      pos_table_id: args.posTableId,
      table_name: tableName,
    },
  };
}

/**
 * Bind a pay-first dine-in session to a table. Session stays OPEN.
 * Patches KDS ticket table labels so the board shows the seated table.
 */
export async function assignPayFirstTable(
  args: AssignPayFirstTableArgs,
): Promise<void> {
  const patches = planAssignPayFirstPatches(args);

  const { error: sessionError } = await supabase
    .from("pos_table_sessions")
    .update(patches.session)
    .eq("id", args.sessionId)
    .eq("status", "open");
  if (sessionError) throw sessionError;

  const { error: ticketError } = await supabase
    .from("pos_kitchen_tickets")
    .update(patches.tickets)
    .eq("session_id", args.sessionId);
  if (ticketError) throw ticketError;
}

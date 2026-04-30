export type ClickTargetRow = {
  clicks: number;
  unique_sessions: number;
  track_key: string | null;
  element_type: string;
  element_label: string;
  target_url: string | null;
  is_internal: boolean;
};

/** Supabase RPC may return jsonb as array or JSON string depending on client/PostgREST. */
export function normalizeClickTargetRows(data: unknown): ClickTargetRow[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data as ClickTargetRow[];
  if (typeof data === "string") {
    try {
      const p = JSON.parse(data) as unknown;
      return Array.isArray(p) ? (p as ClickTargetRow[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { readAll } from "../shared/catalogQuery";

/** The five Gaya baku boxes, in katalog.html order. */
export const STYLE_BOXES: Array<{ key: string; label: string }> = [
  { key: "vo", label: "Gaya VO / naskah" },
  { key: "editing", label: "Gaya editing" },
  { key: "teks", label: "Gaya teks & motion graphic" },
  { key: "musik", label: "Gaya musik & audio" },
  { key: "talent", label: "Gaya talent & ekspresi" },
];

interface StyleRow {
  id: string;
  field_key: string;
  body: string;
  position: number;
  updated_at: string;
}

const styleKey = (org: string | null | undefined) => ["content-studio", "style", org] as const;

// catalog_style_fields is newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseClient = any;

export function useStyleData() {
  const { organizationId } = useOrgBootstrapPending();
  return useQuery<StyleRow[]>({
    queryKey: styleKey(organizationId),
    enabled: Boolean(organizationId),
    staleTime: 60 * 1000,
    queryFn: () =>
      readAll<StyleRow>(supabase, "catalog_style_fields", "id,field_key,body,position,updated_at", organizationId as string),
  });
}

/**
 * Saves one style box. The update only lands while updated_at still matches,
 * so a change Claude made through MCP is never overwritten.
 */
export function useStyleSave() {
  const qc = useQueryClient();
  const { organizationId } = useOrgBootstrapPending();
  const [saving, setSaving] = useState(false);

  const save = async (fieldKey: string, body: string): Promise<"saved" | "changed_elsewhere"> => {
    const org = organizationId as string;
    const key = styleKey(org);
    const rows = qc.getQueryData<StyleRow[]>(key) ?? [];
    const cur = rows.find((r) => r.field_key === fieldKey);
    const db = supabase as LooseClient;
    setSaving(true);
    try {
      const q = cur
        ? db
            .from("catalog_style_fields")
            .update({ body })
            .eq("organization_id", org)
            .eq("field_key", fieldKey)
            .eq("updated_at", cur.updated_at)
        : db.from("catalog_style_fields").insert({
            organization_id: org,
            field_key: fieldKey,
            body,
            position: rows.reduce((m, r) => Math.max(m, r.position + 1), 0),
          });
      const { data, error } = await q.select("id,field_key,body,position,updated_at");
      if (error) throw error;
      const row = (data ?? [])[0] as StyleRow | undefined;
      if (!row) {
        await qc.invalidateQueries({ queryKey: key });
        return "changed_elsewhere";
      }
      qc.setQueryData<StyleRow[]>(key, (old) => [...(old ?? []).filter((r) => r.field_key !== fieldKey), row]);
      void qc.invalidateQueries({ queryKey: historyKey(org) });
      return "saved";
    } finally {
      setSaving(false);
    }
  };

  return { save, saving };
}

export interface StyleVersion {
  id: string;
  field_key: string;
  body: string;
  replaced_at: string;
}

const historyKey = (org: string | null | undefined) => ["content-studio", "style-history", org] as const;

/** Older versions of every style box, newest first (catalog_style_history, written by trigger). */
export function useStyleHistory() {
  const { organizationId } = useOrgBootstrapPending();
  return useQuery<StyleVersion[]>({
    queryKey: historyKey(organizationId),
    enabled: Boolean(organizationId),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const rows = await readAll<StyleVersion>(
        supabase,
        "catalog_style_history",
        "id,field_key,body,replaced_at",
        organizationId as string,
      );
      return rows.sort((a, b) => b.replaced_at.localeCompare(a.replaced_at));
    },
  });
}

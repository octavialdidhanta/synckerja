import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { isMissingRelationError, readAll, readAllOptional } from "../shared/catalogQuery";
import type { CatalogSettings, IndustryTemplate, MenuFieldDef, SceneKindDef, TagDef } from "./catalogSettingsData";

export function catalogSettingsKey(orgId: string | null | undefined) {
  return ["content-studio", "catalog-settings", orgId] as const;
}

export class CatalogMigrationPendingError extends Error {
  constructor() {
    super("catalog_migration_pending");
    this.name = "CatalogMigrationPendingError";
  }
}

export function useCatalogSettings() {
  const { organizationId } = useOrgBootstrapPending();
  return useQuery<CatalogSettings>({
    queryKey: catalogSettingsKey(organizationId),
    enabled: Boolean(organizationId),
    staleTime: 60_000,
    queryFn: async () => {
      const org = organizationId as string;
      const [settingsRows, templates, menu_field_defs, tag_defs, scene_kind_defs] = await Promise.all([
        supabase
          .from("organization_catalog_settings")
          .select("industry_template_code,applied_at")
          .eq("organization_id", org)
          .maybeSingle(),
        supabase
          .from("catalog_industry_templates")
          .select("code,label,description,position")
          .order("position"),
        readAllOptional<MenuFieldDef>(supabase, "catalog_menu_field_defs", "id,field_key,label,position", org),
        readAll<TagDef>(supabase, "footage_tag_defs", "id,key,label,applies_to,value_type,position", org),
        readAllOptional<SceneKindDef>(supabase, "footage_scene_kind_defs", "id,key,label,position", org),
      ]);
      if (settingsRows.error && isMissingRelationError(settingsRows.error)) {
        throw new CatalogMigrationPendingError();
      }
      if (templates.error && isMissingRelationError(templates.error)) {
        throw new CatalogMigrationPendingError();
      }
      if (settingsRows.error) throw settingsRows.error;
      if (templates.error) throw templates.error;
      return {
        industry_template_code: settingsRows.data?.industry_template_code ?? null,
        applied_at: settingsRows.data?.applied_at ?? null,
        templates: (templates.data ?? []) as IndustryTemplate[],
        menu_field_defs: menu_field_defs.sort((a, b) => a.position - b.position),
        tag_defs: tag_defs.sort((a, b) => a.position - b.position),
        scene_kind_defs: scene_kind_defs.sort((a, b) => a.position - b.position),
      };
    },
  });
}

function invalidateCatalog(qc: ReturnType<typeof useQueryClient>, orgId: string | null | undefined) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: catalogSettingsKey(orgId) }),
    qc.invalidateQueries({ queryKey: ["content-studio"] }),
  ]);
}

/**
 * Keys that belong to some industry pack but not the pack being applied.
 * A key the organization added by hand (absent from every pack) is kept.
 */
export function industryKeysToDrop(orgKeys: string[], packKeys: string[], incomingKeys: string[]): string[] {
  const incoming = new Set(incomingKeys);
  const pack = new Set(packKeys);
  return orgKeys.filter((key) => pack.has(key) && !incoming.has(key));
}

/** A real industry change drops every product column sentence. Applying the same template keeps them. */
export function industrySwitchClearsProductText(previous: string | null, next: string): boolean {
  return previous !== null && previous !== next;
}

/** Apply a template via RLS upserts (MCP apply RPC is service_role-only). */
export function useApplyIndustryTemplate() {
  const { organizationId } = useOrgBootstrapPending();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const org = organizationId as string;
      const [
        { data: fields, error: fErr },
        { data: tags, error: tErr },
        { data: kinds, error: kErr },
        { data: allFields, error: afErr },
        { data: allTags, error: atErr },
        { data: orgFields, error: ofErr },
        { data: orgTags, error: otErr },
      ] = await Promise.all([
        supabase
          .from("catalog_industry_template_menu_fields")
          .select("field_key,label,position")
          .eq("template_code", code),
        supabase
          .from("catalog_industry_template_tags")
          .select("key,label,applies_to,value_type,position")
          .eq("template_code", code),
        supabase
          .from("catalog_industry_template_scene_kinds")
          .select("key,label,position")
          .eq("template_code", code),
        supabase.from("catalog_industry_template_menu_fields").select("field_key"),
        supabase.from("catalog_industry_template_tags").select("key"),
        supabase.from("catalog_menu_field_defs").select("field_key").eq("organization_id", org),
        supabase.from("footage_tag_defs").select("key").eq("organization_id", org),
      ]);
      const { data: currentRow, error: currentErr } = await supabase
        .from("organization_catalog_settings")
        .select("industry_template_code")
        .eq("organization_id", org)
        .maybeSingle();
      if (fErr || tErr || kErr || afErr || atErr || ofErr || otErr || currentErr) {
        throw fErr || tErr || kErr || afErr || atErr || ofErr || otErr || currentErr;
      }
      const clearProductText = industrySwitchClearsProductText(currentRow?.industry_template_code ?? null, code);
      const fieldUpserts = (fields ?? []).map((f) => ({
        organization_id: org,
        field_key: f.field_key,
        label: f.label,
        position: f.position,
      }));
      const tagUpserts = (tags ?? []).map((t) => ({
        organization_id: org,
        key: t.key,
        label: t.label,
        applies_to: t.applies_to,
        value_type: t.value_type,
        position: t.position,
      }));
      const kindUpserts = (kinds ?? []).map((k) => ({
        organization_id: org,
        key: k.key,
        label: k.label,
        position: k.position,
      }));
      const [u1, u2, u3] = await Promise.all([
        supabase.from("catalog_menu_field_defs").upsert(fieldUpserts, { onConflict: "organization_id,field_key" }),
        supabase.from("footage_tag_defs").upsert(tagUpserts, { onConflict: "organization_id,key" }),
        supabase.from("footage_scene_kind_defs").upsert(kindUpserts, { onConflict: "organization_id,key" }),
      ]);
      if (u1.error || u2.error || u3.error) throw u1.error || u2.error || u3.error;

      const dropFields = industryKeysToDrop(
        (orgFields ?? []).map((row) => row.field_key),
        (allFields ?? []).map((row) => row.field_key),
        (fields ?? []).map((row) => row.field_key),
      );
      const dropTags = industryKeysToDrop(
        (orgTags ?? []).map((row) => row.key),
        (allTags ?? []).map((row) => row.key),
        (tags ?? []).map((row) => row.key),
      );
      const [d1, d2] = await Promise.all([
        dropFields.length
          ? supabase.from("catalog_menu_field_defs").delete().eq("organization_id", org).in("field_key", dropFields)
          : Promise.resolve({ error: null }),
        dropTags.length
          ? supabase.from("footage_tag_defs").delete().eq("organization_id", org).in("key", dropTags)
          : Promise.resolve({ error: null }),
      ]);
      if (d1.error || d2.error) throw d1.error || d2.error;
      if (clearProductText) {
        const [cleared, pilot] = await Promise.all([
          supabase.from("catalog_menu_fields").delete().eq("organization_id", org),
          supabase.from("catalog_menus").delete().eq("organization_id", org).eq("external_id", "powerbank-20000"),
        ]);
        if (cleared.error || pilot.error) throw cleared.error || pilot.error;
      }
      const saved = await supabase.from("organization_catalog_settings").upsert({
        organization_id: org,
        industry_template_code: code,
        applied_at: new Date().toISOString(),
      });
      if (saved.error) throw saved.error;
      return { industry_template_code: code };
    },
    onSuccess: async () => {
      await invalidateCatalog(qc, organizationId);
    },
  });
}

export function useUpsertTagDef() {
  const { organizationId } = useOrgBootstrapPending();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { key: string; label: string; value_type?: "bool" | "text"; position?: number }) => {
      const org = organizationId as string;
      const position = input.position ?? 100;
      const { error } = await supabase.from("footage_tag_defs").upsert(
        {
          organization_id: org,
          key: input.key,
          label: input.label,
          applies_to: "scene",
          value_type: input.value_type ?? "bool",
          position,
        },
        { onConflict: "organization_id,key" },
      );
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateCatalog(qc, organizationId);
    },
  });
}

export function useDeleteTagDef() {
  const { organizationId } = useOrgBootstrapPending();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tagDefId: string) => {
      const { count, error: cErr } = await supabase
        .from("footage_tag_values")
        .select("id", { count: "exact", head: true })
        .eq("tag_def_id", tagDefId);
      if (cErr) throw cErr;
      if ((count ?? 0) > 0) throw new Error("tag_in_use");
      const { error } = await supabase.from("footage_tag_defs").delete().eq("id", tagDefId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateCatalog(qc, organizationId);
    },
  });
}

export function useAddSceneKind() {
  const { organizationId } = useOrgBootstrapPending();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { key: string; label: string; position?: number }) => {
      const org = organizationId as string;
      const { error } = await supabase.from("footage_scene_kind_defs").upsert(
        {
          organization_id: org,
          key: input.key,
          label: input.label,
          position: input.position ?? 100,
        },
        { onConflict: "organization_id,key" },
      );
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateCatalog(qc, organizationId);
    },
  });
}

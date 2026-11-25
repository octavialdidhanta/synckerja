import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { isMissingRelationError } from "../shared/catalogQuery";
import { catalogSlug, uniqueCatalogSlug } from "./catalogEdit";
import { addLocationPhoto, writeLocationCopy } from "./locationPhoto";

export interface MenuFieldInput {
  key: string;
  position: number;
  body: string;
}

interface SaveMenuInput {
  id?: string;
  name: string;
  aliases: string[];
  fields: MenuFieldInput[];
  takenSlugs: string[];
  defaultPriceId?: string | null;
  featureId?: string | null;
  subServiceId?: string | null;
  /** Attaching a source must not wipe a description that is already stored. */
  fillOnly?: boolean;
}

interface SaveLocationInput {
  id?: string;
  label: string;
  name: string;
  takenSlugs: string[];
  photos?: { id: string; description: string }[];
  sections?: { title: string; body: string }[];
}

interface AddLocationPhotoInput {
  locationId: string;
  label: string;
  position: number;
  file: File;
}

async function writeMenuFields(org: string, menuId: string, fields: MenuFieldInput[], fillOnly: boolean) {
  const { data: existing, error: readError } = await supabase
    .from("catalog_menu_fields")
    .select("field_key,position")
    .eq("organization_id", org)
    .eq("menu_id", menuId);
  if (readError) throw readError;
  const rows = existing ?? [];
  const used = new Set(rows.map((row) => row.position));
  let cursor = used.size ? Math.max(...rows.map((row) => row.position)) + 1 : 0;
  const take = (preferred: number) => {
    if (!used.has(preferred)) {
      used.add(preferred);
      return preferred;
    }
    while (used.has(cursor)) cursor += 1;
    used.add(cursor);
    const position = cursor;
    cursor += 1;
    return position;
  };

  for (const field of fields) {
    const body = field.body.trim();
    const current = rows.find((row) => row.field_key === field.key);
    if (!body) {
      if (fillOnly || !current) continue;
      const { error } = await supabase
        .from("catalog_menu_fields")
        .delete()
        .eq("organization_id", org)
        .eq("menu_id", menuId)
        .eq("field_key", field.key);
      if (error) throw error;
      continue;
    }
    if (current) {
      const { error } = await supabase
        .from("catalog_menu_fields")
        .update({ body })
        .eq("organization_id", org)
        .eq("menu_id", menuId)
        .eq("field_key", field.key);
      if (error) throw error;
      continue;
    }
    const { error } = await supabase.from("catalog_menu_fields").insert({
      organization_id: org,
      menu_id: menuId,
      field_key: field.key,
      body,
      position: take(field.position),
    });
    if (error) throw error;
  }
}

export function useCatalogEdit() {
  const { organizationId } = useOrgBootstrapPending();
  const qc = useQueryClient();
  const libraryKey = ["content-studio", "library", organizationId] as const;
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: libraryKey }),
      qc.invalidateQueries({ queryKey: ["content-studio", "footage", organizationId] }),
    ]);
  };

  const menu = useMutation({
    mutationFn: async (input: SaveMenuInput) => {
      const org = organizationId;
      if (!org) throw new Error("Organisasi belum siap.");
      const name = input.name.trim();
      const source = {
        ...(input.defaultPriceId ? { default_price_id: input.defaultPriceId } : {}),
        ...(input.featureId ? { feature_id: input.featureId } : {}),
        ...(input.subServiceId ? { sub_service_id: input.subServiceId } : {}),
      };
      const writeMenu = async (link: Record<string, string>) => {
        if (!input.id) {
          const slug = uniqueCatalogSlug(catalogSlug(name), input.takenSlugs);
          return supabase
            .from("catalog_menus")
            .insert({ organization_id: org, external_id: slug, name, aliases: input.aliases, ...link })
            .select("id")
            .single();
        }
        const updated = await supabase
          .from("catalog_menus")
          .update({ name, aliases: input.aliases, ...link })
          .eq("organization_id", org)
          .eq("id", input.id);
        return { data: { id: input.id }, error: updated.error };
      };
      let saved = await writeMenu(source);
      if (saved.error && input.subServiceId && isMissingRelationError(saved.error)) {
        const { sub_service_id: _subServiceId, ...withoutSub } = source;
        void _subServiceId;
        saved = await writeMenu(withoutSub);
      }
      if (saved.error || !saved.data?.id) throw saved.error ?? new Error("Gagal menyimpan.");
      const id = saved.data.id;
      await writeMenuFields(org, id, input.fields, Boolean(input.fillOnly));
      return id;
    },
    onSuccess: refresh,
  });

  const location = useMutation({
    mutationFn: async (input: SaveLocationInput) => {
      const org = organizationId;
      if (!org) throw new Error("Organisasi belum siap.");
      const label = input.label.trim();
      const name = input.name.trim() || label;
      let id = input.id;
      if (id) {
        const { error } = await supabase
          .from("catalog_locations")
          .update({ label, name })
          .eq("organization_id", org)
          .eq("id", id);
        if (error) throw error;
      } else {
        const slug = uniqueCatalogSlug(catalogSlug(label), input.takenSlugs);
        const { data, error } = await supabase
          .from("catalog_locations")
          .insert({ organization_id: org, external_id: slug, name, label })
          .select("id")
          .single();
        if (error) throw error;
        id = data.id as string;
      }
      if (input.photos?.length || input.sections?.length) {
        await writeLocationCopy(org, id, input.photos ?? [], input.sections ?? []);
      }
      return id;
    },
    onSuccess: refresh,
  });

  const addPhoto = useMutation({
    mutationFn: async (input: AddLocationPhotoInput) => {
      const org = organizationId;
      if (!org) throw new Error("Organisasi belum siap.");
      return addLocationPhoto({ organizationId: org, ...input });
    },
    onSuccess: refresh,
  });

  return {
    saveMenu: menu.mutateAsync,
    saveLocation: location.mutateAsync,
    addPhoto: addPhoto.mutateAsync,
    saving: menu.isPending || location.isPending,
    error: menu.error ?? location.error,
    reset: () => {
      menu.reset();
      location.reset();
      addPhoto.reset();
    },
  };
}

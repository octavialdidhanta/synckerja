import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import { confirmBriefInput } from "../content/briefsUpdate";
import type { SignedContentConfirmation, VerifiedContentConfirmation } from "../content/contentConfirmation";
import {
  templateFields,
  type TemplateField,
} from "../../../../../supabase/functions/_shared/describeCatalogProduct";

const FIELD_KEY = /^[a-z][a-z0-9_]{0,63}$/;

export const previewProductFieldsInput = z
  .object({
    id: z.string().trim().min(1).max(80).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    fields: z.record(z.string().max(4000)),
  })
  .strict()
  .refine((value) => Boolean(value.id || value.name) && Object.keys(value.fields).length > 0 && Object.keys(value.fields).length <= 20);

export type ProductFieldChange = { key: string; label: string; before: string; after: string };
export type ProductFieldBody = { key: string; body: string };

export type ProductFieldContext = {
  menuId: string;
  name: string;
  allowed: TemplateField[];
  current: { key: string; body: string }[];
};

export function fieldChanges(
  allowed: TemplateField[],
  current: { key: string; body: string }[],
  next: Record<string, string>,
): { changes: ProductFieldChange[]; fields: ProductFieldBody[] } {
  const known = new Map(allowed.map((field) => [field.key, field]));
  for (const key of Object.keys(next)) {
    if (!FIELD_KEY.test(key) || !known.has(key)) throw new Error("field_forbidden");
    if (!next[key].trim()) throw new Error("field_empty");
  }
  const have = new Map(current.map((field) => [field.key, field.body]));
  const changes: ProductFieldChange[] = [];
  const fields: ProductFieldBody[] = [];
  for (const field of allowed) {
    if (!(field.key in next)) continue;
    const body = next[field.key].trim();
    const before = have.get(field.key) ?? "";
    if (before.trim() === body) continue;
    changes.push({ key: field.key, label: field.label, before, after: body });
    fields.push({ key: field.key, body });
  }
  return { changes, fields };
}

export function defsFromSettings(settings: unknown): TemplateField[] {
  const row = settings && typeof settings === "object" ? settings as { menu_field_defs?: unknown } : {};
  if (!Array.isArray(row.menu_field_defs)) return templateFields([]);
  const defs = row.menu_field_defs.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const field = item as { field_key?: unknown; label?: unknown; position?: unknown };
    if (typeof field.field_key !== "string" || typeof field.label !== "string") return [];
    return [{ key: field.field_key, label: field.label, position: typeof field.position === "number" ? field.position : 0 }];
  });
  return templateFields(defs);
}

const NEXT_STEP =
  "Nothing is saved yet. Show each before and after to the user. "
  + "Call catalog.product.fields.update with this confirm_token only after they clearly say yes. "
  + "Fields that were not sent stay as they are.";

type Sign = (
  ctx: McpAuthContext,
  tool: "catalog.product.fields.update",
  payload: Record<string, unknown>,
) => Promise<SignedContentConfirmation>;

export async function previewProductFieldsResult(
  ctx: McpAuthContext,
  args: unknown,
  load: (ctx: McpAuthContext, address: { id?: string; name?: string }) => Promise<ProductFieldContext>,
  sign: Sign,
): Promise<Record<string, unknown>> {
  const parsed = previewProductFieldsInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  const loaded = await load(ctx, { id: parsed.data.id, name: parsed.data.name });
  const diff = fieldChanges(loaded.allowed, loaded.current, parsed.data.fields);
  if (diff.changes.length === 0) {
    return {
      product: loaded.name,
      changes: [],
      next_step: "The text is already the same, so no confirm_token was issued. Tell the user nothing needs to change.",
    };
  }
  const signed = await sign(ctx, "catalog.product.fields.update", { menu_id: loaded.menuId, fields: diff.fields });
  return { product: loaded.name, changes: diff.changes, ...signed, next_step: NEXT_STEP };
}

export function productFieldsFromConfirmation(payload: Record<string, unknown>): { menuId: string; fields: ProductFieldBody[] } {
  const menuId = typeof payload.menu_id === "string" ? payload.menu_id : "";
  if (!/^[0-9a-f-]{36}$/i.test(menuId) || !Array.isArray(payload.fields)) throw new Error("confirmation_invalid");
  const fields = payload.fields.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const field = item as { key?: unknown; body?: unknown };
    if (typeof field.key !== "string" || typeof field.body !== "string") return [];
    return [{ key: field.key, body: field.body }];
  });
  if (fields.length === 0 || fields.length !== payload.fields.length) throw new Error("confirmation_invalid");
  return { menuId, fields };
}

export async function applyProductFieldsResult(
  ctx: McpAuthContext,
  args: unknown,
  verify: (
    ctx: McpAuthContext,
    tool: "catalog.product.fields.update",
    token: string,
  ) => Promise<VerifiedContentConfirmation>,
  apply: (
    ctx: McpAuthContext,
    write: { menuId: string; fields: ProductFieldBody[] },
    confirmId: string,
  ) => Promise<{ saved: boolean; id: string }>,
): Promise<{ saved: boolean; id: string }> {
  const parsed = confirmBriefInput.safeParse(args ?? {});
  if (!parsed.success) throw new Error("invalid_input");
  const verified = await verify(ctx, "catalog.product.fields.update", parsed.data.confirm_token);
  return apply(ctx, productFieldsFromConfirmation(verified.payload), verified.confirmId);
}

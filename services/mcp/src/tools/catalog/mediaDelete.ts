import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type {
  CatalogMediaDeleteInput,
  CatalogMediaDeletePreview,
  CatalogMediaDeleteSaved,
  CatalogMediaRestoreInput,
  CatalogMediaRestorePreview,
  CatalogMediaRestoreSaved,
} from "../../db/catalog";
import {
  confirmFootageInput,
  type FootageConfirmableTool,
  type SignedFootageConfirmation,
  type VerifiedFootageConfirmation,
} from "../footage/confirmation";

const photo = z.object({
  kind: z.enum(["menu_photo", "location_photo"]),
  id: z.string().uuid(),
}).strict();

const reference = z.object({
  kind: z.literal("reference_image"),
  external_id: z.string().trim().min(1).max(80),
  storage_path: z.string().trim().min(1).max(500),
}).strict();

export const deleteCatalogMediaPreviewInput = z.discriminatedUnion("kind", [
  photo.extend({ acknowledge_used: z.boolean().optional() }),
  reference.extend({ acknowledge_used: z.boolean().optional() }),
]);

export const restoreCatalogMediaPreviewInput = z.discriminatedUnion("kind", [
  photo,
  reference,
]);

const USED_NEXT_STEP =
  "This image is mentioned by a shot list. Show the file and those jobs. Nothing is saved. "
  + "Call catalog.media.delete.preview again with acknowledge_used true only after the user confirms they still want it hidden. "
  + "The storage file stays for 30 days.";

const DELETE_NEXT_STEP =
  "Nothing is saved yet. Show the image and any shot lists that mention it. "
  + "Saying yes hides it for 30 days. The storage file stays. "
  + "Call catalog.media.delete with this confirm_token only after the user clearly says yes to this one delete.";

const RESTORE_EXPIRED_NEXT_STEP =
  "The 30 day restore window has ended. Nothing was saved. Do not call catalog.media.restore.";

const RESTORE_NEXT_STEP =
  "Nothing is saved yet. Show the image that would come back. "
  + "Call catalog.media.restore with this confirm_token only after the user clearly says yes to this one restore.";

type Sign = (
  ctx: McpAuthContext,
  tool: FootageConfirmableTool,
  previewId: string,
  expiresAt: string,
) => Promise<SignedFootageConfirmation>;

type Verify = (
  ctx: McpAuthContext,
  tool: FootageConfirmableTool,
  token: string,
) => Promise<VerifiedFootageConfirmation>;

function deleteSummary(row: CatalogMediaDeletePreview) {
  return {
    kind: row.kind,
    id: row.id ?? null,
    external_id: row.external_id ?? null,
    file_path: row.file_path ?? null,
    storage_path: row.storage_path ?? null,
    label: row.label ?? null,
    used: row.used === true,
    usage_count: row.usage_count ?? 0,
    usages: row.usages ?? [],
    storage_kept: true,
    can_save: row.can_save === true,
  };
}

export function previewDeleteCatalogMediaResult(
  ctx: McpAuthContext,
  args: unknown,
  preview: (ctx: McpAuthContext, input: CatalogMediaDeleteInput) => Promise<CatalogMediaDeletePreview>,
  sign: Sign,
): Promise<Record<string, unknown>> {
  const parsed = deleteCatalogMediaPreviewInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return preview(ctx, parsed.data).then(async (row) => {
    const summary = deleteSummary(row);
    if (summary.can_save !== true || !row.preview_id || !row.expires_at) {
      return { ...summary, can_save: false, next_step: USED_NEXT_STEP };
    }
    const signed = await sign(ctx, "catalog.media.delete", row.preview_id, row.expires_at);
    return { ...summary, ...signed, next_step: DELETE_NEXT_STEP };
  });
}

export function applyDeleteCatalogMediaResult(
  ctx: McpAuthContext,
  args: unknown,
  verify: Verify,
  apply: (ctx: McpAuthContext, previewId: string) => Promise<CatalogMediaDeleteSaved>,
): Promise<CatalogMediaDeleteSaved> {
  const parsed = confirmFootageInput.safeParse(args ?? {});
  if (!parsed.success) throw new Error("invalid_input");
  return verify(ctx, "catalog.media.delete", parsed.data.confirm_token).then((verified) =>
    apply(ctx, verified.previewId),
  );
}

export function previewRestoreCatalogMediaResult(
  ctx: McpAuthContext,
  args: unknown,
  preview: (ctx: McpAuthContext, input: CatalogMediaRestoreInput) => Promise<CatalogMediaRestorePreview>,
  sign: Sign,
): Promise<Record<string, unknown>> {
  const parsed = restoreCatalogMediaPreviewInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  return preview(ctx, parsed.data).then(async (row) => {
    const summary = {
      kind: row.kind,
      id: row.id ?? null,
      external_id: row.external_id ?? null,
      storage_path: row.storage_path ?? null,
      deleted_at: row.deleted_at,
      purge_after: row.purge_after ?? null,
      can_save: row.can_save === true,
    };
    if (summary.can_save !== true || !row.preview_id || !row.expires_at) {
      return { ...summary, can_save: false, reason: row.reason ?? "restore_expired", next_step: RESTORE_EXPIRED_NEXT_STEP };
    }
    const signed = await sign(ctx, "catalog.media.restore", row.preview_id, row.expires_at);
    return { ...summary, ...signed, next_step: RESTORE_NEXT_STEP };
  });
}

export function applyRestoreCatalogMediaResult(
  ctx: McpAuthContext,
  args: unknown,
  verify: Verify,
  apply: (ctx: McpAuthContext, previewId: string) => Promise<CatalogMediaRestoreSaved>,
): Promise<CatalogMediaRestoreSaved> {
  const parsed = confirmFootageInput.safeParse(args ?? {});
  if (!parsed.success) throw new Error("invalid_input");
  return verify(ctx, "catalog.media.restore", parsed.data.confirm_token).then((verified) =>
    apply(ctx, verified.previewId),
  );
}

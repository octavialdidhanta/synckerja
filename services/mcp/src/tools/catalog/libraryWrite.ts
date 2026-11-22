import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type {
  CatalogDocumentUpsertInput,
  CatalogReferenceUpsertPreview,
  CatalogReferenceUpsertSaved,
  CatalogShotJobUpsertPreview,
  CatalogShotJobUpsertSaved,
  CatalogStyleUpdateInput,
  CatalogStyleUpdatePreview,
  CatalogStyleUpdateSaved,
} from "../../db/catalog";
import {
  confirmFootageInput,
  type FootageConfirmableTool,
  type SignedFootageConfirmation,
  type VerifiedFootageConfirmation,
} from "../footage/confirmation";

const slug = z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

export const styleUpdatePreviewInput = z.object({
  field_key: slug,
  body: z.string().max(4000),
  mode: z.enum(["replace", "append"]).optional(),
}).strict();

export const referenceUpsertPreviewInput = z.object({
  external_id: slug,
  document: z.record(z.unknown()),
}).strict();

export const shotlistUpsertPreviewInput = z.object({
  external_id: slug,
  document: z.record(z.unknown()),
}).strict();

const STYLE_NEXT_STEP =
  "Nothing is saved yet. Show the style box before and after. "
  + "Call catalog.style.update with this confirm_token only after the user clearly says yes to this change.";

const REFERENCE_NEXT_STEP =
  "Nothing is saved yet. Show the reference title, beat and motion graphic counts before and after, the changed keys, "
  + "and any images_unlinked (those images lose their link). Existing image links are kept automatically. "
  + "Call catalog.reference.upsert with this confirm_token only after the user clearly says yes.";

const SHOTLIST_NEXT_STEP =
  "Nothing is saved yet. Show the shot list job before and after and the shots added, removed and changed. "
  + "Call catalog.shotlist.upsert with this confirm_token only after the user clearly says yes.";

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

function stripPreview<T extends { preview_id: string; expires_at: string }>(row: T) {
  const { preview_id: _p, expires_at: _e, ...summary } = row;
  return summary;
}

async function signed<T extends { preview_id: string; expires_at: string }>(
  ctx: McpAuthContext,
  tool: FootageConfirmableTool,
  row: T,
  sign: Sign,
  nextStep: string,
): Promise<Record<string, unknown>> {
  if (!row.preview_id || !row.expires_at) throw new Error("preview_failed");
  const token = await sign(ctx, tool, row.preview_id, row.expires_at);
  return { ...stripPreview(row), ...token, next_step: nextStep };
}

async function confirmed<T>(
  ctx: McpAuthContext,
  args: unknown,
  tool: FootageConfirmableTool,
  verify: Verify,
  apply: (ctx: McpAuthContext, previewId: string) => Promise<T>,
): Promise<T> {
  const parsed = confirmFootageInput.safeParse(args ?? {});
  if (!parsed.success) throw new Error("invalid_input");
  const verified = await verify(ctx, tool, parsed.data.confirm_token);
  return apply(ctx, verified.previewId);
}

export async function previewCatalogStyleUpdateResult(
  ctx: McpAuthContext,
  args: unknown,
  preview: (ctx: McpAuthContext, input: CatalogStyleUpdateInput) => Promise<CatalogStyleUpdatePreview>,
  sign: Sign,
): Promise<Record<string, unknown>> {
  const parsed = styleUpdatePreviewInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  const row = await preview(ctx, parsed.data);
  return signed(ctx, "catalog.style.update", row, sign, STYLE_NEXT_STEP);
}

export function applyCatalogStyleUpdateResult(
  ctx: McpAuthContext,
  args: unknown,
  verify: Verify,
  apply: (ctx: McpAuthContext, previewId: string) => Promise<CatalogStyleUpdateSaved>,
): Promise<CatalogStyleUpdateSaved> {
  return confirmed(ctx, args, "catalog.style.update", verify, apply);
}

export async function previewCatalogReferenceUpsertResult(
  ctx: McpAuthContext,
  args: unknown,
  preview: (ctx: McpAuthContext, input: CatalogDocumentUpsertInput) => Promise<CatalogReferenceUpsertPreview>,
  sign: Sign,
): Promise<Record<string, unknown>> {
  const parsed = referenceUpsertPreviewInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  const row = await preview(ctx, parsed.data);
  return signed(ctx, "catalog.reference.upsert", row, sign, REFERENCE_NEXT_STEP);
}

export function applyCatalogReferenceUpsertResult(
  ctx: McpAuthContext,
  args: unknown,
  verify: Verify,
  apply: (ctx: McpAuthContext, previewId: string) => Promise<CatalogReferenceUpsertSaved>,
): Promise<CatalogReferenceUpsertSaved> {
  return confirmed(ctx, args, "catalog.reference.upsert", verify, apply);
}

export async function previewCatalogShotlistUpsertResult(
  ctx: McpAuthContext,
  args: unknown,
  preview: (ctx: McpAuthContext, input: CatalogDocumentUpsertInput) => Promise<CatalogShotJobUpsertPreview>,
  sign: Sign,
): Promise<Record<string, unknown>> {
  const parsed = shotlistUpsertPreviewInput.safeParse(args);
  if (!parsed.success) throw new Error("invalid_input");
  const row = await preview(ctx, parsed.data);
  return signed(ctx, "catalog.shotlist.upsert", row, sign, SHOTLIST_NEXT_STEP);
}

export function applyCatalogShotlistUpsertResult(
  ctx: McpAuthContext,
  args: unknown,
  verify: Verify,
  apply: (ctx: McpAuthContext, previewId: string) => Promise<CatalogShotJobUpsertSaved>,
): Promise<CatalogShotJobUpsertSaved> {
  return confirmed(ctx, args, "catalog.shotlist.upsert", verify, apply);
}

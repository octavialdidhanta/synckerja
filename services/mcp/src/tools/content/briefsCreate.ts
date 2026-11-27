import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { ContentBriefRecord, ContentBriefWrite } from "../../db/contentBriefs";
import { calendarDay } from "../inputs";

const shotField = z.string().max(500);
const shotSchema = z.object({
  timing: shotField.optional(),
  visual: shotField.optional(),
  vo: shotField.optional(),
  element: shotField.optional(),
  tagging: shotField.optional(),
}).strict();

const sequenceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  shots: z.array(shotSchema).min(1).max(30),
}).strict();

const assetSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().max(300).optional(),
}).strict();

export const createBriefInput = z.object({
  title: z.string().trim().min(1).max(200),
  post_date: calendarDay.optional(),
  content_type_id: z.string().uuid(),
  service_id: z.string().uuid().optional(),
  sub_service_id: z.string().uuid().optional(),
  feature_id: z.string().uuid().optional(),
  post_aspect: z.enum(["4:5", "1:1"]).optional(),
  voice_over: z.string().max(2000).optional(),
  characters: z.array(assetSchema).max(8).optional(),
  locations: z.array(assetSchema).max(8).optional(),
  properties: z.array(assetSchema).max(8).optional(),
  caption: z.string().max(2200).optional(),
  sequences: z.array(sequenceSchema).min(1).max(8),
}).strict();

/**
 * Gate 2: the shot list document saved with a new brief. The ContentID (external_id) is not known
 * yet, so it is never sent; the server gives it the new content plan's id.
 */
export const briefShotlistDocument = z
  .object({
    judul: z.string().max(300).optional(),
    shots: z
      .array(z.object({ id: z.string().trim().min(1).max(80) }).passthrough())
      .min(1)
      .max(60),
  })
  .passthrough()
  .refine((doc) => new Set(doc.shots.map((shot) => shot.id.trim())).size === doc.shots.length, {
    message: "shot ids must be unique",
  })
  .refine((doc) => !("job_id" in doc) && !("external_id" in doc), {
    message: "job_id and external_id are set by the server",
  })
  .refine((doc) => JSON.stringify(doc).length <= 150_000, { message: "shot list too long" });

export const createBriefPreviewInput = createBriefInput.extend({
  shotlist: briefShotlistDocument.optional(),
}).strict();

/** content.briefs.create: the confirm_token from content.briefs.create.preview, or (older path) the brief itself. */
export const createBriefToolInput = createBriefInput.partial().extend({
  confirm_token: z.string().min(1).max(200_000).optional(),
}).strict();

export type CreateBriefInput = z.infer<typeof createBriefInput>;

export function briefWriteFrom(data: CreateBriefInput): ContentBriefWrite {
  const blank = (value: string | undefined) => value ?? "";
  return {
    title: data.title,
    postDate: data.post_date ?? null,
    contentTypeId: data.content_type_id,
    serviceId: data.service_id ?? null,
    subServiceId: data.sub_service_id ?? null,
    featureId: data.feature_id ?? null,
    postAspect: data.post_aspect ?? null,
    voiceOver: data.voice_over ?? null,
    characters: data.characters ?? [],
    locations: data.locations ?? [],
    properties: data.properties ?? [],
    caption: data.caption ?? null,
    sequences: data.sequences.map((sequence) => ({
      name: sequence.name,
      shots: sequence.shots.map((shot) => ({
        timing: blank(shot.timing),
        visual: blank(shot.visual),
        vo: blank(shot.vo),
        element: blank(shot.element),
        tagging: blank(shot.tagging),
      })),
    })),
  };
}

/** What the confirm_token carries: exactly what the user was shown. */
export type BriefCreatePayload = { input: CreateBriefInput; shotlist: Record<string, unknown> | null };

export function briefCreateFromConfirmation(payload: Record<string, unknown>): BriefCreatePayload {
  const input = createBriefInput.safeParse(payload.input);
  if (!input.success) throw new Error("confirmation_invalid");
  if (payload.shotlist == null) return { input: input.data, shotlist: null };
  const shotlist = briefShotlistDocument.safeParse(payload.shotlist);
  if (!shotlist.success) throw new Error("confirmation_invalid");
  return { input: input.data, shotlist: shotlist.data as Record<string, unknown> };
}

export const BRIEF_CREATE_PREVIEW_NEXT_STEP =
  "Nothing is saved yet. Show the brief (storyboard table, voice over, caption), the shot list, and every "
  + "tanpa_sumber claim together in one message. Call content.briefs.create with only this confirm_token after the "
  + "user clearly says yes; that one call saves the new content plan, its brief, and its shot list, or nothing. "
  + "If the user changes anything, preview again. After saving, generate the voice over with "
  + "content.briefs.voice.generate all_rows, and remind the user to approve the brief in Office: until it is "
  + "approved, the rendered video is not uploaded to the plan.";

export function createBriefResult(
  ctx: McpAuthContext,
  input: ContentBriefWrite,
  create: (ctx: McpAuthContext, input: ContentBriefWrite) => Promise<ContentBriefRecord>,
): Promise<ContentBriefRecord> {
  return create(ctx, input);
}

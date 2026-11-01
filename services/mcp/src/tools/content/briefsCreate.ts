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

export function createBriefResult(
  ctx: McpAuthContext,
  input: ContentBriefWrite,
  create: (ctx: McpAuthContext, input: ContentBriefWrite) => Promise<ContentBriefRecord>,
): Promise<ContentBriefRecord> {
  return create(ctx, input);
}

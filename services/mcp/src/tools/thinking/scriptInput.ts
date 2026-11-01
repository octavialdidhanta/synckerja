import { z } from "zod";
import { calendarDay } from "../inputs";

const assetSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300).optional(),
}).strict();

const shotSchema = z.object({
  role: z.string().trim().max(80).optional(),
  angle: z.string().trim().max(80).optional(),
  visual_function: z.string().trim().max(120).optional(),
  prompt: z.string().trim().max(2000).optional(),
}).strict();

const lineSchema = z.object({
  narration: z.string().trim().min(1).max(500),
  shots: z.array(shotSchema).max(6).optional(),
  delivery: z.enum(["vo", "dialogue", "silent"]).optional(),
}).strict();

const sceneSchema = z.object({
  title: z.string().trim().max(80).optional(),
  purpose: z.enum(["cta"]).optional(),
  lines: z.array(lineSchema).min(1).max(12),
}).strict();

export const thinkingScriptSchema = z.object({
  title: z.string().trim().min(1).max(200),
  caption: z.string().trim().max(2200).optional(),
  medium: z.enum(["video", "image"]),
  speech: z.enum(["vo", "mix", "dialog", "silent"]).optional(),
  look: z.enum(["ugc", "commercial", "cinematic"]).optional(),
  audio: z.object({
    sound: z.boolean(),
    music: z.boolean(),
  }).strict().optional(),
  image: z.object({
    format: z.enum(["single", "carousel"]),
    slide_count: z.number().int().min(2).max(10).optional(),
  }).strict().optional(),
  characters: z.array(assetSchema).max(8).optional(),
  locations: z.array(assetSchema).max(8).optional(),
  properties: z.array(assetSchema).max(8).optional(),
  scenes: z.array(sceneSchema).min(1).max(8),
}).strict();

const planFields = {
  content_type_id: z.string().uuid(),
  service_id: z.string().uuid().optional(),
  sub_service_id: z.string().uuid().optional(),
  feature_id: z.string().uuid().optional(),
  post_date: calendarDay.optional(),
};

export const ideasListInput = z.object({}).strict();

export const chainReadInput = z.object({
  idea_id: z.string().uuid(),
}).strict();

export const executionCheckInput = z.object({
  idea_id: z.string().uuid(),
  content_pillar_id: z.string().uuid(),
  script: thinkingScriptSchema,
}).strict();

export const planSaveInput = z.object({
  execution_id: z.string().uuid(),
  ...planFields,
}).strict();

export const planDirectInput = z.object({
  idea_id: z.string().uuid(),
  content_pillar_id: z.string().uuid(),
  script: thinkingScriptSchema,
  ...planFields,
}).strict();

export type ThinkingScriptDraft = z.infer<typeof thinkingScriptSchema>;

export type ThinkingPlanFields = {
  contentTypeId: string;
  serviceId: string | null;
  subServiceId: string | null;
  featureId: string | null;
  postDate: string | null;
};

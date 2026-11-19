import { z } from "zod";
import { applyBriefPatch, type BriefChange, type StoredBriefText } from "./briefPatch";

const cell = z.string().max(1500);
const shotPatch = z.object({
  shot_id: z.string().uuid(),
  timing: cell.optional(),
  visual: cell.optional(),
  vo: cell.optional(),
  element: cell.optional(),
  tagging: cell.optional(),
}).strict().refine((value) => (
  value.timing !== undefined
  || value.visual !== undefined
  || value.vo !== undefined
  || value.element !== undefined
  || value.tagging !== undefined
));

export const updateBriefPreviewInput = z.object({
  id: z.string().uuid(),
  base_version: z.number().int().min(0),
  shots: z.array(shotPatch).max(60).optional(),
  voice_over: z.string().max(2000).optional(),
  caption: z.string().max(2200).optional(),
}).strict().refine((value) => (
  (value.shots !== undefined && value.shots.length > 0)
  || value.voice_over !== undefined
  || value.caption !== undefined
));

export const confirmBriefInput = z.object({
  confirm_token: z.string().trim().min(20).max(200_000),
}).strict();

export type BriefEditState = {
  versionNo: number;
  status: string | null;
  approved: boolean;
  revisionLocked: boolean;
  canStoryboard: boolean;
  canConcept: boolean;
  canCaption: boolean;
  brief: string;
  concept: string;
  caption: string;
  link: string;
  shots: { id: string; rowIndex: number }[];
};

export type BriefUpdateWrite = {
  planId: string;
  baseVersion: number;
  brief: string;
  concept: string;
  caption: string;
  link: string;
};

export type BriefUpdatePreview = {
  changes: BriefChange[];
  willReturnToNeedReview: boolean;
  write: BriefUpdateWrite | null;
};

const confirmedPayload = z.object({
  planId: z.string().uuid(),
  baseVersion: z.number().int().min(0),
  brief: z.string(),
  concept: z.string(),
  caption: z.string(),
  link: z.string(),
}).strict();

export function briefUpdateFromConfirmation(payload: Record<string, unknown>): BriefUpdateWrite {
  const parsed = confirmedPayload.safeParse(payload);
  if (!parsed.success) throw new Error("confirmation_invalid");
  return parsed.data;
}

export function briefPreviewArgs(data: z.infer<typeof updateBriefPreviewInput>) {
  return {
    planId: data.id,
    baseVersion: data.base_version,
    shots: data.shots?.map((shot) => ({
      shotId: shot.shot_id,
      timing: shot.timing,
      visual: shot.visual,
      vo: shot.vo,
      element: shot.element,
      tagging: shot.tagging,
    })),
    voiceOver: data.voice_over,
    caption: data.caption,
  };
}

/** Diff the patch against the brief that is open. Nothing here is saved. */
export function previewBriefEdit(
  state: BriefEditState,
  input: {
    planId: string;
    baseVersion: number;
    shots?: { shotId: string; timing?: string; visual?: string; vo?: string; element?: string; tagging?: string }[];
    voiceOver?: string;
    caption?: string;
  },
): BriefUpdatePreview {
  if (input.baseVersion !== state.versionNo) throw new Error("brief_version_conflict");
  const stored: StoredBriefText = {
    brief: state.brief,
    concept: state.concept,
    caption: state.caption,
    link: state.link,
    shots: state.shots,
  };
  const applied = applyBriefPatch(stored, {
    shots: input.shots,
    voiceOver: input.voiceOver,
    caption: input.caption,
  });
  if (applied.changes.length === 0) {
    return { changes: [], willReturnToNeedReview: false, write: null };
  }
  const storyboard = applied.changes.some((change) => change.field === "storyboard");
  const concept = applied.changes.some((change) => change.field === "concept");
  const caption = applied.changes.some((change) => change.field === "caption");
  if ((storyboard && !state.canStoryboard) || (concept && !state.canConcept) || (caption && !state.canCaption)) {
    throw new Error("brief_field_forbidden");
  }
  if (state.revisionLocked) throw new Error("brief_edit_locked");
  const willReturnToNeedReview = state.status !== "Request Revision"
    && (state.approved || state.status === "Approved");
  return {
    changes: applied.changes,
    willReturnToNeedReview,
    write: {
      planId: input.planId,
      baseVersion: input.baseVersion,
      brief: applied.brief,
      concept: applied.concept,
      caption: applied.caption,
      link: applied.link,
    },
  };
}

export const BRIEF_UPDATE_HOW_TO_READ =
  "Show every change in plain words: the shot and column, the voice over, and the caption, each with the old text and the new text. "
  + "Nothing is saved yet. If will_return_to_need_review is true, say the approved brief will return to Need Review. "
  + "Ask the user to confirm. Only then call content.briefs.update with the confirm_token. "
  + "If the user changes anything, call content.briefs.update.preview again. A token works once and expires in 15 minutes. "
  + "changes empty means the text is already the same, so there is no token and nothing to confirm.";

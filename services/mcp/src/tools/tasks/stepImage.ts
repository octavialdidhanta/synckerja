import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";
import type { TaskStepImageRecord } from "../../db/stepImages";
import { taskId } from "./fields";

export const addStepImageInput = z.object({
  step_id: taskId,
  image_url: z.string().trim().min(1).max(2000).describe(
    "Public https URL of one JPEG, PNG, GIF, or WebP image, at most 5 MB. The image is stored as a step file and is not written into the description.",
  ),
}).strict();

export function addStepImageResult(
  ctx: McpAuthContext,
  input: { stepId: string; imageUrl: string },
  add: (ctx: McpAuthContext, input: { stepId: string; imageUrl: string }) => Promise<TaskStepImageRecord>,
): Promise<TaskStepImageRecord> {
  return add(ctx, input);
}

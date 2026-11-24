import { z } from "zod";
import { VIDEO_EDIT_PLAYBOOK, VIDEO_EDIT_PLAYBOOK_VERSION } from "./videoEdit";

/** Platform playbooks: the same for every organization. Organization facts and style live in the catalog and Gaya baku. */
export const PLAYBOOKS = {
  video_edit: { version: VIDEO_EDIT_PLAYBOOK_VERSION, body: VIDEO_EDIT_PLAYBOOK },
} as const;

export type PlaybookTask = keyof typeof PLAYBOOKS;

export const playbookGetInput = z
  .object({
    task: z.enum(Object.keys(PLAYBOOKS) as [PlaybookTask, ...PlaybookTask[]]),
  })
  .strict();

export function playbookGetResult(args: unknown): { task: PlaybookTask; version: string; playbook: string } {
  const parsed = playbookGetInput.safeParse(args ?? {});
  if (!parsed.success) throw new Error("invalid_input");
  const p = PLAYBOOKS[parsed.data.task];
  return { task: parsed.data.task, version: p.version, playbook: p.body };
}

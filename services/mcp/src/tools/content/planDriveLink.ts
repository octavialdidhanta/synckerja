import { z } from "zod";
import type { McpAuthContext } from "../../authz/context";

const DRIVE_FILE = /\/file\/d\/[a-zA-Z0-9_-]+/i;
const DRIVE_SHORT = /\/d\/[a-zA-Z0-9_-]+/i;
const DRIVE_OPEN = /[?&]id=[a-zA-Z0-9_-]+/i;
const DRIVE_FOLDER = /drive\.google\.com\/drive\/folders\/[a-zA-Z0-9_-]+/i;

export function isContentPlanDriveUrl(url: string): boolean {
  const value = url.trim();
  if (!/^https:\/\//i.test(value) || !/drive\.google\.com/i.test(value)) return false;
  return DRIVE_FOLDER.test(value) || DRIVE_FILE.test(value) || DRIVE_SHORT.test(value) || DRIVE_OPEN.test(value);
}

export const setPlanDriveLinkInput = z
  .object({
    plan_id: z.string().uuid(),
    url: z.string().trim().min(20).max(2000).refine(isContentPlanDriveUrl),
  })
  .strict();

export type SetPlanDriveLinkInput = {
  planId: string;
  url: string;
};

export type SetPlanDriveLinkResult = {
  plan_id: string;
  title: string | null;
  google_drive_link: string;
  production_status: string | null;
  changed: boolean;
  how_to_read: string;
};

export const PLAN_DRIVE_LINK_HOW_TO_READ =
  "google_drive_link is the Google Drive file or folder saved on this content plan. " +
  "The plan must be approved first, the same rule as the Google Drive Link cell in Office; an unapproved plan returns not_approved and nothing is saved. " +
  "A new or different link moves production_status to Need Review, the same way pasting the link in Office does. " +
  "The signed-in member becomes PIC Production unless that role was already assigned from task steps. " +
  "During Request Revision, the same file or folder URL is stored without moving back to Need Review. " +
  "changed false means the plan already had this exact link. This tool does not approve, schedule, or publish.";

export type SetContentPlanDriveLink = (
  ctx: McpAuthContext,
  input: SetPlanDriveLinkInput,
) => Promise<SetPlanDriveLinkResult>;

export function setPlanDriveLinkResult(
  ctx: McpAuthContext,
  args: unknown,
  setLink: SetContentPlanDriveLink,
): Promise<SetPlanDriveLinkResult> {
  const parsed = setPlanDriveLinkInput.safeParse(args ?? {});
  if (!parsed.success) throw new Error("invalid_input");
  return setLink(ctx, { planId: parsed.data.plan_id, url: parsed.data.url });
}

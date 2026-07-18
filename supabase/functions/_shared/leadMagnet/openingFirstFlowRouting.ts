import type { LeadMagnetEnrollmentRow } from "./types.ts";
import { isOpeningFirstDmFlow } from "./types.ts";

export type GetFrameworkPostbackRoute =
  | "noop"
  | "opening_click"
  | "legacy_framework_offer"
  | "legacy_delivery";

export type FollowConfirmPostbackRoute =
  | "handle_confirm"
  | "resend_opening"
  | "resend_legacy_offer"
  | "resend_delivery";

export function resolveGetFrameworkPostbackRoute(
  enrollment: Pick<LeadMagnetEnrollmentRow, "dm_flow_version" | "status">,
): GetFrameworkPostbackRoute {
  if (enrollment.status === "delivered") return "noop";
  if (isOpeningFirstDmFlow(enrollment)) {
    return enrollment.status === "framework_offered" ? "opening_click" : "noop";
  }
  if (enrollment.status === "follow_validated") return "legacy_framework_offer";
  return "legacy_delivery";
}

export function resolveFollowConfirmPostbackRoute(
  enrollment: Pick<LeadMagnetEnrollmentRow, "dm_flow_version" | "status">,
): FollowConfirmPostbackRoute {
  if (isOpeningFirstDmFlow(enrollment)) {
    if (enrollment.status === "framework_offered") return "resend_opening";
    if (enrollment.status === "follow_validated" || enrollment.status === "delivered") {
      return "resend_delivery";
    }
    return "handle_confirm";
  }
  if (enrollment.status === "framework_offered" || enrollment.status === "follow_validated") {
    return "resend_legacy_offer";
  }
  if (enrollment.status === "delivered") return "resend_delivery";
  return "handle_confirm";
}

export function shouldSendOpeningDmAtComment(args: {
  dmFlowVersion?: number;
  skipMaterialOffer: boolean;
}): boolean {
  return (args.dmFlowVersion ?? 1) === 2 && !args.skipMaterialOffer;
}

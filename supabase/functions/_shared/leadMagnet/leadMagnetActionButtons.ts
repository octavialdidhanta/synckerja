import type { LeadMagnetEnrollmentRow } from "./types.ts";
import { buildLeadMagnetPostbackPayload } from "./types.ts";
import { buildLeadMagnetActionUrl, type LeadMagnetAction } from "./leadMagnetActionUrl.ts";

export type LeadMagnetDmButton = { type: "postback"; title: string; payload: string }
  | { type: "web_url"; title: string; url: string };

export function buildFacebookPageUrl(pageId: string): string {
  const id = pageId.trim();
  return id ? `https://www.facebook.com/${encodeURIComponent(id)}` : "https://www.facebook.com";
}

/** Facebook Messenger postbacks need App-level messaging_postbacks webhook — use web_url instead. */
export async function buildLeadMagnetActionButton(
  enrollment: LeadMagnetEnrollmentRow,
  title: string,
  action: LeadMagnetAction,
): Promise<LeadMagnetDmButton> {
  if (enrollment.platform === "facebook") {
    return {
      type: "web_url",
      title,
      url: await buildLeadMagnetActionUrl(enrollment.id, action),
    };
  }
  return {
    type: "postback",
    title,
    payload: buildLeadMagnetPostbackPayload(enrollment.id, action),
  };
}

/** FB follow gate: open Page first, then confirm via action URL. */
export async function buildFacebookFollowGateButtons(
  enrollment: LeadMagnetEnrollmentRow,
  pageId: string,
  followButtonLabel: string,
): Promise<LeadMagnetDmButton[]> {
  return [
    {
      type: "web_url",
      title: "Ikuti Page",
      url: buildFacebookPageUrl(pageId),
    },
    await buildLeadMagnetActionButton(enrollment, followButtonLabel, "follow_confirm"),
  ];
}

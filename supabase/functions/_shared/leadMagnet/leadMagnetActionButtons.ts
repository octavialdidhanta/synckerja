import type { LeadMagnetEnrollmentRow } from "./types.ts";
import { buildLeadMagnetPostbackPayload } from "./types.ts";
import { buildLeadMagnetDownloadUrl, type LeadMagnetAction } from "./leadMagnetActionUrl.ts";

export type LeadMagnetDmButton = { type: "postback"; title: string; payload: string }
  | { type: "web_url"; title: string; url: string };

export function buildFacebookPageUrl(pageId: string): string {
  const id = pageId.trim();
  return id ? `https://www.facebook.com/${encodeURIComponent(id)}` : "https://www.facebook.com";
}

/** FB: postback keeps Messenger 24h window open; web_url opens external browser and breaks follow-up DMs. */
export async function buildLeadMagnetActionButton(
  enrollment: LeadMagnetEnrollmentRow,
  title: string,
  action: LeadMagnetAction,
): Promise<LeadMagnetDmButton> {
  return {
    type: "postback",
    title,
    payload: buildLeadMagnetPostbackPayload(enrollment.id, action),
  };
}

/** Delivery button — branded Synckerja URL, not raw storage link. */
export async function buildLeadMagnetDeliveryButton(
  enrollment: LeadMagnetEnrollmentRow,
  title: string,
): Promise<LeadMagnetDmButton> {
  return {
    type: "web_url",
    title,
    url: await buildLeadMagnetDownloadUrl(enrollment.id),
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

import type { CustomerVisitLeadEmbed, CustomerVisitLeadEnrollmentEmbed } from './customerVisit.types';

export type CustomerVisitLeadContent = {
  title: string;
  subtitle: string | null;
  href: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function firstLine(text: string): string {
  return text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? text.trim();
}

function attributionContent(lead: CustomerVisitLeadEmbed): string | null {
  const label = lead.attribution_label?.trim() || null;
  const attr = asRecord(lead.attribution);
  const utmContent = String(attr?.utm_content ?? '').trim();
  const utmCampaign = String(attr?.utm_campaign ?? '').trim();
  return utmContent || label || utmCampaign || null;
}

function campaignFromEnrollment(enrollment: CustomerVisitLeadEnrollmentEmbed) {
  const campaign = enrollment.lead_magnet_campaigns;
  return Array.isArray(campaign) ? campaign[0] ?? null : campaign ?? null;
}

function matchingPost(enrollment: CustomerVisitLeadEnrollmentEmbed) {
  const campaign = campaignFromEnrollment(enrollment);
  const posts = campaign?.lead_magnet_campaign_posts ?? [];
  const mediaId = (enrollment.media_id ?? '').trim();
  if (!mediaId || posts.length === 0) return null;
  const platform = (enrollment.platform ?? '').trim();
  return (
    posts.find((post) => post.media_id === mediaId && (!platform || post.platform === platform)) ??
    posts.find((post) => post.media_id === mediaId) ??
    null
  );
}

export function pickLatestLeadEnrollment(
  enrollments: CustomerVisitLeadEnrollmentEmbed[] | null | undefined,
): CustomerVisitLeadEnrollmentEmbed | null {
  if (!enrollments?.length) return null;
  return [...enrollments].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))[0] ?? null;
}

export function customerVisitLeadContent(lead: CustomerVisitLeadEmbed | null): CustomerVisitLeadContent | null {
  if (!lead) return null;
  const enrollment = pickLatestLeadEnrollment(lead.lead_magnet_enrollments);
  if (enrollment) {
    const campaign = campaignFromEnrollment(enrollment);
    const post = matchingPost(enrollment);
    const campaignName = campaign?.name?.trim() || null;
    const caption = firstLine(post?.media_caption ?? '');
    const href = post?.media_permalink?.trim() || null;
    if (campaignName && caption && caption !== campaignName) {
      return { title: campaignName, subtitle: caption, href };
    }
    if (campaignName) return { title: campaignName, subtitle: null, href };
    if (caption) return { title: caption, subtitle: null, href };
  }
  const fallback = attributionContent(lead);
  if (fallback) return { title: fallback, subtitle: null, href: null };
  return null;
}

import {
  encodeLinkedInRestliUrn,
  linkedInRestGet,
  parseOrganizationIdFromUrn,
  type LinkedInContentComment,
} from "./linkedinContentApi.ts";

export type LinkedInCommentAuthorHydrateContext = {
  accessToken: string;
  pageUrn: string;
  pageLabel: string;
  pageThumbnailUrl: string | null;
};

type AuthorProfile = {
  displayName: string;
  avatarUrl: string | null;
};

const PERSON_FALLBACK = "LinkedIn member";

function parsePersonIdFromUrn(urn: string): string | null {
  const m = /^urn:li:person:([^:\s]+)$/i.exec(String(urn ?? "").trim());
  return m?.[1] ?? null;
}

function parseOrgOrBrandIdFromUrn(urn: string): string | null {
  const fromOrg = parseOrganizationIdFromUrn(urn);
  if (fromOrg) return fromOrg;
  const m = /^urn:li:organizationBrand:(\d+)$/i.exec(String(urn ?? "").trim());
  return m?.[1] ?? null;
}

function isRawUrn(value: string | null | undefined): boolean {
  return /^urn:li:/i.test(String(value ?? "").trim());
}

async function fetchOrganizationProfile(
  accessToken: string,
  orgId: string,
): Promise<AuthorProfile | null> {
  try {
    const org = await linkedInRestGet<{
      localizedName?: string;
      logoV2?: {
        "original~"?: { elements?: Array<{ identifiers?: Array<{ identifier?: string }> }> };
      };
    }>(accessToken, `/rest/organizations/${encodeURIComponent(orgId)}`);
    const displayName = String(org?.localizedName ?? "").trim();
    if (!displayName) return null;
    let avatarUrl: string | null = null;
    const logoElements = org?.logoV2?.["original~"]?.elements;
    if (logoElements?.[0]?.identifiers?.[0]?.identifier) {
      avatarUrl = String(logoElements[0].identifiers[0].identifier);
    }
    return { displayName, avatarUrl };
  } catch (e) {
    console.warn(
      "linkedinCommentAuthorHydrate org:",
      orgId,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

async function fetchPersonProfile(
  accessToken: string,
  personId: string,
): Promise<AuthorProfile | null> {
  try {
    // Rest.li composite key: /rest/people/(id:{personId})
    const key = encodeLinkedInRestliUrn(`(id:${personId})`);
    const person = await linkedInRestGet<{
      localizedFirstName?: string;
      localizedLastName?: string;
      id?: string;
    }>(
      accessToken,
      `/rest/people/${key}`,
      { fields: "localizedFirstName,localizedLastName,id" },
    );
    if (String(person?.id ?? "").toLowerCase() === "private") {
      return { displayName: PERSON_FALLBACK, avatarUrl: null };
    }
    const first = String(person?.localizedFirstName ?? "").trim();
    const last = String(person?.localizedLastName ?? "").trim();
    const displayName = [first, last].filter(Boolean).join(" ").trim();
    if (!displayName) return { displayName: PERSON_FALLBACK, avatarUrl: null };
    return { displayName, avatarUrl: null };
  } catch (e) {
    console.warn(
      "linkedinCommentAuthorHydrate person:",
      personId,
      e instanceof Error ? e.message : e,
    );
    return { displayName: PERSON_FALLBACK, avatarUrl: null };
  }
}

/**
 * Resolve author_name / author_avatar_url from actor_urn.
 * Soft-fails per actor; never leaves a raw URN in author_name.
 */
export async function hydrateLinkedInCommentAuthors(
  comments: LinkedInContentComment[],
  ctx: LinkedInCommentAuthorHydrateContext,
): Promise<LinkedInContentComment[]> {
  if (comments.length === 0) return comments;

  const pageLabel = String(ctx.pageLabel ?? "").trim() || "LinkedIn Page";
  const profiles = new Map<string, AuthorProfile>();

  // Owner shortcut — no LinkedIn round-trip.
  profiles.set(ctx.pageUrn, {
    displayName: pageLabel,
    avatarUrl: ctx.pageThumbnailUrl,
  });

  const uniqueActors = [
    ...new Set(
      comments
        .map((c) => String(c.actor_urn ?? "").trim())
        .filter((urn) => urn && urn !== ctx.pageUrn),
    ),
  ];

  const orgIds = new Set<string>();
  const personIds = new Set<string>();
  for (const urn of uniqueActors) {
    const orgId = parseOrgOrBrandIdFromUrn(urn);
    if (orgId) {
      orgIds.add(orgId);
      continue;
    }
    const personId = parsePersonIdFromUrn(urn);
    if (personId) personIds.add(personId);
  }

  await Promise.all([
    ...[...orgIds].map(async (orgId) => {
      const profile = await fetchOrganizationProfile(ctx.accessToken, orgId);
      if (!profile) return;
      profiles.set(`urn:li:organization:${orgId}`, profile);
      profiles.set(`urn:li:organizationBrand:${orgId}`, profile);
    }),
    ...[...personIds].map(async (personId) => {
      const profile = await fetchPersonProfile(ctx.accessToken, personId);
      if (!profile) return;
      profiles.set(`urn:li:person:${personId}`, profile);
    }),
  ]);

  return comments.map((c) => {
    const actor = String(c.actor_urn ?? "").trim();
    const profile = actor ? profiles.get(actor) : undefined;
    let authorName = profile?.displayName?.trim() || null;
    if (isRawUrn(authorName)) authorName = PERSON_FALLBACK;
    if (!authorName && actor) {
      if (parsePersonIdFromUrn(actor)) authorName = PERSON_FALLBACK;
      else if (parseOrgOrBrandIdFromUrn(actor)) {
        authorName = `LinkedIn ${parseOrgOrBrandIdFromUrn(actor)}`;
      }
    }
    return {
      ...c,
      author_name: authorName,
      author_avatar_url: profile?.avatarUrl ?? c.author_avatar_url ?? null,
    };
  });
}

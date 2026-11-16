/** Last LinkedIn account chosen for publish / service_required_platforms (includes person). */

export type LinkedInPublishAccountRef = {
  page_id: string;
  is_default?: boolean;
  is_active?: boolean;
  account_kind?: string | null;
  sort_order?: number;
};

function publishStorageKey(organizationId: string): string {
  return `synckerja:linkedin-content:last-publish-account-id:${organizationId}`;
}

function normalizeKind(raw: string | null | undefined): "organization" | "person" {
  return String(raw ?? "").trim() === "person" ? "person" : "organization";
}

export function readLinkedInContentLastPublishAccountId(
  organizationId: string,
): string | null {
  const orgId = String(organizationId ?? "").trim();
  if (!orgId || typeof localStorage === "undefined") return null;
  try {
    const value = localStorage.getItem(publishStorageKey(orgId))?.trim() ?? "";
    return value || null;
  } catch {
    return null;
  }
}

export function writeLinkedInContentLastPublishAccountId(
  organizationId: string,
  pageId: string,
): void {
  const orgId = String(organizationId ?? "").trim();
  const id = String(pageId ?? "").trim();
  if (!orgId || !id || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(publishStorageKey(orgId), id);
  } catch {
    // private mode / quota — ignore
  }
}

/**
 * Prefer last publish account if still connected; else default org page;
 * else default person; else first active (org before person, sort_order).
 */
export function resolveLinkedInPublishInitialAccountId(
  organizationId: string,
  accounts: LinkedInPublishAccountRef[],
): string {
  const active = accounts.filter(
    (a) => a.is_active !== false && String(a.page_id ?? "").trim(),
  );
  if (active.length === 0) return "";

  const stored = readLinkedInContentLastPublishAccountId(organizationId);
  if (stored && active.some((a) => a.page_id === stored)) {
    return stored;
  }

  const orgDefault = active.find(
    (a) => normalizeKind(a.account_kind) === "organization" && Boolean(a.is_default),
  );
  if (orgDefault) return String(orgDefault.page_id).trim();

  const personDefault = active.find(
    (a) => normalizeKind(a.account_kind) === "person" && Boolean(a.is_default),
  );
  if (personDefault) return String(personDefault.page_id).trim();

  const sorted = [...active].sort((a, b) => {
    const kindA = normalizeKind(a.account_kind) === "person" ? 1 : 0;
    const kindB = normalizeKind(b.account_kind) === "person" ? 1 : 0;
    if (kindA !== kindB) return kindA - kindB;
    const sortA = Number(a.sort_order) || 0;
    const sortB = Number(b.sort_order) || 0;
    if (sortA !== sortB) return sortA - sortB;
    return String(a.page_id).localeCompare(String(b.page_id));
  });
  return String(sorted[0].page_id).trim();
}

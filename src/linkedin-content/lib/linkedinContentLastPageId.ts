import { linkedInPersonHasInsightsScopes } from "@/linkedin-content/constants/linkedinOAuthScopes";

type PageAccountRef = {
  page_id: string;
  is_default?: boolean;
  is_active?: boolean;
  account_kind?: string | null;
  sort_order?: number;
  granted_scopes?: unknown;
};

function storageKey(organizationId: string): string {
  return `synckerja:linkedin-content:last-page-id:${organizationId}`;
}

function normalizeKind(raw: string | null | undefined): "organization" | "person" {
  return String(raw ?? "").trim() === "person" ? "person" : "organization";
}

/** Org Company Pages only — person profiles must not hit page comments APIs. */
export function isLinkedInOrganizationAccount(
  account: Pick<PageAccountRef, "account_kind">,
): boolean {
  return normalizeKind(account.account_kind) !== "person";
}

export function filterLinkedInOrganizationAccounts<T extends PageAccountRef>(accounts: T[]): T[] {
  return accounts.filter(isLinkedInOrganizationAccount);
}

export function readLinkedInContentLastPageId(organizationId: string): string | null {
  const orgId = String(organizationId ?? "").trim();
  if (!orgId || typeof localStorage === "undefined") return null;
  try {
    const value = localStorage.getItem(storageKey(orgId))?.trim() ?? "";
    return value || null;
  } catch {
    return null;
  }
}

export function writeLinkedInContentLastPageId(organizationId: string, pageId: string): void {
  const orgId = String(organizationId ?? "").trim();
  const id = String(pageId ?? "").trim();
  if (!orgId || !id || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(storageKey(orgId), id);
  } catch {
    // private mode / quota — ignore
  }
}

/**
 * Accounts allowed in Performance nav: all org pages; person only with insights scopes.
 */
export function filterLinkedInPerformanceNavAccounts<T extends PageAccountRef>(
  accounts: T[],
): T[] {
  return accounts.filter((a) => {
    if (a.is_active === false) return false;
    if (!String(a.page_id ?? "").trim()) return false;
    if (normalizeKind(a.account_kind) !== "person") return true;
    return linkedInPersonHasInsightsScopes(a.granted_scopes);
  });
}

/**
 * Performance nav: last-selected active account (page or person with insights);
 * else default org; else default person (if eligible); else first (org before person).
 */
export function resolveLinkedInContentInitialPageId(
  organizationId: string,
  accounts: PageAccountRef[],
): string {
  const active = filterLinkedInPerformanceNavAccounts(accounts);
  if (active.length === 0) return "";

  const stored = readLinkedInContentLastPageId(organizationId);
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

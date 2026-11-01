export type NamedOrganization = {
  id: string;
  name: string;
};

export type OrganizationMatch =
  | { ok: true; organization: NamedOrganization }
  | { ok: false; reason: "not_found" | "ambiguous"; matches: NamedOrganization[] };

export function matchOrganization(name: string, organizations: NamedOrganization[]): OrganizationMatch {
  const needle = name.trim().toLocaleLowerCase();
  const matches = organizations.filter((organization) => organization.name.trim().toLocaleLowerCase() === needle);
  if (matches.length === 1) return { ok: true, organization: matches[0] };
  if (matches.length === 0) return { ok: false, reason: "not_found", matches: [] };
  return { ok: false, reason: "ambiguous", matches };
}

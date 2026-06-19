/** Organizations that skip JIT KYC and use OWNED xenPlatform sub-accounts. */
export function isInternalXenditOrg(organizationId: string): boolean {
  const raw = Deno.env.get("XENDIT_INTERNAL_ORG_IDS")?.trim() ?? "";
  if (!raw) return false;
  const ids = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return ids.includes(organizationId.trim().toLowerCase());
}

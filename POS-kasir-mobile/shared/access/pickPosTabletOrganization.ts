export type PosStaffOrgCandidate = {
  organizationId: string;
  addonActive: boolean;
};

export type PickPosTabletOrganizationResult =
  | { action: "use"; organizationId: string }
  | { action: "switch"; organizationId: string }
  | { action: "deny"; reason: "addon_inactive" | "not_staff" };

/**
 * Prefer the current org when it has Slot Karyawan + POS add-on.
 * Otherwise switch to another staff org that has the add-on (e.g. active org = "Test"
 * while Kitchen staff lives on "Synckerja Office").
 */
export function pickPosTabletOrganization(
  currentOrgId: string | null,
  candidates: readonly PosStaffOrgCandidate[],
): PickPosTabletOrganizationResult {
  if (candidates.length === 0) {
    return { action: "deny", reason: "not_staff" };
  }

  const withAddon = candidates.filter((c) => c.addonActive);
  if (withAddon.length === 0) {
    return { action: "deny", reason: "addon_inactive" };
  }

  if (currentOrgId && withAddon.some((c) => c.organizationId === currentOrgId)) {
    return { action: "use", organizationId: currentOrgId };
  }

  return { action: "switch", organizationId: withAddon[0]!.organizationId };
}

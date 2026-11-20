export function applyCrmMapping(
  mergedFormData: Record<string, unknown>,
  crmMapping: Record<string, unknown>,
): {
  name: string | null;
  phone_number: string | null;
  email: string | null;
  package_label: string | null;
} {
  const out = {
    name: null as string | null,
    phone_number: null as string | null,
    email: null as string | null,
    package_label: null as string | null,
  };

  const map = crmMapping as Record<string, string>;
  for (const [formKey, col] of Object.entries(map)) {
    const v = mergedFormData[formKey];
    if (v === undefined || v === null) continue;
    const s = typeof v === "string" ? v.trim() : String(v);
    if (!s) continue;
    if (col === "name") out.name = s;
    else if (col === "phone_number") out.phone_number = s;
    else if (col === "email") out.email = s;
    else if (col === "package_label") out.package_label = s;
  }

  return out;
}

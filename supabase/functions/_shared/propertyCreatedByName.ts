/** Human label for website-originated leads (`leads.created_by_name`). */
export function propertyCreatedByName(
  displayName: string | null | undefined,
  webId: string,
): string {
  const fromDisplay = typeof displayName === "string" ? displayName.trim() : "";
  if (fromDisplay) return fromDisplay.slice(0, 200);

  const slug = typeof webId === "string" ? webId.trim() : "";
  if (slug) {
    return slug
      .split(/[-_]+/)
      .filter((p) => p.length > 0)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join(" ")
      .slice(0, 200);
  }

  return "Website";
}

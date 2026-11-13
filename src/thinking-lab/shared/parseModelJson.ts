function relaxModelJson(source: string): string {
  return source.replace(/,\s*""\s*(?=[}\]])/g, "").replace(/,\s*([}\]])/g, "$1");
}

/** A missing reply (null) reads as no JSON instead of throwing. */
export function parseModelJson(script: string | null | undefined): unknown | null {
  if (!script) return null;
  const trimmed = script.trim();
  const objectAt = trimmed.indexOf("{");
  const arrayAt = trimmed.indexOf("[");
  const start =
    objectAt < 0 ? arrayAt : arrayAt < 0 ? objectAt : Math.min(objectAt, arrayAt);
  if (start < 0) return null;
  const end = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
  if (end < start) return null;
  const slice = trimmed.slice(start, end + 1);
  try {
    return JSON.parse(slice) as unknown;
  } catch {
    try {
      return JSON.parse(relaxModelJson(slice)) as unknown;
    } catch {
      return null;
    }
  }
}

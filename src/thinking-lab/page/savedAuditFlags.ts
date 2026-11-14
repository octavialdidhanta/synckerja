/** True when this item was saved while some pass checks of its level were switched OFF. */
export function savedUnchecked(
  items: ReadonlyArray<{ code: string; skipped?: string[] }> | null | undefined,
  code: string | null | undefined,
): boolean {
  if (!code) return false;
  const item = items?.find((entry) => entry.code.toUpperCase() === code.toUpperCase());
  return Boolean(item?.skipped?.length);
}

/** True when an ancestor of this item was rewritten (from chat) after it passed. */
export function savedParentChanged(
  items: ReadonlyArray<{ code: string; parentChanged?: true }> | null | undefined,
  code: string | null | undefined,
): boolean {
  if (!code) return false;
  return items?.find((entry) => entry.code.toUpperCase() === code.toUpperCase())?.parentChanged === true;
}

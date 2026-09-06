/** Save is enabled only when the receipt draft has changes and required names. */
export function canSaveReceiptSettings(args: {
  busy: boolean;
  isDirty: boolean;
  outletName: string;
  businessName: string;
}): boolean {
  return (
    !args.busy &&
    args.isDirty &&
    Boolean(args.outletName.trim()) &&
    Boolean(args.businessName.trim())
  );
}

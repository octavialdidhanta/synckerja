/** Pure helper — skip sending inventory alert email when digest has no rows. */
export function isInventoryDigestEmpty(args: {
  ingredientCount: number;
  menuCount: number;
}): boolean {
  return args.ingredientCount <= 0 && args.menuCount <= 0;
}

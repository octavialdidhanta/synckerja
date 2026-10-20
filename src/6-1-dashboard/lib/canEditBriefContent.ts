/** True only when the signed-in employee is the PIC of the open content row. */
export function canEditBriefContent(
  employeeId: string | null | undefined,
  picId: string | null | undefined,
): boolean {
  if (!employeeId || !picId) return false;
  return employeeId === picId;
}

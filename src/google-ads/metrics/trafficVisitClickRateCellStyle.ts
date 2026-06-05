/** Color scale for Visit / Click % (spreadsheet-style). */
export function trafficVisitClickRateCellStyle(
  value: number | null | undefined,
): { backgroundColor: string; color: string } | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;

  if (value >= 55) {
    return { backgroundColor: "#1e6b3a", color: "#ffffff" };
  }
  if (value >= 45) {
    return { backgroundColor: "#b8e0b8", color: "#1a3d1a" };
  }
  if (value >= 25) {
    return { backgroundColor: "#fff3cd", color: "#664d03" };
  }
  return { backgroundColor: "#f4a261", color: "#3d1f00" };
}

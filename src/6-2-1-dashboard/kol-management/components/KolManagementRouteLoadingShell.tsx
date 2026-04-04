/**
 * Rute KOL: tidak memakai skeleton/batang placeholder — hanya mengisi area flex saat guard atau Suspense.
 */
export function KolManagementRouteLoadingShell() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <span className="sr-only">Loading</span>
    </div>
  );
}

import { ClientVisitsScreen } from "./ClientVisitsScreen";

/**
 * Same shell as `/operations/sales/jadwal-kunjungan`: `SalesOperationsSeamlessSubpageLayout`
 * (single hidden-scrollbar scrollport — not AppShell + page double scroll).
 */
export function ClientVisitsRoute() {
  return <ClientVisitsScreen withSalesLayout />;
}

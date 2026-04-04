import { useLocation } from "react-router-dom";
import { SalesActivitiesRoute } from "./SalesActivitiesRoute";
import { VisitSchedulingRoute } from "@/5-2-jadwal-kunjungan";
import { ClientVisitsPage } from "@/5-2-client_visits";

export const SalesOperationsPage = () => {
  const location = useLocation();
  const isJadwalKunjungan = location.pathname.includes("/jadwal-kunjungan");
  const isClientVisits = location.pathname.includes("/client-visits");

  if (isJadwalKunjungan) {
    return <VisitSchedulingRoute />;
  }

  if (isClientVisits) {
    // `ClientVisitsRoute` uses `SalesOperationsSeamlessSubpageLayout` (same as jadwal-kunjungan); header is inside that layout only.
    return <ClientVisitsPage />;
  }

  return <SalesActivitiesRoute />;
};

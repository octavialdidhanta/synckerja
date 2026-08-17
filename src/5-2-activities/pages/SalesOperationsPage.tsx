import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { SalesActivitiesRoute } from "./SalesActivitiesRoute";
import { VisitSchedulingRoute } from "@/5-2-jadwal-kunjungan";
import { ClientVisitsPage } from "@/5-2-client_visits";
import { CustomerVisitsRoute } from "@/5-2-customer-visits";
import { useAuthSurface } from "@/shared/hooks/useAuthSurface";

const MobileClientVisit = lazy(() => import("@/mobile/1-client-visit/pages/ClientVisit"));

function MobileSalesParitySuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center bg-background" aria-busy>
          <span className="sr-only">Loading</span>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export const SalesOperationsPage = () => {
  const location = useLocation();
  const { isDesktop } = useAuthSurface();
  const isJadwalKunjungan = location.pathname.includes("/jadwal-kunjungan");
  const isCustomerVisits = location.pathname.includes("/customer-visits");
  const isClientVisits = location.pathname.includes("/client-visits");

  if (isJadwalKunjungan) {
    if (isDesktop) return <VisitSchedulingRoute />;
    return <Navigate to="/operations/sales/client-visits" replace />;
  }

  if (isCustomerVisits) {
    return <CustomerVisitsRoute />;
  }

  if (isClientVisits) {
    if (isDesktop) return <ClientVisitsPage />;
    return (
      <MobileSalesParitySuspense>
        <MobileClientVisit />
      </MobileSalesParitySuspense>
    );
  }

  return <SalesActivitiesRoute />;
};

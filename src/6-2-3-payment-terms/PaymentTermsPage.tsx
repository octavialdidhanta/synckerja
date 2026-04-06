import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { cn } from "@/shared/lib/utils";
import { useKolDeferredShowContent } from "@/6-2-1-dashboard/kol-management/hooks/useKolDeferredShowContent";
import { KolManagementPaymentTermsPageSkeleton } from "@/6-2-1-dashboard/kol-management/skeletons/KolManagementPaymentTermsPageSkeleton";
import { useKOLPaymentTerms } from "@/shared/hooks/payment-terms/useKOLPaymentTerms";
import KOLPaymentTermsTab from "./components/KOLPaymentTermsTab";

const PaymentTermsPage = () => {
  const { loading: orgLoading, organizationId } = useCurrentOrg();
  const { isPending: dataPending } = useKOLPaymentTerms();

  const queriesPending = Boolean(organizationId) && dataPending;
  const rawPending = orgLoading || queriesPending;
  const showContent = useKolDeferredShowContent(rawPending);

  return (
    <div className="relative min-h-0 w-full flex-1">
      <div
        className={cn(
          "grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch transition-opacity duration-200 ease-out",
          showContent ? "relative z-0 opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden={!showContent}
      >
        <div className="col-span-12 flex min-h-0 min-w-0 flex-col">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white px-4 py-5 shadow-sm sm:px-5 sm:py-6">
            <KOLPaymentTermsTab />
          </div>
        </div>
      </div>

      <div
        className={cn(
          "scrollbar-hide seamless-scroll nested-scroll-touch-chain absolute inset-0 z-20 min-h-0 overflow-y-auto overflow-x-hidden bg-gray-100 transition-opacity duration-200 ease-out [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          showContent ? "pointer-events-none opacity-0" : "opacity-100",
        )}
        aria-hidden={showContent}
      >
        <KolManagementPaymentTermsPageSkeleton variant="embedded" />
      </div>
    </div>
  );
};

export default PaymentTermsPage;

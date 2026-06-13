import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { PromoSimulationModuleShell } from "../layout/PromoSimulationModuleShell";
import { PromoSimulationWithTutorial } from "../components/PromoSimulationWithTutorial";

const MAIN_INNER_SCROLL =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const PromoSimulationPage = () => {
  const { t } = useAppTranslation();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const showContent = useDebouncedReady(!orgLoading, 200);

  return (
    <PromoSimulationModuleShell showContent={showContent}>
      <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
        <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col rounded-lg border border-primary/15 bg-card shadow-sm ring-1 ring-primary/5">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className={`${MAIN_INNER_SCROLL} px-6 py-6`}>
              {!organizationId ? (
                <p className="text-sm text-muted-foreground">
                  {t(
                    "promoSimulation.noOrganization",
                    "Pilih organisasi aktif untuk menggunakan simulasi promo.",
                  )}
                </p>
              ) : (
                <PromoSimulationWithTutorial />
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
    </PromoSimulationModuleShell>
  );
};

export default PromoSimulationPage;

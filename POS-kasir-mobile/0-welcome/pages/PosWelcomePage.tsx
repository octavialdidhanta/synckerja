import { PosGuestOnlyRedirect } from "@/pos-mobile/0-auth/components/PosGuestOnlyRedirect";
import { PosWelcomeActions } from "../components/PosWelcomeActions";
import { PosWelcomeLegalFooter } from "../components/PosWelcomeLegalFooter";

/**
 * Pre-auth welcome — brand from {@link PosAuthFunnelLayout}.
 * Public route: `/pos`.
 */
export default function PosWelcomePage() {
  return (
    <>
      <PosGuestOnlyRedirect />
      <PosWelcomeActions />
      <PosWelcomeLegalFooter />
    </>
  );
}

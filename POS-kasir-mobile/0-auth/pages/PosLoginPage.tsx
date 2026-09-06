import { PosGuestOnlyRedirect } from "../components/PosGuestOnlyRedirect";
import { PosLoginIdentifierForm } from "../components/PosLoginIdentifierForm";

/** Public route: `/pos/login` — email step (shell from {@link PosAuthFunnelLayout}). */
export default function PosLoginPage() {
  return (
    <>
      <PosGuestOnlyRedirect />
      <PosLoginIdentifierForm />
    </>
  );
}

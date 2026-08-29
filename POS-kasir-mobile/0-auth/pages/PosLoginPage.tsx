import { PosAuthViewport } from "@/pos-mobile/shared/layout/PosAuthViewport";
import { usePosTabletShell } from "@/pos-mobile/shared/hooks/usePosTabletShell";
import { PosLoginIdentifierForm } from "../components/PosLoginIdentifierForm";
import { useMarkPosAuthSurface } from "../lib/useMarkPosAuthSurface";

/** Public route: `/pos/login` — email step. */
export default function PosLoginPage() {
  usePosTabletShell();
  useMarkPosAuthSurface();

  return (
    <PosAuthViewport>
      <PosLoginIdentifierForm />
    </PosAuthViewport>
  );
}

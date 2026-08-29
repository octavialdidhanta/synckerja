import { PosAuthViewport } from "@/pos-mobile/shared/layout/PosAuthViewport";
import { usePosTabletShell } from "@/pos-mobile/shared/hooks/usePosTabletShell";
import { PosLoginPasswordForm } from "../components/PosLoginPasswordForm";
import { useMarkPosAuthSurface } from "../lib/useMarkPosAuthSurface";

/** Public route: `/pos/login/password` — password step. */
export default function PosLoginPasswordPage() {
  usePosTabletShell();
  useMarkPosAuthSurface();

  return (
    <PosAuthViewport>
      <PosLoginPasswordForm />
    </PosAuthViewport>
  );
}

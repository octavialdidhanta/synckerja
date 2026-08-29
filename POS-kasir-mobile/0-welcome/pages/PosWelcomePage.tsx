import { SynckerjaBrandMark } from "@/shared/components/mobile/SynckerjaBrandMark";
import { PosAuthViewport } from "@/pos-mobile/shared/layout/PosAuthViewport";
import { usePosTabletShell } from "@/pos-mobile/shared/hooks/usePosTabletShell";
import { useMarkPosAuthSurface } from "@/pos-mobile/0-auth/lib/useMarkPosAuthSurface";
import { PosWelcomeActions } from "../components/PosWelcomeActions";
import { PosWelcomeLegalFooter } from "../components/PosWelcomeLegalFooter";

/**
 * Pre-auth welcome / get-started gate for Synckerja POS (tablet-first).
 * Public route: `/pos`.
 */
export default function PosWelcomePage() {
  usePosTabletShell();
  useMarkPosAuthSurface();

  return (
    <PosAuthViewport>
      <div className="mb-8 flex justify-center">
        <SynckerjaBrandMark size="md" />
      </div>
      <PosWelcomeActions />
      <PosWelcomeLegalFooter />
    </PosAuthViewport>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SynckerjaBrandMark } from "@/shared/components/mobile/SynckerjaBrandMark";
import { usePosOutlets } from "@/8-2-2-outlets/hooks/usePosOutlets";
import { defaultPosOutletId } from "@/8-2-2-outlets/lib/assignedOutlets";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { PosAuthViewport } from "@/pos-mobile/shared/layout/PosAuthViewport";
import { usePosTabletShell } from "@/pos-mobile/shared/hooks/usePosTabletShell";
import { useMarkPosAuthSurface } from "@/pos-mobile/0-auth/lib/useMarkPosAuthSurface";
import { POS_AFTER_OUTLET_REDIRECT } from "@/pos-mobile/0-auth/lib/posAuthPaths";
import { PosOutletSelectField } from "../components/PosOutletSelectField";
import { PosSelectOutletActions } from "../components/PosSelectOutletActions";
import { POS_OUTLET_SELECT_I18N } from "../lib/posOutletSelectCopy";
import {
  readPosSelectedOutletId,
  stashPosSelectedOutlet,
} from "../lib/posSelectedOutletStorage";

/**
 * Post-auth outlet gate for Synckerja POS (after login / 2FA).
 * Authenticated route: `/pos/select-outlet`.
 */
export default function PosSelectOutletPage() {
  usePosTabletShell();
  useMarkPosAuthSurface();
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const { rows, isLoading } = usePosOutlets();

  const activeOutlets = useMemo(
    () =>
      rows
        .filter((row) => row.is_active)
        .map((row) => ({
          id: row.id,
          name: row.name,
          address: row.address?.trim() || null,
        })),
    [rows],
  );

  const [outletId, setOutletId] = useState("");

  useEffect(() => {
    if (outletId || activeOutlets.length === 0) return;
    const stashed = readPosSelectedOutletId();
    if (stashed && activeOutlets.some((row) => row.id === stashed)) {
      setOutletId(stashed);
      return;
    }
    const defaultId = defaultPosOutletId(rows.filter((row) => row.is_active));
    if (defaultId) setOutletId(defaultId);
  }, [activeOutlets, outletId, rows]);

  const onContinue = () => {
    const selected = activeOutlets.find((row) => row.id === outletId);
    if (!selected) return;
    stashPosSelectedOutlet(selected);
    navigate(POS_AFTER_OUTLET_REDIRECT, { replace: true });
  };

  const empty = !isLoading && activeOutlets.length === 0;

  return (
    <PosAuthViewport className="bg-white">
      <div className="mb-8 flex justify-center">
        <SynckerjaBrandMark size="md" />
      </div>

      <div className="flex w-full flex-col gap-4">
        <PosOutletSelectField
          value={outletId}
          onChange={setOutletId}
          options={activeOutlets}
          disabled={isLoading || empty}
        />

        {empty ? (
          <p className="text-center text-sm text-foreground/70">
            {t(POS_OUTLET_SELECT_I18N.empty, "No active outlets available for this organization.")}
          </p>
        ) : null}

        {isLoading ? (
          <p className="text-center text-sm text-foreground/70">
            {t(POS_OUTLET_SELECT_I18N.loading, "Loading outlets…")}
          </p>
        ) : null}

        <PosSelectOutletActions disabled={!outletId || empty || isLoading} onContinue={onContinue} />
      </div>
    </PosAuthViewport>
  );
}

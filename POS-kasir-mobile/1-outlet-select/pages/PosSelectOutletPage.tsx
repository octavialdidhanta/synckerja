import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePosOutlets } from "@/8-2-2-outlets/hooks/usePosOutlets";
import { defaultPosOutletId } from "@/8-2-2-outlets/lib/assignedOutlets";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useToast } from "@/shared/hooks/use-toast";
import { usePosAppPermissions } from "@/pos-mobile/shared/hooks/usePosAppPermissions";
import { resolvePosPostOutletPath, usePosTabletAccess } from "@/pos-mobile/shared/access";
import { POS_TABLET_ACCESS_I18N } from "@/pos-mobile/0-auth/lib/posTabletAccessCopy";
import { PosOutletSelectField } from "../components/PosOutletSelectField";
import { PosSelectOutletActions } from "../components/PosSelectOutletActions";
import { POS_OUTLET_SELECT_I18N } from "../lib/posOutletSelectCopy";
import {
  clearPosSelectedOutlet,
  readPosSelectedOutletId,
  stashPosSelectedOutlet,
} from "../lib/posSelectedOutletStorage";

/**
 * Post-auth outlet gate for Synckerja POS (after login / 2FA).
 * Authenticated route: `/pos/select-outlet` (shell from {@link PosAuthFunnelLayout}).
 * Outlets filtered by staff assignment (Owner/Admin: all active).
 */
export default function PosSelectOutletPage() {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { rows, isLoading } = usePosOutlets();
  const access = usePosTabletAccess();
  const permissions = usePosAppPermissions();

  const activeOutlets = useMemo(() => {
    const mapped = rows
      .filter((row) => row.is_active)
      .map((row) => ({
        id: row.id,
        name: row.name,
        address: row.address?.trim() || null,
      }));
    return access.filterOutlets(mapped);
  }, [access, rows]);

  const [outletId, setOutletId] = useState("");

  useEffect(() => {
    if (!access.outletsReady || access.status !== "allowed") return;
    const stashed = readPosSelectedOutletId();
    if (stashed && !access.canUseOutlet(stashed)) {
      clearPosSelectedOutlet();
      toast({
        title: t(
          POS_TABLET_ACCESS_I18N.outletInvalid,
          "That outlet is not available for your staff account. Choose another outlet.",
        ),
      });
    }
  }, [access, t, toast]);

  useEffect(() => {
    if (!outletId) return;
    if (activeOutlets.some((row) => row.id === outletId)) return;
    setOutletId("");
  }, [activeOutlets, outletId]);

  useEffect(() => {
    if (outletId || activeOutlets.length === 0) return;
    const stashed = readPosSelectedOutletId();
    if (stashed && activeOutlets.some((row) => row.id === stashed)) {
      setOutletId(stashed);
      return;
    }
    const allowedRows = rows.filter(
      (row) => row.is_active && access.canUseOutlet(row.id),
    );
    const defaultId = defaultPosOutletId(allowedRows);
    if (defaultId) setOutletId(defaultId);
  }, [activeOutlets, access, outletId, rows]);

  const onContinue = () => {
    if (permissions.isLoading) return;
    const selected = activeOutlets.find((row) => row.id === outletId);
    if (!selected) return;
    if (!access.canUseOutlet(selected.id)) {
      toast({
        title: t(
          POS_TABLET_ACCESS_I18N.outletInvalid,
          "That outlet is not available for your staff account. Choose another outlet.",
        ),
        variant: "destructive",
      });
      return;
    }
    stashPosSelectedOutlet(selected);
    navigate(
      resolvePosPostOutletPath({
        canCharge: permissions.canCharge(),
        canKitchenDisplay: permissions.canKitchenDisplay(),
      }),
      { replace: true },
    );
  };

  const empty =
    !isLoading && access.outletsReady && activeOutlets.length === 0;

  const continueDisabled =
    !outletId ||
    empty ||
    isLoading ||
    !access.outletsReady ||
    permissions.isLoading;

  return (
    <div className="flex w-full flex-col gap-4">
        <PosOutletSelectField
          value={outletId}
          onChange={setOutletId}
          options={activeOutlets}
          disabled={isLoading || empty || !access.outletsReady}
        />

        {empty ? (
          <p className="text-center text-sm text-foreground/70">
            {t(POS_OUTLET_SELECT_I18N.empty, "No active outlets available for this organization.")}
          </p>
        ) : null}

        {isLoading || !access.outletsReady || permissions.isLoading ? (
          <p className="text-center text-sm text-foreground/70">
            {t(POS_OUTLET_SELECT_I18N.loading, "Loading outlets…")}
          </p>
        ) : null}

        <PosSelectOutletActions
          disabled={continueDisabled}
          onContinue={onContinue}
        />
    </div>
  );
}

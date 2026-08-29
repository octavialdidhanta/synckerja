import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { verifyAdminPinForOutlet } from "../hooks/usePosPinAccessPolicy";

type Props = {
  open: boolean;
  outletId: string | null;
  title?: string;
  onOpenChange: (open: boolean) => void;
  onAuthorized: (adminStaffId: string) => void;
};

export function PosAdminPinDialog({
  open,
  outletId,
  title,
  onOpenChange,
  onAuthorized,
}: Props) {
  const { t } = useAppTranslation();
  const { organizationId } = useCurrentOrg();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleClose = (next: boolean) => {
    if (!next) {
      setPin("");
      setError(null);
    }
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    setError(null);
    if (!/^\d{4}$/.test(pin)) {
      setError(t("employeesStaff.pin.invalid", "PIN must be 4 digits."));
      return;
    }
    if (!organizationId || !outletId) {
      setError(t("pos.pin.missingOutlet", "Select an outlet first."));
      return;
    }
    setBusy(true);
    try {
      const staffId = await verifyAdminPinForOutlet({
        organizationId,
        outletId,
        pin,
      });
      if (!staffId) {
        setError(t("pos.pin.invalidAdmin", "Incorrect administrator PIN."));
        return;
      }
      setPin("");
      onAuthorized(staffId);
      handleClose(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pos.pin.verifyError", "PIN verification failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {title ?? t("pos.pin.authorizeTitle", "Administrator PIN required")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="pos-admin-pin">{t("employeesStaff.pin.new", "New PIN")}</Label>
          <Input
            id="pos-admin-pin"
            type="password"
            inputMode="numeric"
            maxLength={4}
            autoComplete="one-time-code"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="••••"
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="button" disabled={busy || pin.length !== 4} onClick={() => void handleConfirm()}>
            {t("common.confirm", "Confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

type Props = {
  hasPin: boolean;
  allowPinForPermissions: boolean;
  onAllowPinChange: (value: boolean) => void | Promise<void>;
  onSetPin: (pin: string) => void | Promise<void>;
  onClearPin: () => void | Promise<void>;
  busy?: boolean;
};

export function StaffPinFields({
  hasPin,
  allowPinForPermissions,
  onAllowPinChange,
  onSetPin,
  onClearPin,
  busy,
}: Props) {
  const { t } = useAppTranslation();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSave = async () => {
    setLocalError(null);
    if (!/^\d{4}$/.test(pin)) {
      setLocalError(t("employeesStaff.pin.invalid", "PIN must be 4 digits."));
      return;
    }
    if (pin !== confirm) {
      setLocalError(t("employeesStaff.pin.mismatch", "PIN confirmation does not match."));
      return;
    }
    await onSetPin(pin);
    setPin("");
    setConfirm("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            {t("employeesStaff.pin.allowTitle", "Allow PIN for in-app permission")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t(
              "employeesStaff.pin.allowHint",
              "When enabled, this staff PIN can authorize restricted POS actions.",
            )}
          </p>
        </div>
        <Switch
          checked={allowPinForPermissions}
          disabled={busy}
          onCheckedChange={(v) => void onAllowPinChange(v)}
        />
      </div>

      <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        {hasPin
          ? t("employeesStaff.pin.statusSet", "PIN is set.")
          : t("employeesStaff.pin.statusUnset", "No PIN set yet.")}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pos-staff-pin">
            {t("employeesStaff.pin.new", "New PIN")}
          </Label>
          <Input
            id="pos-staff-pin"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="••••"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pos-staff-pin-confirm">
            {t("employeesStaff.pin.confirm", "Confirm PIN")}
          </Label>
          <Input
            id="pos-staff-pin-confirm"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={4}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="••••"
          />
        </div>
      </div>

      {localError ? <p className="text-xs text-destructive">{localError}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy || !pin} onClick={() => void handleSave()}>
          {hasPin
            ? t("employeesStaff.pin.reset", "Reset PIN")
            : t("employeesStaff.pin.set", "Set PIN")}
        </Button>
        {hasPin ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void onClearPin()}
          >
            {t("employeesStaff.pin.clear", "Clear PIN")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { isUsablePosCheckoutName } from "@/5-2-customer-visits/checkout/pos-bind";
import { POS_LOYALTY_I18N } from "../../lib/posLoyaltyCopy";

type Props = {
  open: boolean;
  phoneLocal: string;
  initialName: string;
  saving: boolean;
  hideContinueWithoutName?: boolean;
  onSave: (name: string) => void;
  onContinueWithoutName?: () => void;
  onClose: () => void;
};

export function PosMemberSaveNameSheet({
  open,
  phoneLocal,
  initialName,
  saving,
  hideContinueWithoutName,
  onSave,
  onContinueWithoutName,
  onClose,
}: Props) {
  const { t } = useAppTranslation();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setError(null);
  }, [open, initialName]);

  if (!open) return null;

  const submit = () => {
    if (!isUsablePosCheckoutName(name)) {
      setError(t(POS_LOYALTY_I18N.nameTooShort, "Enter at least 2 letters."));
      return;
    }
    onSave(name.trim());
  };

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <p className="text-base font-semibold">
          {t(POS_LOYALTY_I18N.saveNameTitle, "Customer name")}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {t(POS_LOYALTY_I18N.cancel, "Cancel")}
        </Button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {t(POS_LOYALTY_I18N.phoneLocked, "Phone")}
          </p>
          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <span>+62</span>
            <span>{phoneLocal}</span>
          </div>
        </div>
        <div>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder={t(POS_LOYALTY_I18N.saveNamePlaceholder, "Full name")}
            className="h-11"
            autoFocus
          />
          {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        </div>
      </div>
      <div className="space-y-2 border-t border-slate-100 p-3">
        <Button type="button" className="h-11 w-full" disabled={saving} onClick={submit}>
          {t(POS_LOYALTY_I18N.saveName, "Save name")}
        </Button>
        {hideContinueWithoutName || !onContinueWithoutName ? null : (
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            disabled={saving}
            onClick={onContinueWithoutName}
          >
            {t(POS_LOYALTY_I18N.continueWithoutName, "Continue without a name")}
          </Button>
        )}
      </div>
    </div>
  );
}

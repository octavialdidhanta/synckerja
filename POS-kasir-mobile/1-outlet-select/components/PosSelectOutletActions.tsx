import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_OUTLET_SELECT_I18N } from "../lib/posOutletSelectCopy";

type Props = {
  disabled?: boolean;
  onContinue: () => void;
};

export function PosSelectOutletActions({ disabled, onContinue }: Props) {
  const { t } = useAppTranslation();

  return (
    <Button
      type="button"
      disabled={disabled}
      onClick={onContinue}
      className="h-12 w-full rounded-lg bg-primary text-base font-medium text-primary-foreground hover:bg-primary/90"
    >
      {t(POS_OUTLET_SELECT_I18N.continue, "Continue")}
    </Button>
  );
}

import { Badge } from "@/shared/components/ui/badge";
import { useTranslation } from "react-i18next";

type XenditSubAccountLabelProps = {
  label: string | null | undefined;
  compact?: boolean;
};

export function XenditSubAccountLabel({ label, compact = false }: XenditSubAccountLabelProps) {
  const { t } = useTranslation();
  const text = label?.trim() || t("xendit.subAccount.unknown", "—");

  return (
    <Badge
      variant="secondary"
      className={compact ? "max-w-[160px] truncate text-[9px] font-normal" : "max-w-[200px] truncate text-[10px] font-normal"}
      title={text}
    >
      {text}
    </Badge>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { cn } from "@/shared/lib/utils";
import { MIN_RECOVERY_CODE_COUNT } from "./recoveryCodes";

type Props = {
  codes: string[];
  className?: string;
  showWarning?: boolean;
};

export function MfaRecoveryCodesPanel({ codes, className, showWarning = true }: Props) {
  const { t } = useTranslation();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const copyOne = async (code: string, index: number) => {
    await navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    toast.success(t("settings.security.twoFactor.codeCopied"));
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAll = async () => {
    await navigator.clipboard.writeText(codes.join("\n"));
    setCopiedAll(true);
    toast.success(t("settings.security.twoFactor.recoveryCopied"));
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {showWarning ? (
        <Alert>
          <AlertDescription>{t("settings.security.twoFactor.recoveryWarning")}</AlertDescription>
        </Alert>
      ) : null}

      <p className="text-sm text-muted-foreground">
        {t("settings.security.twoFactor.recoveryCountHint", {
          count: Math.max(codes.length, MIN_RECOVERY_CODE_COUNT),
        })}
      </p>

      <div className="grid gap-2">
        {codes.map((code, index) => (
          <div
            key={`${code}-${index}`}
            className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5"
          >
            <span className="min-w-0 flex-1 font-mono text-sm tracking-wide">{code}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 px-2"
              onClick={() => void copyOne(code, index)}
            >
              <Copy className="h-4 w-4" />
              <span className="sr-only">{t("settings.security.twoFactor.copy")}</span>
            </Button>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => void copyAll()}>
        <Copy className="mr-2 h-4 w-4" />
        {copiedAll ? t("settings.security.twoFactor.copied") : t("settings.security.twoFactor.copyRecovery")}
      </Button>
    </div>
  );
}

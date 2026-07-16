import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";

const META_LOGO_SRC = "/meta.png";

function trustBadgeShell(compact: boolean) {
  return compact
    ? "inline-flex w-[5.5rem] shrink-0 flex-col items-start rounded-xl px-2.5 py-2 shadow-sm border border-black/[0.06] bg-[hsl(var(--brand-white))]"
    : "inline-flex w-[5.5rem] shrink-0 flex-col items-center rounded-xl px-2.5 py-2 text-center shadow-sm border border-black/[0.06] bg-[hsl(var(--brand-white))]";
}

function MetaPartnerLogo({ className }: { className?: string }) {
  return (
    <img
      src={META_LOGO_SRC}
      alt="Meta"
      className={cn("h-4 w-auto shrink-0 object-contain", className)}
    />
  );
}

type AuthRegisterTrustSignalsProps = {
  className?: string;
  compact?: boolean;
  /** Badge boxes for the left marketing panel (same row as performance badges). */
  variant?: "inline" | "panel";
};

export function AuthRegisterTrustSignals({
  className,
  compact = false,
  variant = "inline",
}: AuthRegisterTrustSignalsProps) {
  const { t } = useTranslation();
  const shell = trustBadgeShell(compact);

  const cancelBadge = (
    <div className={shell}>
      <span className="text-[10px] font-bold tracking-wide uppercase text-emerald-600">
        {t("auth.register.cancelBadgeSub")}
      </span>
      <span className="mt-0.5 text-xs font-semibold leading-snug text-slate-800">{t("auth.register.cancelAnytime")}</span>
      <span className="mt-0.5 text-[8px] leading-tight text-slate-500">{t("auth.register.cancelBadgeFoot")}</span>
    </div>
  );

  const metaBadge = (
    <div className={shell}>
      <MetaPartnerLogo className="h-4 max-w-[3rem]" />
      <span className="mt-0.5 text-xs font-semibold leading-snug text-slate-800">{t("auth.register.metaBadgeTitle")}</span>
      <span className="mt-0.5 text-[8px] leading-tight text-slate-500">{t("auth.register.metaBadgeFoot")}</span>
    </div>
  );

  if (variant === "panel") {
    return (
      <>
        {cancelBadge}
        {metaBadge}
      </>
    );
  }

  return (
    <div
      className={cn("flex flex-nowrap items-stretch justify-center gap-2", className)}
      aria-label={t("auth.register.trustSignalsAria")}
    >
      {cancelBadge}
      {metaBadge}
    </div>
  );
}

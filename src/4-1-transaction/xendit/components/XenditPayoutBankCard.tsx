import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/components/ui/badge";
import type {
  GatewayPayoutValidationStatus,
  XenditGatewayPayoutBank,
} from "@/xendit/types/xendit";

function badgeVariant(
  status: GatewayPayoutValidationStatus | undefined,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "match") return "default";
  if (status === "pending") return "secondary";
  if (status === "stale" || status === "none") return "outline";
  return "destructive";
}

function useValidationLabel(status: GatewayPayoutValidationStatus | undefined): string {
  const { t } = useTranslation();
  switch (status) {
    case "match":
      return t("xendit.payoutValidation.badgeMatch", "Terverifikasi");
    case "pending":
      return t("xendit.payoutValidation.badgePending", "Memvalidasi…");
    case "stale":
      return t("xendit.payoutValidation.badgeStale", "Perlu validasi ulang");
    case "unclear":
      return t("xendit.payoutValidation.badgeUnclear", "Nama tidak pasti");
    case "not_match":
      return t("xendit.payoutValidation.badgeNotMatch", "Nama tidak cocok");
    case "failed":
      return t("xendit.payoutValidation.badgeFailed", "Rekening tidak ditemukan");
    case "error":
      return t("xendit.payoutValidation.badgeError", "Validasi gagal");
    default:
      return t("xendit.payoutValidation.badgeNone", "Belum divalidasi");
  }
}

type Props = {
  payoutBank: XenditGatewayPayoutBank | null | undefined;
  onRevalidate?: () => void;
  revalidating?: boolean;
  compact?: boolean;
};

export function XenditPayoutBankCard({
  payoutBank,
  onRevalidate,
  revalidating,
  compact = false,
}: Props) {
  const { t } = useTranslation();
  const status = payoutBank?.gateway_payout_validation_status;
  const label = useValidationLabel(status);

  if (!payoutBank?.account_number) {
    return (
      <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-4 py-3">
        <p className="text-sm font-medium text-amber-900">
          {t("xendit.finance.noPayoutBankTitle", "Rekening tujuan belum diatur")}
        </p>
        {!compact ? (
          <p className="mt-1 text-xs text-amber-800/90">
            {t(
              "xendit.finance.noPayoutBankHint",
              "Daftarkan bisnis dengan rekening bank atau aktifkan Gateway payout di Bank Accounts.",
            )}
          </p>
        ) : null}
      </div>
    );
  }

  const bankLabel =
    payoutBank.gateway_payout_bank_code?.trim() || payoutBank.bank_name?.trim() || "—";
  const holder = payoutBank.account_holder?.trim();
  const detail = [bankLabel, payoutBank.account_number, holder ? `a.n. ${holder}` : null]
    .filter(Boolean)
    .join(" · ");

  if (compact) {
    return (
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="min-w-0 truncate text-muted-foreground">
            <span className="text-foreground">{t("xendit.finance.payoutBankLabel", "Tujuan")}:</span>{" "}
            {detail}
          </p>
          <Badge variant={badgeVariant(status)} className="shrink-0 text-[10px]">
            {label}
          </Badge>
        </div>
        {status !== "match" && onRevalidate ? (
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
            disabled={revalidating}
            onClick={onRevalidate}
          >
            {revalidating
              ? t("xendit.payoutValidation.revalidating", "Memvalidasi rekening…")
              : t("xendit.payoutValidation.revalidate", "Validasi rekening")}
          </button>
        ) : null}
        {payoutBank.gateway_payout_validation_error && status !== "match" ? (
          <p className="text-xs text-destructive">{payoutBank.gateway_payout_validation_error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("xendit.finance.payoutBankLabel", "Rekening tujuan penarikan")}
        </p>
        <Badge variant={badgeVariant(status)} className="text-[10px]">
          {label}
        </Badge>
      </div>
      <p className="mt-2 text-base font-semibold text-gray-900">{bankLabel}</p>
      <p className="mt-0.5 font-mono text-sm text-gray-700">{payoutBank.account_number}</p>
      {holder ? <p className="mt-0.5 text-sm text-muted-foreground">a.n. {holder}</p> : null}
      {payoutBank.gateway_payout_validated_holder &&
      payoutBank.gateway_payout_validated_holder !== payoutBank.account_holder ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {t("xendit.payoutValidation.bankRecordName", "Nama di bank")}:{" "}
          {payoutBank.gateway_payout_validated_holder}
        </p>
      ) : null}
      {payoutBank.gateway_payout_validated_at ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {t("xendit.payoutValidation.validatedAt", "Divalidasi")}:{" "}
          {new Date(payoutBank.gateway_payout_validated_at).toLocaleString("id-ID")}
        </p>
      ) : null}
      {payoutBank.gateway_payout_validation_error && status !== "match" ? (
        <p className="mt-2 text-xs text-destructive">{payoutBank.gateway_payout_validation_error}</p>
      ) : null}
      {status !== "match" && onRevalidate ? (
        <button
          type="button"
          className="mt-3 text-xs font-medium text-primary hover:underline disabled:opacity-50"
          disabled={revalidating}
          onClick={onRevalidate}
        >
          {revalidating
            ? t("xendit.payoutValidation.revalidating", "Memvalidasi rekening…")
            : t("xendit.payoutValidation.revalidate", "Validasi rekening")}
        </button>
      ) : null}
    </div>
  );
}

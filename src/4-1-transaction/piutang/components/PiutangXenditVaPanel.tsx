import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useXenditOrgSettings } from "@/xendit/hooks/useXenditOrgSettings";
import { createPiutangVa } from "@/xendit/lib/xenditApi";
import { computeVaNetAmount } from "@/xendit/lib/vaNetAmount";
import { XENDIT_SETTINGS_PATH } from "@/xendit/lib/xenditPaths";
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import { shouldOfferPiutangVaCollection } from "../utils/piutangVaCollection";

type Props = {
  organizationId: string | null | undefined;
  paymentId: string;
  paymentAmount: number;
  clientName?: string;
  verificationStatus?: string | null;
  paymentMethod?: string | null;
  receiptUrl?: string | null;
  onCreated?: () => void;
};

function isSplitNotReadyError(message: string): boolean {
  return message.includes("xendit_platform_split_not_ready");
}

export function PiutangXenditVaPanel({
  organizationId,
  paymentId,
  paymentAmount,
  clientName,
  verificationStatus,
  paymentMethod,
  receiptUrl,
  onCreated,
}: Props) {
  const { t } = useTranslation();
  const { data: settings } = useXenditOrgSettings(organizationId);
  const [bankCode, setBankCode] = useState("BCA");
  const [loading, setLoading] = useState(false);
  const [vaInfo, setVaInfo] = useState<{
    account_number: string;
    bank_code: string;
    expected_amount: number;
  } | null>(null);

  if (!settings?.serverConfigured || !settings.account?.is_enabled) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("xendit.notEnabled", "Enable Xendit in Settings to generate Virtual Account.")}{" "}
        <Link to={XENDIT_SETTINGS_PATH} className="text-blue-600 underline">
          {t("xendit.settingsTitle", "Xendit Banking")}
        </Link>
      </p>
    );
  }

  if (verificationStatus === "approved") {
    return null;
  }

  if (
    !shouldOfferPiutangVaCollection({
      transferVerificationStatus: verificationStatus,
      paymentMethod,
      receiptUrl,
    })
  ) {
    return null;
  }

  const flatFee = settings.platformConfig?.flat_fee_amount ?? 0;
  const netAmount = computeVaNetAmount(paymentAmount, flatFee);
  const splitReady = settings.platformSplitReady ?? Boolean(settings.platformConfig?.split_rule_id);

  const handleCreate = async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await createPiutangVa(organizationId, paymentId, bankCode, clientName);
      const va = res.va;
      setVaInfo({
        account_number: va.account_number ?? "—",
        bank_code: va.bank_code,
        expected_amount: Number(va.expected_amount),
      });
      toast.success(t("xendit.vaCreated", "VA siap — bagikan ke klien untuk pembayaran"));
      onCreated?.();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (isSplitNotReadyError(message)) {
        toast.error(
          t(
            "xendit.platformSplitNotReady",
            "Pembayaran VA sementara tidak tersedia. Hubungi administrator platform.",
          ),
        );
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 space-y-3 rounded-md border border-dashed border-blue-200 bg-blue-50/50 p-3">
      <div>
        <p className="text-sm font-medium text-blue-900">
          {t("xendit.piutangVaTitle", "Terima pembayaran via Virtual Account")}
        </p>
        <p className="mt-0.5 text-xs text-blue-800/80">
          {t(
            "xendit.piutangVaHint",
            "Buat VA dan bagikan nomor rekening virtual ke klien — mereka transfer ke Anda, bukan Anda yang bayar.",
          )}
        </p>
      </div>
      {!splitReady ? (
        <Alert variant="default" className="border-amber-200 bg-amber-50/80">
          <AlertDescription className="text-xs text-amber-900">
            {t(
              "xendit.platformSplitNotReadyPanel",
              "Pembayaran VA sementara tidak tersedia karena konfigurasi biaya platform belum aktif. Hubungi administrator platform Synckerja.",
            )}
          </AlertDescription>
        </Alert>
      ) : null}
      {vaInfo ? (
        <div className="space-y-1 text-sm">
          <p className="text-xs font-medium text-blue-900">
            {t("xendit.piutangVaShare", "Kirim ke klien untuk pembayaran")}
          </p>
          <p>
            <span className="text-muted-foreground">{t("xendit.bank", "Bank")}: </span>
            {vaInfo.bank_code}
          </p>
          <p className="font-mono font-semibold">{vaInfo.account_number}</p>
          <p>
            <span className="text-muted-foreground">{t("xendit.amount", "Amount")}: </span>
            {formatToRupiah(vaInfo.expected_amount)}
          </p>
        </div>
      ) : splitReady ? (
        <>
          {flatFee > 0 ? (
            <p className="text-[11px] text-blue-800/90">
              {t(
                "xendit.piutangVaNetHint",
                "Setelah dibayar, biaya platform {{fee}} dipotong otomatis. Anda terima net {{net}}.",
                {
                  fee: formatToRupiah(flatFee),
                  net: formatToRupiah(netAmount),
                },
              )}
            </p>
          ) : null}
          <div>
            <Label>{t("xendit.selectBank", "Bank VA")}</Label>
            <Select value={bankCode} onValueChange={setBankCode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(settings.vaBanks ?? []).map((b) => (
                  <SelectItem key={b.code} value={b.code}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={handleCreate} disabled={loading}>
            {loading
              ? t("xendit.creating", "Creating…")
              : t("xendit.generateVa", "Buat VA untuk klien")}
          </Button>
        </>
      ) : null}
    </div>
  );
}

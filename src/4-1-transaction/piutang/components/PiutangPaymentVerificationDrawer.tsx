import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import { useToast } from '@/shared/components/ui/use-toast';
import { getIncomeReceiptDisplayUrl } from '@/4-1-transaction/utils/incomeReceiptDownload';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import {
  isManualBankTransferPayment,
  isXenditVaPayment,
} from '../utils/piutangVaCollection';
import {
  useSuggestedMatchesForPayment,
  useBankMutations,
} from '@/shared/hooks/finance/useBankMutations';
import { format } from 'date-fns';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

type VerificationStatus = 'unchecked' | 'approved' | 'rejected';

type PaymentRow = {
  id: string;
  payment_amount?: number;
  payment_date?: string;
  payment_method?: string;
  receipt_url?: string | null;
  transfer_verification_status?: VerificationStatus | null;
};

type PiutangPaymentVerificationDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null | undefined;
  salesActivityId: string | null;
  clientLabel: string;
  getPaymentHistory: (id: string) => Promise<unknown[]>;
  updatePaymentVerification: (params: {
    paymentId: string;
    status: VerificationStatus;
    verifiedByUserId: string | null | undefined;
  }) => Promise<void>;
  userId: string | null | undefined;
};

const statusLabel: Record<VerificationStatus, string> = {
  unchecked: 'Belum dicek',
  approved: 'OK',
  rejected: 'Ditolak',
};

function receiptPreviewKind(url: string): 'image' | 'pdf' | 'unknown' {
  const path = (url.split('?')[0] ?? '').toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(path)) return 'image';
  if (/\.pdf$/i.test(path)) return 'pdf';
  return 'unknown';
}

/** `pathOrUrl`: storage path (e.g. `org/…/file.jpg`) or full URL — resolved to signed URL for `<img>` / `<iframe>`. */
function PaymentReceiptInlinePreview({ pathOrUrl }: { pathOrUrl: string }) {
  const kindFromPath = receiptPreviewKind(pathOrUrl);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState(false);
  const [unknownFallbackToFrame, setUnknownFallbackToFrame] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setResolvedUrl(null);
    setResolveError(false);
    setUnknownFallbackToFrame(false);
    void getIncomeReceiptDisplayUrl(pathOrUrl).then((url) => {
      if (cancelled) return;
      if (!url) {
        setResolveError(true);
        return;
      }
      setResolvedUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [pathOrUrl]);

  const frameWrap = 'mt-2 overflow-auto rounded-md border border-border bg-muted/20';

  if (resolveError) {
    return (
      <p className="mt-2 text-xs text-destructive">
        Bukti tidak dapat dimuat (izin penyimpanan atau path tidak valid).
      </p>
    );
  }

  if (!resolvedUrl) {
    return <p className="mt-2 text-xs text-muted-foreground">Memuat bukti…</p>;
  }

  if (kindFromPath === 'pdf') {
    return (
      <div className={`${frameWrap} overflow-hidden p-0`}>
        <iframe title="Bukti pembayaran (PDF)" src={resolvedUrl} className="h-[min(400px,52vh)] w-full border-0" />
      </div>
    );
  }

  if (kindFromPath === 'image') {
    return (
      <div className={`${frameWrap} p-1`}>
        <img
          src={resolvedUrl}
          alt="Bukti pembayaran"
          className="mx-auto block max-h-[min(400px,52vh)] w-auto max-w-full object-contain"
          loading="lazy"
        />
      </div>
    );
  }

  if (!unknownFallbackToFrame) {
    return (
      <div className={`${frameWrap} p-1`}>
        <img
          src={resolvedUrl}
          alt="Bukti pembayaran"
          className="mx-auto block max-h-[min(400px,52vh)] w-auto max-w-full object-contain"
          loading="lazy"
          onError={() => setUnknownFallbackToFrame(true)}
        />
      </div>
    );
  }

  return (
    <div className={`${frameWrap} overflow-hidden p-0`}>
      <iframe title="Bukti pembayaran" src={resolvedUrl} className="h-[min(400px,52vh)] w-full border-0" />
    </div>
  );
}

function PiutangMutationMatchBanner({
  paymentId,
  onConfirmed,
}: {
  paymentId: string;
  onConfirmed?: () => void;
}) {
  const { t } = useAppTranslation();
  const { data: matches = [], isLoading } = useSuggestedMatchesForPayment(paymentId);
  const { confirmMatch, confirmingMatch } = useBankMutations({
    bankAccountId: 'all',
    direction: 'all',
    matchFilter: 'all',
  });

  if (isLoading) return null;
  const match = matches[0];
  if (!match?.statement_line) return null;

  const line = match.statement_line;

  const handleConfirm = async () => {
    await confirmMatch(match.id);
    onConfirmed?.();
  };

  return (
    <div className="mt-3 rounded-md border border-green-200 bg-green-50 p-2 text-xs text-green-900">
      <p className="font-medium">
        {t('incomes.brick.piutangBannerTitle', 'Mutasi bank cocok')}
      </p>
      <p className="mt-1 text-green-800">
        {formatToRupiah(line.amount)} ·{' '}
        {format(new Date(line.transaction_date), 'dd/MM/yyyy HH:mm')}
        {line.description ? ` · ${line.description}` : ''}
      </p>
      <Button
        type="button"
        size="sm"
        className="mt-2 h-8"
        disabled={confirmingMatch}
        onClick={() => void handleConfirm()}
      >
        {t('incomes.brick.confirmDepositFromMutasi', 'Konfirmasi deposit dari mutasi')}
      </Button>
    </div>
  );
}

export function PiutangPaymentVerificationDrawer({
  open,
  onOpenChange,
  organizationId,
  salesActivityId,
  clientLabel,
  getPaymentHistory,
  updatePaymentVerification,
  userId,
}: PiutangPaymentVerificationDrawerProps) {
  const { toast } = useToast();
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Record<string, VerificationStatus>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [receiptOpenByPayment, setReceiptOpenByPayment] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!salesActivityId) return;
    setLoading(true);
    try {
      const data = (await getPaymentHistory(salesActivityId)) as PaymentRow[];
      setRows(Array.isArray(data) ? data : []);
      const next: Record<string, VerificationStatus> = {};
      for (const p of data || []) {
        const s = (p.transfer_verification_status as VerificationStatus) || 'unchecked';
        next[p.id] = s === 'approved' || s === 'rejected' ? s : 'unchecked';
      }
      setDraft(next);
    } catch (e) {
      console.error(e);
      toast({ title: 'Gagal memuat', description: 'Tidak dapat memuat riwayat pembayaran.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [getPaymentHistory, salesActivityId, toast]);

  useEffect(() => {
    if (open && salesActivityId) {
      void load();
    }
  }, [open, salesActivityId, load]);

  useEffect(() => {
    if (!open) setReceiptOpenByPayment({});
  }, [open]);

  const saveRow = async (paymentId: string) => {
    const status = draft[paymentId] ?? 'unchecked';
    try {
      setSavingId(paymentId);
      await updatePaymentVerification({
        paymentId,
        status,
        verifiedByUserId: userId,
      });
      toast({ title: 'Tersimpan', description: 'Status verifikasi diperbarui.' });
      await load();
    } catch (e) {
      console.error(e);
      toast({ title: 'Gagal', description: 'Tidak dapat menyimpan verifikasi.', variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden sm:max-w-lg">
        <SheetHeader className="flex-shrink-0 border-b border-border pb-4 text-left">
          <SheetTitle>Verifikasi pembayaran</SheetTitle>
          <SheetDescription>
            {clientLabel}
            {salesActivityId ? ` · aktivitas ${salesActivityId.slice(0, 8)}…` : ''}
          </SheetDescription>
          <p className="mt-1 text-xs text-muted-foreground">
            Cocokkan bukti transfer dengan mutasi rekening. Koleksi via VA: menu &quot;Koleksi VA&quot;.
          </p>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Memuat…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada pembayaran.</p>
          ) : (
            <ul className="space-y-4">
              {rows.map((p) => {
                const xenditAuto = isXenditVaPayment(p.payment_method);
                const showManualVerify =
                  isManualBankTransferPayment({
                    paymentMethod: p.payment_method,
                    receiptUrl: p.receipt_url,
                  }) || (!xenditAuto && Boolean(p.receipt_url));

                return (
                <li key={p.id} className="rounded-lg border border-border bg-card p-3 shadow-sm">
                  <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
                    <span className="font-medium tabular-nums">{formatToRupiah(Number(p.payment_amount ?? 0))}</span>
                    <span className="text-xs text-muted-foreground">{p.payment_date ?? '—'}</span>
                  </div>
                  <div className="mb-2 text-xs text-muted-foreground">
                    Metode: {String(p.payment_method ?? '—').replace(/_/g, ' ')}
                  </div>
                  {p.receipt_url ? (
                    <div className="space-y-0">
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto px-0 py-0 text-xs"
                        onClick={() =>
                          setReceiptOpenByPayment((prev) => ({
                            ...prev,
                            [p.id]: !prev[p.id],
                          }))
                        }
                      >
                        {receiptOpenByPayment[p.id] ? 'Sembunyikan bukti' : 'Tampilkan bukti'}
                      </Button>
                      {receiptOpenByPayment[p.id] ? (
                        <PaymentReceiptInlinePreview pathOrUrl={String(p.receipt_url)} />
                      ) : null}
                    </div>
                  ) : null}

                  {xenditAuto ? (
                    <p className="mt-3 text-xs font-medium text-green-700">Otomatis (Xendit VA)</p>
                  ) : showManualVerify ? (
                  <div className="mt-3 space-y-2">
                    <PiutangMutationMatchBanner paymentId={p.id} onConfirmed={() => void load()} />
                    <Label className="text-xs">Verifikasi transfer</Label>
                    <div className="flex flex-wrap items-end gap-2">
                      <Select
                        value={draft[p.id] ?? 'unchecked'}
                        onValueChange={(v) =>
                          setDraft((prev) => ({ ...prev, [p.id]: v as VerificationStatus }))
                        }
                      >
                        <SelectTrigger className="h-9 w-[160px] text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(statusLabel) as VerificationStatus[]).map((k) => (
                            <SelectItem key={k} value={k}>
                              {statusLabel[k]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="sm"
                        className="h-9"
                        disabled={savingId === p.id}
                        onClick={() => void saveRow(p.id)}
                      >
                        {savingId === p.id ? 'Menyimpan…' : 'Simpan'}
                      </Button>
                    </div>
                  </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Verifikasi manual hanya untuk transfer bank dengan bukti. Gunakan Koleksi VA
                      jika klien belum bayar.
                    </p>
                  )}
                </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

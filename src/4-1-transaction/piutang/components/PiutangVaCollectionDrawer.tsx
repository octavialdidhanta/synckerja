import { useCallback, useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import { useToast } from '@/shared/components/ui/use-toast';
import { formatToRupiah } from '@/shared/utils/formatCurrency';
import { PiutangXenditVaPanel } from './PiutangXenditVaPanel';
import { PiutangBrickVaPanel } from './PiutangBrickVaPanel';
import { shouldOfferPiutangVaCollection } from '../utils/piutangVaCollection';

type PaymentRow = {
  id: string;
  payment_amount?: number;
  payment_date?: string;
  payment_method?: string;
  receipt_url?: string | null;
  transfer_verification_status?: string | null;
};

type PiutangVaCollectionDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null | undefined;
  salesActivityId: string | null;
  clientLabel: string;
  getPaymentHistory: (id: string) => Promise<unknown[]>;
};

export function PiutangVaCollectionDrawer({
  open,
  onOpenChange,
  organizationId,
  salesActivityId,
  clientLabel,
  getPaymentHistory,
}: PiutangVaCollectionDrawerProps) {
  const { toast } = useToast();
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!salesActivityId) return;
    setLoading(true);
    try {
      const data = (await getPaymentHistory(salesActivityId)) as PaymentRow[];
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast({
        title: 'Gagal memuat',
        description: 'Tidak dapat memuat riwayat pembayaran.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [getPaymentHistory, salesActivityId, toast]);

  useEffect(() => {
    if (open && salesActivityId) {
      void load();
    }
  }, [open, salesActivityId, load]);

  const vaRows = rows.filter((p) =>
    shouldOfferPiutangVaCollection({
      transferVerificationStatus: p.transfer_verification_status,
      paymentMethod: p.payment_method,
      receiptUrl: p.receipt_url,
    }),
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden sm:max-w-lg">
        <SheetHeader className="flex-shrink-0 border-b border-border pb-4 text-left">
          <SheetTitle>Koleksi via Virtual Account</SheetTitle>
          <SheetDescription>
            {clientLabel}
            {salesActivityId ? ` · aktivitas ${salesActivityId.slice(0, 8)}…` : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Memuat…</p>
          ) : vaRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Tidak ada cicilan yang memenuhi syarat untuk VA (sudah lunas, sudah ada bukti transfer
              manual, atau sudah diverifikasi).
            </p>
          ) : (
            <ul className="space-y-4">
              {vaRows.map((p) => (
                <li key={p.id} className="rounded-lg border border-border bg-card p-3 shadow-sm">
                  <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
                    <span className="font-medium tabular-nums">
                      {formatToRupiah(Number(p.payment_amount ?? 0))}
                    </span>
                    <span className="text-xs text-muted-foreground">{p.payment_date ?? '—'}</span>
                  </div>
                  <PiutangXenditVaPanel
                    organizationId={organizationId}
                    paymentId={p.id}
                    paymentAmount={Number(p.payment_amount ?? 0)}
                    clientName={clientLabel}
                    verificationStatus={p.transfer_verification_status}
                    paymentMethod={p.payment_method}
                    receiptUrl={p.receipt_url}
                    onCreated={() => void load()}
                  />
                  <PiutangBrickVaPanel
                    organizationId={organizationId}
                    paymentId={p.id}
                    paymentAmount={Number(p.payment_amount ?? 0)}
                    clientName={clientLabel}
                    verificationStatus={p.transfer_verification_status}
                    paymentMethod={p.payment_method}
                    receiptUrl={p.receipt_url}
                    onCreated={() => void load()}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

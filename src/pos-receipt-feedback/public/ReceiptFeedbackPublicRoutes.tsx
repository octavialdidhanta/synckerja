import { format } from 'date-fns';
import { Loader2, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { cn } from '@/shared/lib/utils';
import { usePublicReceiptFeedbackForm } from '../hooks/usePublicReceiptFeedbackForm';
import { PosPublicReceiptBreakdown } from '../components/PosPublicReceiptBreakdown';
import { isGenericCustomerName } from '../lib/isGenericCustomerName';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Document scroll for /r/* — app shell defaults body/#root to overflow-hidden. */
export function ReceiptFeedbackPublicShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.classList.add('allow-page-scroll');
    document.getElementById('root')?.classList.add('allow-page-scroll');
    return () => {
      document.body.classList.remove('allow-page-scroll');
      document.getElementById('root')?.classList.remove('allow-page-scroll');
    };
  }, []);

  return (
    <div className="min-h-[100dvh] bg-background font-sans text-foreground antialiased">
      {children}
    </div>
  );
}

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          className={cn(
            'rounded p-1 transition-colors',
            disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-muted',
          )}
          aria-label={`${star} star`}
        >
          <Star
            className={cn(
              'h-8 w-8',
              value != null && star <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground',
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function ReceiptFeedbackPublicFormPage() {
  const { token: rawToken } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const token = (rawToken ?? '').trim();
  const { formQuery, submitMutation } = usePublicReceiptFeedbackForm(token);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');

  const invalidToken = token.length > 0 && !UUID_RE.test(token);

  const receiptDate = useMemo(() => {
    const tx = formQuery.data?.transaction;
    if (!tx) return '—';
    if (tx.created_at) {
      const d = new Date(tx.created_at);
      if (!Number.isNaN(d.getTime())) return format(d, 'dd MMM yyyy HH:mm');
    }
    return tx.date || '—';
  }, [formQuery.data?.transaction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating == null) return;
    try {
      const res = await submitMutation.mutateAsync({ rating, comment });
      navigate(`/r/${token}/thanks`, { replace: true, state: { message: res.thankYouMessage } });
    } catch {
      /* surfaced below */
    }
  };

  if (invalidToken) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold">Invalid link</p>
        <p className="text-sm text-muted-foreground">This receipt link is not valid.</p>
      </div>
    );
  }

  if (formQuery.isPending) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
        <span className="sr-only">Loading receipt</span>
      </div>
    );
  }

  if (formQuery.isError || !formQuery.data) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold">Receipt unavailable</p>
        <p className="text-sm text-muted-foreground">This link may have expired or is no longer valid.</p>
      </div>
    );
  }

  const d = formQuery.data;
  const tx = d.transaction;
  const readOnly = d.alreadySubmitted;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col gap-6 p-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <PosPublicReceiptBreakdown
        businessName={d.businessName}
        outletName={d.outletName}
        customerName={isGenericCustomerName(d.customerName) ? '' : d.customerName}
        footerNotes={d.footerNotes}
        receiptDate={receiptDate}
        transaction={tx}
      />

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="mb-1 text-base font-semibold">How was your experience?</h2>
        <p className="mb-4 text-sm text-muted-foreground">Rate your visit from 1 (poor) to 5 (excellent).</p>

        {readOnly ? (
          <div className="space-y-3">
            <StarRating value={d.rating} onChange={() => undefined} disabled />
            {d.comment ? <p className="text-sm">&ldquo;{d.comment}&rdquo;</p> : null}
            {d.replyText ? (
              <div className="rounded-md bg-muted/60 p-3 text-sm">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Reply from business</p>
                <p>{d.replyText}</p>
              </div>
            ) : null}
            <p className="text-sm text-muted-foreground">Thank you — your feedback has been submitted.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <StarRating value={rating} onChange={setRating} />
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us more (optional)"
              rows={3}
            />
            {submitMutation.isError ? (
              <p className="text-sm text-destructive">Could not submit feedback. Please try again.</p>
            ) : null}
            <Button type="submit" disabled={rating == null || submitMutation.isPending} className="w-full">
              {submitMutation.isPending ? 'Submitting…' : 'Submit feedback'}
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}

export function ReceiptFeedbackPublicThanksPage() {
  const location = useLocation();
  const { token } = useParams<{ token: string }>();
  const message =
    (location.state as { message?: string } | null)?.message ?? 'Thank you for your feedback!';

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-bold">Thank you!</h1>
      <p className="text-muted-foreground">{message}</p>
      {token ? (
        <Button variant="outline" onClick={() => window.location.assign(`/r/${token}`)}>
          View receipt
        </Button>
      ) : null}
    </div>
  );
}

export function ReceiptFeedbackPublicRoutes() {
  return (
    <Routes>
      <Route path="/r/:token/thanks" element={<ReceiptFeedbackPublicThanksPage />} />
      <Route path="/r/:token" element={<ReceiptFeedbackPublicFormPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

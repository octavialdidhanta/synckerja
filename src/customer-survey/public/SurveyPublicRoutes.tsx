import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { usePublicSurveyForm } from "@/features/customer-survey/hooks/usePublicSurveyForm";
import { deriveFollowUpQuestionLabel } from "@/features/customer-survey/core/followUpLabel";
import { SurveyFormDesktop } from "@/features/customer-survey/public/desktop/SurveyForm.desktop";
import { SurveyFormMobile } from "@/features/customer-survey/public/mobile/SurveyForm.mobile";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Full-viewport shell for anonymous CES survey (standalone subdomain or `/s/*` on main domain). */
export function SurveyPublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">{children}</div>
  );
}

export function CustomerSurveyPublicFormPage() {
  const { token: rawToken } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const token = (rawToken ?? "").trim();

  const { formQuery, submitMutation } = usePublicSurveyForm(token);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  const invalidToken = token.length > 0 && !UUID_RE.test(token);

  const followLabel = useMemo(() => {
    if (!formQuery.data) return null;
    const d = formQuery.data;
    return deriveFollowUpQuestionLabel(d.follow_up_mode, rating, {
      follow_up_single: d.follow_up_single,
      follow_up_low: d.follow_up_low,
      follow_up_mid: d.follow_up_mid,
      follow_up_high: d.follow_up_high,
    });
  }, [formQuery.data, rating]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating == null) return;
    try {
      const res = await submitMutation.mutateAsync({ rating, comment });
      navigate(`/s/${token}/thanks`, { replace: true, state: { message: res.thank_you_message } });
    } catch {
      /* surfaced in form */
    }
  };

  if (invalidToken) {
    return (
      <>
        <SurveyFormDesktop variant="invalid" />
        <SurveyFormMobile variant="invalid" />
      </>
    );
  }

  if (formQuery.isPending) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
        <span className="sr-only">Memuat survei</span>
      </div>
    );
  }

  if (formQuery.isError || !formQuery.data) {
    return (
      <>
        <SurveyFormDesktop variant="unavailable" />
        <SurveyFormMobile variant="unavailable" />
      </>
    );
  }

  const d = formQuery.data;

  const shared = {
    variant: "form" as const,
    title: d.survey_page_title,
    question: d.question_text,
    rating,
    onRatingChange: setRating,
    minLabel: d.scale_min_label,
    maxLabel: d.scale_max_label,
    followLabel,
    comment,
    onCommentChange: setComment,
    onSubmit: handleSubmit,
    submitting: submitMutation.isPending,
    submitError: submitMutation.isError,
    ratingMissing: rating == null,
  };

  return (
    <>
      <SurveyFormDesktop {...shared} />
      <SurveyFormMobile {...shared} />
    </>
  );
}

export function CustomerSurveyPublicThanksPage() {
  const { token } = useParams<{ token: string }>();
  const location = useLocation();
  const msg = (location.state as { message?: string } | null)?.message?.trim();

  return (
    <>
      <SurveyFormDesktop variant="thanks" message={msg || "Terima kasih atas masukan Anda."} />
      <SurveyFormMobile variant="thanks" message={msg || "Terima kasih atas masukan Anda."} />
      <span className="sr-only">Token survei {token}</span>
    </>
  );
}

/** Standalone hostname mini-app: own `<Routes>` under `BrowserRouter`. */
export function SurveyPublicRoutes() {
  return (
    <SurveyPublicShell>
      <Routes>
        <Route path="/s/:token/thanks" element={<CustomerSurveyPublicThanksPage />} />
        <Route path="/s/:token" element={<CustomerSurveyPublicFormPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SurveyPublicShell>
  );
}

import { useTranslation } from "react-i18next";

interface PerformanceBadge {
  id: string;
  type: "best" | "lead" | "easy";
  titleKey: string;
  subtitleKey: string;
  periodKey: string;
}

interface Testimonial {
  id: string;
  quoteKey: string;
  authorKey: string;
  positionKey: string;
}

type AuthTestimonialsPanelProps = {
  /** Tighter full-height scroll (e.g. Terms + fillViewport); default is centered marketing column. */
  compact?: boolean;
};

export function AuthTestimonialsPanel({ compact = false }: AuthTestimonialsPanelProps) {
  const { t } = useTranslation();

  const performanceBadges: PerformanceBadge[] = [
    {
      id: "best-support",
      type: "best",
      titleKey: "auth.panel.badgeBestTitle",
      subtitleKey: "auth.panel.badgeBestSub",
      periodKey: "auth.panel.badgeBestPeriod",
    },
    {
      id: "leader",
      type: "lead",
      titleKey: "auth.panel.badgeLeadTitle",
      subtitleKey: "auth.panel.badgeLeadSub",
      periodKey: "auth.panel.badgeLeadPeriod",
    },
    {
      id: "easiest",
      type: "easy",
      titleKey: "auth.panel.badgeEasyTitle",
      subtitleKey: "auth.panel.badgeEasySub",
      periodKey: "auth.panel.badgeEasyPeriod",
    },
  ];

  const testimonials: Testimonial[] = [
    { id: "1", quoteKey: "auth.panel.quote1", authorKey: "auth.panel.author1", positionKey: "auth.panel.role1" },
    { id: "2", quoteKey: "auth.panel.quote2", authorKey: "auth.panel.author2", positionKey: "auth.panel.role2" },
    { id: "3", quoteKey: "auth.panel.quote3", authorKey: "auth.panel.author3", positionKey: "auth.panel.role3" },
  ];

  const badgeShell = compact
    ? "inline-flex flex-col items-start rounded-xl px-3 py-2 shadow-sm border border-black/[0.06]"
    : "inline-flex flex-col items-center rounded-xl px-3 py-2 text-center shadow-sm border border-black/[0.06]";

  const PerformanceBadge = ({ badge }: { badge: PerformanceBadge }) => (
    <div className={badgeShell}>
      <span
        className={`text-[10px] font-bold tracking-wide uppercase ${
          badge.type === "best"
            ? "text-[hsl(var(--brand-blue))]"
            : badge.type === "lead"
              ? "text-[hsl(var(--brand-red))]"
              : "text-violet-700"
        }`}
      >
        {t(badge.subtitleKey)}
      </span>
      <span className="text-xs font-semibold text-slate-800 mt-0.5">{t(badge.titleKey)}</span>
      <span className="text-[10px] text-slate-500">{t(badge.periodKey)}</span>
    </div>
  );

  const TestimonialQuote = ({ item }: { item: Testimonial }) => (
    <div
      className={`rounded-xl bg-[hsl(var(--brand-white))] p-5 shadow-md border border-slate-200/80 ${compact ? "text-left" : "text-center"}`}
    >
      <blockquote className="text-slate-800 text-base leading-relaxed font-medium">
        &ldquo;{t(item.quoteKey)}&rdquo;
      </blockquote>
      <p className="mt-3 text-sm text-slate-600">
        — {t(item.authorKey)}, <span className="text-[hsl(var(--brand-blue))]">{t(item.positionKey)}</span>
      </p>
    </div>
  );

  const inner = (
    <div className={compact ? "mx-auto w-full max-w-lg space-y-8" : "mx-auto w-full max-w-lg space-y-8 text-center"}>
      <header>
        <h2
          className={
            compact
              ? "text-3xl font-bold tracking-tight text-slate-900 leading-tight"
              : "text-3xl font-bold tracking-tight text-slate-900 leading-tight text-center"
          }
        >
          {t("auth.panel.headline")}
        </h2>
      </header>
      <section className={compact ? "flex flex-wrap gap-3" : "flex flex-wrap justify-center gap-3"}>
        {performanceBadges.map((badge) => (
          <PerformanceBadge key={badge.id} badge={badge} />
        ))}
      </section>
      <section className="space-y-4">
        {testimonials.map((item) => (
          <TestimonialQuote key={item.id} item={item} />
        ))}
      </section>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[hsl(var(--auth-split-bg))] text-[hsl(var(--auth-panel-foreground))]">
      <div
        className={
          compact
            ? "flex flex-1 min-h-0 flex-col justify-center overflow-x-hidden overflow-y-auto seamless-scroll px-8 py-10 lg:px-12 lg:py-14"
            : "flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-x-hidden overflow-y-auto seamless-scroll px-8 py-10 lg:min-h-0 lg:px-12 lg:py-14"
        }
      >
        {inner}
      </div>
    </div>
  );
}

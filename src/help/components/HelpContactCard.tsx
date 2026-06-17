import { useCallback } from "react";
import { LifeBuoy, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import {
  SUPPORT_EMAIL,
  supportGmailComposeHref,
  supportMailtoHref,
} from "@/help/constants/helpContact";

export function HelpContactCard() {
  const { t } = useTranslation();

  const handleCopyEmail = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      toast.success(t("help.contact.copySuccess", "Email copied"));
    } catch {
      toast.error(t("help.contact.copyFailed", "Could not copy email"));
    }
  }, [t]);

  const gmailHref = supportGmailComposeHref();

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LifeBuoy className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-foreground">
            {t("help.contact.title", "Contact support")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("help.contact.description", "Email us and we will get back to you.")}
          </p>
          <a
            href={supportMailtoHref()}
            className="mt-4 inline-flex items-center gap-2 text-base font-medium text-primary hover:underline"
          >
            <Mail className="h-4 w-4 shrink-0" aria-hidden />
            {SUPPORT_EMAIL}
          </a>
          <p className="mt-3 text-xs text-muted-foreground">
            {t(
              "help.contact.responseTime",
              "We typically respond within 1–2 business days.",
            )}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyEmail()}>
              {t("help.contact.copyEmail", "Copy email")}
            </Button>
            <Button size="sm" asChild>
              <a href={gmailHref} target="_blank" rel="noopener noreferrer">
                {t("help.contact.openInGmail", "Open in Gmail")}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

HelpContactCard.displayName = "HelpContactCard";

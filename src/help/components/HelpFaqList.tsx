import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/components/ui/accordion";
import { HELP_FAQ_ITEMS } from "@/help/content/helpFaqItems";

export function HelpFaqList() {
  const { t } = useTranslation();

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <h2 className="text-lg font-semibold text-foreground">
        {t("help.faq.title", "Frequently asked questions")}
      </h2>
      <Accordion type="single" collapsible className="mt-4 w-full">
        {HELP_FAQ_ITEMS.map((item) => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger className="text-left text-sm font-medium text-foreground">
              {t(item.questionKey)}
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
              <p>{t(item.answerKey)}</p>
              {item.linkTo && item.linkLabelKey ? (
                <p className="mt-2">
                  <a
                    href={item.linkTo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    {t(item.linkLabelKey)}
                  </a>
                </p>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

HelpFaqList.displayName = "HelpFaqList";

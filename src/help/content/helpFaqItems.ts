export type HelpFaqItem = {
  id: string;
  questionKey: string;
  answerKey: string;
  linkTo?: string;
  linkLabelKey?: string;
};

export const HELP_FAQ_ITEMS: HelpFaqItem[] = [
  {
    id: "contact",
    questionKey: "help.faq.items.contact.q",
    answerKey: "help.faq.items.contact.a",
  },
  {
    id: "access",
    questionKey: "help.faq.items.access.q",
    answerKey: "help.faq.items.access.a",
  },
  {
    id: "integrations",
    questionKey: "help.faq.items.integrations.q",
    answerKey: "help.faq.items.integrations.a",
  },
  {
    id: "privacy",
    questionKey: "help.faq.items.privacy.q",
    answerKey: "help.faq.items.privacy.a",
    linkTo: "/policy/privacy",
    linkLabelKey: "help.faq.items.privacy.link",
  },
  {
    id: "terms",
    questionKey: "help.faq.items.terms.q",
    answerKey: "help.faq.items.terms.a",
    linkTo: "/policy/terms",
    linkLabelKey: "help.faq.items.terms.link",
  },
];

import { z } from "zod";

export const FOLLOW_UP_MODES = ["none", "single", "by_score"] as const;
export type FollowUpMode = (typeof FOLLOW_UP_MODES)[number];

export const customerSurveySettingsSchema = z.object({
  organization_id: z.string().uuid(),
  is_enabled: z.boolean(),
  promoter_min_rating: z.number().int().min(1).max(5),
  question_text: z.string().max(240),
  scale_min_label: z.string().max(30),
  scale_max_label: z.string().max(30),
  follow_up_mode: z.enum(FOLLOW_UP_MODES),
  follow_up_single: z.string().max(500).nullable().optional(),
  follow_up_low: z.string().max(500).nullable().optional(),
  follow_up_mid: z.string().max(500).nullable().optional(),
  follow_up_high: z.string().max(500).nullable().optional(),
  closing_message: z.string().max(1000),
  survey_page_title: z.string().max(120),
  thank_you_message: z.string().max(500),
});

export type CustomerSurveySettingsFormValues = z.infer<typeof customerSurveySettingsSchema>;

export function defaultCustomerSurveySettings(organizationId: string): CustomerSurveySettingsFormValues {
  return {
    organization_id: organizationId,
    is_enabled: false,
    promoter_min_rating: 4,
    question_text: "Secara keseluruhan, bagaimana pengalaman Anda dengan agen kami?",
    scale_min_label: "Buruk",
    scale_max_label: "Sangat baik",
    follow_up_mode: "none",
    follow_up_single: "",
    follow_up_low: "",
    follow_up_mid: "",
    follow_up_high: "",
    closing_message: "Terima kasih telah menghubungi kami. Mohon luangkan waktu sejenak untuk survei singkat:",
    survey_page_title: "Feedback Anda",
    thank_you_message: "Terima kasih atas masukan Anda!",
  };
}

export type OperationalEmailRecipientStatus = "pending" | "verified";

export type OperationalEmailNotificationSettings = {
  organization_id: string;
  daily_sales_summary_enabled: boolean;
  inventory_alerts_enabled: boolean;
  promo_update_enabled: boolean;
  daily_gross_profit_enabled: boolean;
  shift_recap_email_enabled: boolean;
};

export type OperationalEmailNotificationSettingsSave = {
  daily_sales_summary_enabled: boolean;
  inventory_alerts_enabled: boolean;
  promo_update_enabled: boolean;
  daily_gross_profit_enabled: boolean;
  shift_recap_email_enabled: boolean;
};

export type OperationalEmailRecipient = {
  id: string;
  organization_id: string;
  email: string;
  status: OperationalEmailRecipientStatus;
  verified_at: string | null;
  created_at: string;
};

export type AddOperationalEmailRecipientResult = {
  id: string;
  email: string;
  status: OperationalEmailRecipientStatus;
  verification_token: string;
};

export const DEFAULT_OPERATIONAL_EMAIL_SETTINGS: Omit<
  OperationalEmailNotificationSettings,
  "organization_id"
> = {
  daily_sales_summary_enabled: true,
  inventory_alerts_enabled: true,
  promo_update_enabled: true,
  daily_gross_profit_enabled: true,
};

export const MAX_OPERATIONAL_EMAIL_RECIPIENTS = 20;

export const OPERATIONAL_EMAIL_RPC_ERRORS = {
  email_required: "settings.emailNotifications.errors.emailRequired",
  email_invalid: "settings.emailNotifications.errors.emailInvalid",
  email_duplicate: "settings.emailNotifications.errors.emailDuplicate",
  recipient_limit_reached: "settings.emailNotifications.errors.recipientLimit",
  forbidden: "settings.emailNotifications.errors.forbidden",
  cannot_delete_verified: "settings.emailNotifications.errors.cannotDeleteVerified",
  token_invalid: "settings.emailNotifications.verify.invalidToken",
  token_expired: "settings.emailNotifications.verify.expiredToken",
} as const;

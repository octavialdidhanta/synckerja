export type PosQrisSettingsStatusCode =
  | "loading"
  | "ready"
  | "xendit_off"
  | "no_sub_account"
  | "channel_inactive";

export type PosQrisSettingsStatus = {
  code: PosQrisSettingsStatusCode;
  /** i18n key under posSettings.payment.* */
  labelKey: string;
  fallback: string;
  tone: "neutral" | "success" | "warning";
};

export function derivePosQrisSettingsStatus(args: {
  isLoading: boolean;
  xenditEnabled: boolean;
  hasSubAccount: boolean;
  hasQrisChannel: boolean;
  isEligible: boolean;
}): PosQrisSettingsStatus {
  if (args.isLoading) {
    return {
      code: "loading",
      labelKey: "posSettings.payment.qrisStatus.loading",
      fallback: "Checking…",
      tone: "neutral",
    };
  }
  if (args.isEligible) {
    return {
      code: "ready",
      labelKey: "posSettings.payment.qrisStatus.ready",
      fallback: "Ready",
      tone: "success",
    };
  }
  if (!args.xenditEnabled) {
    return {
      code: "xendit_off",
      labelKey: "posSettings.payment.qrisStatus.xenditOff",
      fallback: "Set up Xendit",
      tone: "warning",
    };
  }
  if (!args.hasSubAccount) {
    return {
      code: "no_sub_account",
      labelKey: "posSettings.payment.qrisStatus.noSubAccount",
      fallback: "Sub-account required",
      tone: "warning",
    };
  }
  if (!args.hasQrisChannel) {
    return {
      code: "channel_inactive",
      labelKey: "posSettings.payment.qrisStatus.channelInactive",
      fallback: "Channel inactive",
      tone: "warning",
    };
  }
  return {
    code: "xendit_off",
    labelKey: "posSettings.payment.qrisStatus.xenditOff",
    fallback: "Set up Xendit",
    tone: "warning",
  };
}

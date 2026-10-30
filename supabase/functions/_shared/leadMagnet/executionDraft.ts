import { missingScopesForFeature } from "../metaPlatformScopes.ts";

export type LeadMagnetAccountCandidate = {
  platform: "instagram" | "facebook";
  account_id: string;
  granted_scopes: string[];
  label?: string;
};

export type LeadMagnetAccountOption = {
  account_id: string;
  label: string;
  eligible: boolean;
};

export type LeadMagnetAccountChoice = {
  chosen: Array<{ platform: "instagram" | "facebook"; account_id: string }>;
  needsChoice: boolean;
  invalidSelection: boolean;
  instagram: LeadMagnetAccountOption[];
  facebook: LeadMagnetAccountOption[];
  instagramId: string | null;
  facebookId: string | null;
};

export function frameworkOfferText(offer: string): string {
  const body = offer.trim().replace(/\s+/g, " ");
  return `Hai {{username}}! ${body}\n\nKlik tombol di bawah, link-nya kami kirim sebentar lagi!`;
}

export function fallbackCommentReplies(offer: string): [string, string, string] {
  const short = offer.trim().replace(/\s+/g, " ").slice(0, 80);
  return [
    `Materinya sudah siap: ${short}. Cek DM ya 📩`,
    `Siap, ${short} kami kirim lewat DM 📩`,
    `Cek pesan masuk ya, ${short} sudah masuk 👇`,
  ];
}

export function leadMagnetScopesOk(
  platform: "instagram" | "facebook",
  granted: string[],
): boolean {
  const dm = platform === "instagram" ? "instagram_dm" : "messenger_dm";
  return missingScopesForFeature(granted, dm).length === 0
    && missingScopesForFeature(granted, "comments").length === 0;
}

function withDistinctLabels(options: LeadMagnetAccountOption[]): LeadMagnetAccountOption[] {
  const counts = new Map<string, number>();
  for (const option of options) counts.set(option.label, (counts.get(option.label) ?? 0) + 1);
  return options.map((option) =>
    (counts.get(option.label) ?? 0) > 1
      ? { ...option, label: `${option.label} (${option.account_id})` }
      : option
  );
}

function optionsForPlatform(
  accounts: readonly LeadMagnetAccountCandidate[],
  platform: "instagram" | "facebook",
): LeadMagnetAccountOption[] {
  return withDistinctLabels(
    accounts.flatMap((account) => {
      if (account.platform !== platform || !account.account_id.trim()) return [];
      const accountId = account.account_id.trim();
      return [{
        account_id: accountId,
        label: account.label?.trim() || accountId,
        eligible: leadMagnetScopesOk(platform, account.granted_scopes),
      }];
    }),
  );
}

/** List every account. A platform with several eligible accounts waits for an explicit choice. */
export function resolveLeadMagnetAccountChoice(
  accounts: readonly LeadMagnetAccountCandidate[],
  selection: { instagram?: string; facebook?: string },
): LeadMagnetAccountChoice {
  const instagram = optionsForPlatform(accounts, "instagram");
  const facebook = optionsForPlatform(accounts, "facebook");
  const chosen: LeadMagnetAccountChoice["chosen"] = [];
  let needsChoice = false;
  let invalidSelection = false;

  for (const platform of ["instagram", "facebook"] as const) {
    const options = platform === "instagram" ? instagram : facebook;
    const eligible = options.filter((option) => option.eligible);
    const requested = (platform === "instagram" ? selection.instagram : selection.facebook)?.trim() ?? "";
    if (requested) {
      if (!eligible.some((option) => option.account_id === requested)) {
        invalidSelection = true;
        continue;
      }
      chosen.push({ platform, account_id: requested });
      continue;
    }
    if (eligible.length === 1) {
      chosen.push({ platform, account_id: eligible[0].account_id });
      continue;
    }
    if (eligible.length > 1) needsChoice = true;
  }

  const instagramId = chosen.find((account) => account.platform === "instagram")?.account_id ?? null;
  const facebookId = chosen.find((account) => account.platform === "facebook")?.account_id ?? null;
  return { chosen, needsChoice, invalidSelection, instagram, facebook, instagramId, facebookId };
}

/** Attach a platform only when exactly one account passes DM and comment scopes. */
export function singleScopedLeadMagnetAccounts(
  accounts: readonly LeadMagnetAccountCandidate[],
): Array<{ platform: "instagram" | "facebook"; account_id: string }> {
  return resolveLeadMagnetAccountChoice(accounts, {}).chosen;
}

export function sanitizePdfFileName(offer: string): string {
  const base = offer
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 60);
  return `${base || "materi"}.pdf`;
}

import { describe, expect, it } from "vitest";
import type { ServiceRequiredPlatform } from "@/6-1-dashboard/hook/useServiceRequiredPlatforms";
import type { MetaContentAccount } from "@/meta-platform/types/metaContentTypes";
import {
  storyPublishTargetsFromRequired,
  storyTargetEligible,
} from "./storyPublishAccounts";

function required(
  partial: Partial<ServiceRequiredPlatform> & Pick<ServiceRequiredPlatform, "platform" | "platform_account_id">,
): ServiceRequiredPlatform {
  return {
    id: partial.id ?? "rp-1",
    service_id: partial.service_id ?? "svc-1",
    platform: partial.platform,
    social_media_name_id: null,
    custom_platform_name: null,
    platform_account_id: partial.platform_account_id,
    platform_account_label: partial.platform_account_label ?? null,
    is_active: partial.is_active ?? true,
    organization_id: "org-1",
    created_at: "",
    updated_at: "",
    created_by: null,
  };
}

function meta(
  partial: Pick<MetaContentAccount, "platform" | "account_id" | "account_label"> & {
    granted_scopes?: string[];
  },
): MetaContentAccount {
  return {
    platform: partial.platform,
    account_id: partial.account_id,
    account_label: partial.account_label,
    page_id: "",
    granted_scopes: partial.granted_scopes ?? [
      "instagram_content_publish",
      "pages_manage_posts",
      "pages_read_engagement",
      "pages_show_list",
    ],
    avatar_url: null,
  };
}

describe("storyPublishTargetsFromRequired", () => {
  it("lists every active IG/FB required account as its own row", () => {
    const targets = storyPublishTargetsFromRequired(
      [
        required({
          id: "ig-office",
          platform: "Instagram",
          platform_account_id: "ig_office",
          platform_account_label: "synckerja_office",
        }),
        required({
          id: "ig-octa",
          platform: "Instagram",
          platform_account_id: "ig_octa",
          platform_account_label: "octa.vialdi",
        }),
        required({
          id: "fb",
          platform: "Facebook",
          platform_account_id: "page_office",
          platform_account_label: "Synckerja Office",
        }),
        required({
          id: "tt",
          platform: "TikTok",
          platform_account_id: "tt_1",
          platform_account_label: "TikTok",
        }),
      ],
      [
        meta({ platform: "instagram", account_id: "ig_office", account_label: "synckerja_office" }),
        meta({ platform: "instagram", account_id: "ig_octa", account_label: "octa.vialdi" }),
        meta({ platform: "instagram", account_id: "openbook", account_label: "openbook.charity" }),
        meta({ platform: "facebook", account_id: "page_office", account_label: "Synckerja Office" }),
        meta({ platform: "facebook", account_id: "vialdi", account_label: "Vialdi.ID" }),
      ],
    );

    expect(targets.map((row) => row.accountId)).toEqual([
      "page_office",
      "ig_octa",
      "ig_office",
    ]);
    expect(targets.some((row) => row.accountId === "openbook")).toBe(false);
    expect(targets.every((row) => storyTargetEligible(row))).toBe(true);
  });

  it("marks missing Meta OAuth as not connected", () => {
    const targets = storyPublishTargetsFromRequired(
      [
        required({
          id: "fb-missing",
          platform: "Facebook",
          platform_account_id: "page_missing",
          platform_account_label: "Missing Page",
        }),
      ],
      [],
    );
    expect(targets).toEqual([
      {
        requiredPlatformRowId: "fb-missing",
        platform: "Facebook",
        accountId: "page_missing",
        accountLabel: "Missing Page",
        publishScopesOk: false,
        oauthConnected: false,
      },
    ]);
    expect(storyTargetEligible(targets[0])).toBe(false);
  });
});

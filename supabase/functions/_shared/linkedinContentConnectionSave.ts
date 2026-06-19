import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { LinkedInPageRow } from "./linkedinContentApi.ts";
import { linkedinContentOAuthScopes } from "./linkedinContentAuth.ts";
import {
  encryptLinkedInContentToken,
} from "./linkedinContentConfigCrypto.ts";

export async function saveLinkedInPageConnection(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    userId: string;
    page: LinkedInPageRow;
    accessToken: string;
    refreshToken: string;
    expiresIn?: number;
    grantedScopes?: string[];
  },
): Promise<{ isExistingAccount: boolean }> {
  const { organizationId, userId, page, accessToken, refreshToken, expiresIn, grantedScopes } = args;
  const scopes = grantedScopes?.length
    ? grantedScopes
    : linkedinContentOAuthScopes().split(/\s+/).filter(Boolean);
  const pageId = page.page_id;
  const now = new Date().toISOString();
  const accessExpires = expiresIn
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null;

  const accessEnc = await encryptLinkedInContentToken(accessToken);
  const refreshEnc = await encryptLinkedInContentToken(refreshToken);

  await admin.from("organization_linkedin_content_connections").upsert(
    {
      organization_id: organizationId,
      oauth_connected_at: now,
      is_active: true,
      updated_at: now,
      created_by: userId,
    },
    { onConflict: "organization_id" },
  );

  await admin.from("organization_linkedin_content_connection_tokens").upsert(
    {
      organization_id: organizationId,
      page_id: pageId,
      access_token_enc: accessEnc,
      refresh_token_enc: refreshEnc,
      access_token_expires_at: accessExpires,
      updated_at: now,
    },
    { onConflict: "organization_id,page_id" },
  );

  const { data: existingAccounts } = await admin
    .from("organization_linkedin_content_accounts")
    .select("id, is_default, page_id, sort_order")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  const hasDefault = (existingAccounts ?? []).some(
    (a) => Boolean((a as { is_default?: boolean }).is_default),
  );
  const existingPage = (existingAccounts ?? []).find(
    (a) => String((a as { page_id?: string }).page_id) === pageId,
  );
  const isExistingAccount = Boolean(existingPage);
  const maxSort = (existingAccounts ?? []).reduce(
    (m, a) => Math.max(m, Number((a as { sort_order?: number }).sort_order) || 0),
    0,
  );

  const displayName = page.title || `LinkedIn ${pageId.slice(0, 8)}`;

  await admin.from("organization_linkedin_content_accounts").upsert(
    {
      organization_id: organizationId,
      page_id: pageId,
      label: displayName,
      display_name: displayName,
      thumbnail_url: page.thumbnail_url,
      is_default: existingPage
        ? Boolean((existingPage as { is_default?: boolean }).is_default)
        : !hasDefault,
      sort_order: existingPage
        ? Number((existingPage as { sort_order?: number }).sort_order) || 0
        : maxSort + 1,
      is_active: true,
      granted_scopes: scopes,
      updated_at: now,
    },
    { onConflict: "organization_id,page_id" },
  );

  return { isExistingAccount };
}

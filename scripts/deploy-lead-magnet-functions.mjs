/**
 * Deploy lead-magnet edge functions via Supabase Management API.
 * Requires SUPABASE_ACCESS_TOKEN (sbp_...) from https://supabase.com/dashboard/account/tokens
 *
 * Usage:
 *   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
 *   node scripts/deploy-lead-magnet-functions.mjs
 *   node scripts/deploy-lead-magnet-functions.mjs lead-magnet-runtime instagram-webhook
 */
import fs from "fs";
import path from "path";

const PROJECT_REF = "wqdzqqshoifwyrltzgvx";
const root = process.cwd();

const leadMagnetShared = fs
  .readdirSync("supabase/functions/_shared/leadMagnet")
  .map((f) => `supabase/functions/_shared/leadMagnet/${f}`);

const bundles = {
  "lead-magnet-runtime": [
    "supabase/functions/lead-magnet-runtime/index.ts",
    "supabase/functions/_shared/metaContentApi.ts",
    "supabase/functions/_shared/metaContentAuth.ts",
    "supabase/functions/_shared/metaPlatformScopes.ts",
    "supabase/functions/_shared/omnichannelPublicApi/leadStatusMap.ts",
    ...leadMagnetShared,
  ],
  "lead-magnet-api": [
    "supabase/functions/lead-magnet-api/index.ts",
    "supabase/functions/_shared/metaContentApi.ts",
    "supabase/functions/_shared/metaContentAuth.ts",
    "supabase/functions/_shared/metaPlatformScopes.ts",
    ...leadMagnetShared,
  ],
  "instagram-webhook": [
    "supabase/functions/instagram-webhook/index.ts",
    "supabase/functions/_shared/metaContentApi.ts",
    "supabase/functions/_shared/metaContentAuth.ts",
    "supabase/functions/_shared/metaPlatformScopes.ts",
    "supabase/functions/_shared/metaManageCommentsInboxState.ts",
    "supabase/functions/_shared/instagramAccountDedupe.ts",
    "supabase/functions/_shared/instagramMessagingRecipient.ts",
    "supabase/functions/_shared/facebookMessengerWebhook.ts",
    "supabase/functions/_shared/omnichannelPublicApi/leadStatusMap.ts",
    ...leadMagnetShared,
  ],
  "instagram-subscribe-webhooks": [
    "supabase/functions/instagram-subscribe-webhooks/index.ts",
    "supabase/functions/_shared/metaInstagramPageSubscribe.ts",
    "supabase/functions/_shared/metaPlatformScopes.ts",
  ],
  "meta-oauth-exchange": [
    "supabase/functions/meta-oauth-exchange/index.ts",
    "supabase/functions/_shared/metaInstagramPageSubscribe.ts",
    "supabase/functions/_shared/metaPlatformScopes.ts",
    "supabase/functions/_shared/instagramAccountDedupe.ts",
  ],
};

const defaultNames = ["lead-magnet-api", "lead-magnet-runtime", "instagram-webhook"];
const names = process.argv.slice(2).length ? process.argv.slice(2) : defaultNames;

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
if (!token) {
  console.error("SUPABASE_ACCESS_TOKEN is required.");
  console.error("Create one at: https://supabase.com/dashboard/account/tokens");
  process.exit(1);
}

function buildFilesFromPaths(filePaths) {
  return filePaths.map((p) => ({
    name: p.replace("supabase/functions/", ""),
    content: fs.readFileSync(path.join(root, p), "utf8"),
  }));
}

async function deployViaMultipart(name, filePaths) {
  const files = buildFilesFromPaths(filePaths);
  const form = new FormData();
  form.append(
    "metadata",
    new Blob(
      [
        JSON.stringify({
          name,
          entrypoint_path: `${name}/index.ts`,
          verify_jwt: false,
        }),
      ],
      { type: "application/json" },
    ),
  );
  for (const file of files) {
    form.append("file", new Blob([file.content], { type: "text/plain" }), file.name);
  }

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/deploy?slug=${encodeURIComponent(name)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  );

  const text = await res.text();
  if (!res.ok) {
    console.error(`${name}: HTTP ${res.status}`, text.slice(0, 500));
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  console.log(`${name}: v${parsed.version ?? "?"} ${parsed.status ?? "deployed"} (${files.length} files)`);
}

for (const name of names) {
  const filePaths = bundles[name];
  if (!filePaths) {
    console.error(`Unknown function: ${name}`);
    process.exit(1);
  }
  await deployViaMultipart(name, filePaths);
}

console.log("Done.");

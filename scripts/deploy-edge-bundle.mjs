/**
 * Deploy a pre-bundled edge function via Supabase Management API (multipart).
 * Requires SUPABASE_ACCESS_TOKEN in env.
 *
 * Usage:
 *   node scripts/deploy-edge-bundle.mjs omnichannel-api-manage true
 *   node scripts/deploy-edge-bundle.mjs omnichannel-public-api false
 *   node scripts/deploy-edge-bundle.mjs whatsapp-webhook false
 */
import fs from "node:fs";
import path from "node:path";

const PROJECT_REF = "wqdzqqshoifwyrltzgvx";
const fnName = process.argv[2];
const verifyJwt = process.argv[3] === "true";

if (!fnName) {
  console.error("Usage: node scripts/deploy-edge-bundle.mjs <function-name> [verify_jwt=true|false]");
  process.exit(1);
}

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
if (!token) {
  console.error("SUPABASE_ACCESS_TOKEN is required in environment.");
  process.exit(1);
}

const bundlePath = path.resolve(`scripts/.edge-bundles/${fnName}.json`);
if (!fs.existsSync(bundlePath)) {
  console.error(`Bundle not found: ${bundlePath}`);
  process.exit(1);
}

const files = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
const entrypoint = files.find((f) => f.name.endsWith("/index.ts"))?.name ?? "index.ts";

const form = new FormData();
form.append(
  "metadata",
  new Blob(
    [
      JSON.stringify({
        name: fnName,
        entrypoint_path: entrypoint,
        verify_jwt: verifyJwt,
      }),
    ],
    { type: "application/json" },
  ),
);

for (const file of files) {
  form.append("file", new Blob([file.content], { type: "text/plain" }), file.name);
}

const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/deploy?slug=${encodeURIComponent(fnName)}`;
const res = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
  },
  body: form,
});

const text = await res.text();
if (!res.ok) {
  console.error(`Deploy failed (${res.status}):`, text.slice(0, 3000));
  process.exit(1);
}

console.log(`Deployed ${fnName} (verify_jwt=${verifyJwt}, entrypoint=${entrypoint})`);
try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log(text.slice(0, 500));
}

/**
 * Resend lead magnet delivery DM via edge function (correct signed download URL).
 * Usage: node scripts/resend-lead-magnet-dm.mjs <enrollmentId>
 */
import { execSync } from "node:child_process";

const PROJECT_REF = "wqdzqqshoifwyrltzgvx";
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

function loadServiceKey() {
  const raw = execSync(`npx supabase projects api-keys --project-ref ${PROJECT_REF} -o json`, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  const keys = JSON.parse(raw);
  const service = keys.find((k) => k.id === "service_role")?.api_key;
  if (!service) throw new Error("Missing service_role API key");
  return service;
}

async function main() {
  const enrollmentId = process.argv[2];
  if (!enrollmentId) {
    console.error("Usage: node scripts/resend-lead-magnet-dm.mjs <enrollmentId>");
    process.exit(1);
  }

  const serviceKey = loadServiceKey();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/lead-magnet-runtime/resend-delivery`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ enrollmentId }),
  });
  const data = await res.json();
  console.log("resend-delivery:", res.status, JSON.stringify(data, null, 2));
  if (!res.ok || !data.success) {
    throw new Error(data?.error ?? "Resend failed");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

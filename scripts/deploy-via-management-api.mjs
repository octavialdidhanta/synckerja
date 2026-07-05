/**
 * Deploy edge functions via Supabase Management API (same payload as MCP deploy_edge_function).
 * Requires SUPABASE_ACCESS_TOKEN (sbp_...) in environment.
 *
 * Usage: node scripts/deploy-via-management-api.mjs [function-name...]
 */
import fs from "fs";
import path from "path";

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const ref = "wqdzqqshoifwyrltzgvx";
const names = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["flow-runtime-send", "flow-runtime", "whatsapp-webhook"];

if (!token) {
  console.error("SUPABASE_ACCESS_TOKEN is required");
  process.exit(1);
}

async function deploy(name) {
  const invokePath = path.join(process.cwd(), "scripts", ".deploy-temp", `mcp-invoke-${name}.json`);
  if (!fs.existsSync(invokePath)) {
    console.error(`Missing ${invokePath}. Run: node scripts/mcp-deploy-one.mjs ${name}`);
    process.exit(1);
  }

  const body = JSON.parse(fs.readFileSync(invokePath, "utf8"));
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/functions/deploy?slug=${encodeURIComponent(name)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }

  if (!res.ok) {
    console.error(`${name}: HTTP ${res.status}`, parsed);
    process.exit(1);
  }

  console.log(`${name}: v${parsed.version ?? "?"} ${parsed.status ?? "deployed"}`);
}

for (const name of names) {
  await deploy(name);
}

console.log("Done.");

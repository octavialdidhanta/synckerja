import fs from "node:fs";
import path from "node:path";

const PROJECT_REF = "wqdzqqshoifwyrltzgvx";
const payloadPath = path.join(process.cwd(), "scripts", ".deploy-temp", "lead-magnet-runtime-mcp.json");

function resolveAccessToken() {
  const fromEnv = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  const mcpPath = path.join(process.env.USERPROFILE ?? "", ".cursor", "mcp.json");
  if (fs.existsSync(mcpPath)) {
    const cfg = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
    const token = cfg?.mcpServers?.supabase?.env?.SUPABASE_ACCESS_TOKEN?.trim();
    if (token) return token;
  }
  return "";
}

const token = resolveAccessToken();
if (!token) {
  console.error("SUPABASE_ACCESS_TOKEN is required");
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
const form = new FormData();
form.append(
  "metadata",
  new Blob(
    [
      JSON.stringify({
        name: payload.name,
        entrypoint_path: payload.entrypoint_path,
        verify_jwt: payload.verify_jwt ?? false,
      }),
    ],
    { type: "application/json" },
  ),
);

for (const file of payload.files) {
  form.append("file", new Blob([file.content], { type: "text/plain" }), file.name);
}

const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/deploy?slug=${encodeURIComponent(payload.name)}`;
const res = await fetch(url, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});

const text = await res.text();
if (!res.ok) {
  console.error(`Deploy failed (${res.status}):`, text.slice(0, 3000));
  process.exit(1);
}

try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log(text);
}

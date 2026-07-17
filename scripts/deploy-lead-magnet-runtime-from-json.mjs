/**
 * Deploy lead-magnet-runtime via Supabase Management API using prebuilt JSON payload.
 * MCP deploy_edge_function uses the same backend; this script is for local automation when
 * MCP payload size limits apply.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const payloadPath =
  process.argv[2] ??
  path.join(__dirname, ".deploy-lead-magnet-runtime.json");

const PROJECT_REF = "wqdzqqshoifwyrltzgvx";
const raw = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
const name = raw.name;
const entrypoint_path = "lead-magnet-runtime/index.ts";
const verify_jwt = false;
const files = raw.files;

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
if (!token) {
  console.error(JSON.stringify({ error: "SUPABASE_ACCESS_TOKEN is required" }));
  process.exit(1);
}

const form = new FormData();
form.append(
  "metadata",
  new Blob(
    [JSON.stringify({ name, entrypoint_path, verify_jwt })],
    { type: "application/json" },
  ),
);
for (const file of files) {
  form.append(
    "file",
    new Blob([file.content], { type: "text/plain" }),
    file.name,
  );
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
let body;
try {
  body = JSON.parse(text);
} catch {
  body = { raw: text.slice(0, 2000) };
}

const out = {
  ok: res.ok,
  httpStatus: res.status,
  version: body.version ?? null,
  status: body.status ?? null,
  slug: body.slug ?? name,
  id: body.id ?? null,
  fileCount: files.length,
  error: res.ok ? null : body,
};

console.log(JSON.stringify(out));
process.exit(res.ok ? 0 : 1);

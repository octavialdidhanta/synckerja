#!/usr/bin/env node
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, ".tmp-meta-query.sql");
const raw = execSync(
  `npx supabase db query --linked -f "${sqlPath}" -o json`,
  { cwd: path.join(__dirname, ".."), encoding: "utf8" },
);
const jsonStart = raw.indexOf("{");
const parsed = JSON.parse(raw.slice(jsonStart));
const rows = parsed.rows ?? [];
const accountRow = rows.find((r) => r.account_token || r.account_waba) ?? rows[0];
const token = String(accountRow?.account_token ?? accountRow?.org_meta_token ?? "").trim();
const waba = String(accountRow?.account_waba ?? accountRow?.org_waba ?? "").trim();
if (!token || !waba) {
  console.error("Missing meta config", rows.map((r) => ({
    name: r.whatsapp_business_name,
    hasToken: Boolean(r.account_token || r.org_meta_token),
    waba: r.account_waba || r.org_waba,
  })));
  process.exit(1);
}
const url = `https://graph.facebook.com/v21.0/${waba}/message_templates?limit=50&fields=name,status,language,components`;
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
const body = await res.json();
if (!res.ok) {
  console.error("Meta API error", body);
  process.exit(1);
}

const list = (body.data ?? [])
  .filter((x) => x.status === "APPROVED")
  .map((x) => {
    const bodyComp = x.components?.find((c) => c.type === "BODY");
    const text = bodyComp?.text ?? "";
    const vars = (text.match(/\{\{\d+\}\}/g) ?? []).length;
    return { name: x.name, lang: x.language, bodyVars: vars, textPreview: text.slice(0, 160) };
  });

console.log(JSON.stringify(list, null, 2));

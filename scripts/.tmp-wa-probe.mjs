#!/usr/bin/env node
/** Probe elementorform WA send with 4 vs 5 body params (Richard test). */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, ".tmp-meta-query.sql");
const raw = execSync(`npx supabase db query --linked -f "${sqlPath}" -o json`, {
  cwd: path.join(__dirname, ".."),
  encoding: "utf8",
});
const row = JSON.parse(raw.slice(raw.indexOf("{"))).rows?.[0];
const token = row.account_token;
const phoneNumberId = "221644984361284"; // Vialdi Wedding

async function trySend(paramCount) {
  const params = [
    "Richard",
    "Richard Simbolon",
    "2026-07-25",
    "16:30",
    "Jakarta Pusat",
  ].slice(0, paramCount);
  const payload = {
    messaging_product: "whatsapp",
    to: "6281384056120",
    type: "template",
    template: {
      name: "elementorform",
      language: { code: "id" },
      components: [
        {
          type: "body",
          parameters: params.map((text) => ({ type: "text", text })),
        },
      ],
    },
  };
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  return { paramCount, status: res.status, json };
}

console.log(JSON.stringify({ four: await trySend(4), five: await trySend(5) }, null, 2));

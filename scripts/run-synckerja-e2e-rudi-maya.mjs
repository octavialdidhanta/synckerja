#!/usr/bin/env node
/**
 * E2E omnichannel public API — Synckerja org (Rudi Kedong + Maya Estianti).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmpDir = path.join(__dirname, ".tmp-e2e-synckerja");
fs.mkdirSync(tmpDir, { recursive: true });

const BASE =
  "https://wqdzqqshoifwyrltzgvx.supabase.co/functions/v1/omnichannel-public-api";
const SDK_TOKEN =
  process.env.OMNICHANNEL_E2E_SDK_TOKEN ?? "sk_omni_scope_sdk_25d9297964bd80b8";
const SERVER_TOKEN =
  process.env.OMNICHANNEL_E2E_SERVER_TOKEN ?? "sk_omni_scope_server_32c580caae6535f9";

const subjects = [
  {
    key: "rudi",
    name: "Rudi Kedong",
    phone: "+6281384056130",
    email: "rudi.kedong.synckerja.e2e@gmail.com",
    sessionId: "5e63242b-7ce8-43b3-a2e5-187c3fe614c8",
    visitorId: "7b03c8fa-62dd-4115-a49f-5e1b4e07cc6b",
    gclid: "E2E-SYN-RUDI-gclid-20260617",
    fbclid: "E2E-SYN-RUDI-fbclid-20260617",
    invoiceNumber: "INV-E2E-RUDI-20260617",
    package: "Paket Wedding Gold",
    amount: 28000000,
  },
  {
    key: "maya",
    name: "Maya Estianti",
    phone: "+6281384056131",
    email: "maya.estianti.synckerja.e2e@gmail.com",
    sessionId: "9c9d692c-33ab-4553-8a79-7b8c33ff24be",
    visitorId: "4ddd4b69-7f4c-434a-92cf-813378c6d192",
    gclid: "E2E-SYN-MAYA-gclid-20260617",
    fbclid: "E2E-SYN-MAYA-fbclid-20260617",
    invoiceNumber: "INV-E2E-MAYA-20260617",
    package: "Paket Wedding Silver",
    amount: 19500000,
  },
];

async function post(endpoint, body, token, extraHeaders = {}) {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

const report = { e2e: [], security: [] };

for (const s of subjects) {
  const row = { subject: s.name, steps: {} };

  row.steps.traffic = await post(
    "/api/v1/traffic-logs",
    {
      session_id: s.sessionId,
      visitor_id: s.visitorId,
      page_url: `https://vialdi.id/konsultasi?utm_source=google&utm_medium=cpc&utm_campaign=wedding-q2&utm_content=hero-cta&utm_term=${s.key}&gclid=${s.gclid}&fbclid=${s.fbclid}`,
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "wedding-q2",
      utm_content: "hero-cta",
      utm_term: s.key,
      gclid: s.gclid,
      fbclid: s.fbclid,
      referrer: "https://www.google.com/",
    },
    SDK_TOKEN,
  );

  const pageViewId = row.steps.traffic.json?.page_view_id;
  if (pageViewId) {
    row.steps.heartbeat = await post(
      "/api/v1/page-views/heartbeat",
      { page_view_id: pageViewId, active_ms: 29800, scroll_max_pct: 71 },
      SDK_TOKEN,
    );
  }

  row.steps.click = await post(
    "/api/v1/click-events",
    {
      session_id: s.sessionId,
      visitor_id: s.visitorId,
      path: "/konsultasi",
      track_key: `form-submit-${s.key}`,
      element_type: "BUTTON",
      element_label: `Daftar ${s.name}`,
    },
    SDK_TOKEN,
  );

  row.steps.waClick = await post(
    "/api/v1/wa-link-clicks",
    {
      session_id: s.sessionId,
      visitor_id: s.visitorId,
      path: "/konsultasi",
      target_url: "https://wa.me/6281281714855",
      target_phone: "6281281714855",
    },
    SDK_TOKEN,
  );

  row.steps.lead = await post(
    "/api/v1/leads",
    {
      session_id: s.sessionId,
      name: s.name,
      phone_number: s.phone,
      email: s.email,
      notes: `E2E test lead ${s.name} — Synckerja org`,
      consent: true,
      event_date: "2026-08-15",
      event_time: "11:00",
      event_address: "Bandung — Gedung Pernikahan Indah",
      package_label: s.package,
      guest_count: 180,
      budget_range: "25-35jt",
      preferred_contact: "whatsapp",
    },
    SDK_TOKEN,
  );

  row.steps.invoice = await post(
    "/api/v1/orders/invoice-trigger",
    {
      invoice_number: s.invoiceNumber,
      amount: s.amount,
      items: [{ name: s.package, qty: 1, price: s.amount }],
      phone_number: s.phone,
      email: s.email,
      customer_name: s.name,
    },
    SERVER_TOKEN,
  );

  report.e2e.push(row);
}

// Security: Opsi B + A (gunakan invoice Maya sebagai payload)
const maya = subjects[1];
const invBody = {
  invoice_number: "INV-E2E-SECURITY-PROBE-001",
  amount: 1000,
  items: [{ name: "Probe", qty: 1, price: 1000 }],
  phone_number: maya.phone,
  email: maya.email,
  customer_name: maya.name,
};

report.security.push({
  test: "Opsi B: SDK token → invoice-trigger",
  result: await post("/api/v1/orders/invoice-trigger", invBody, SDK_TOKEN),
});
report.security.push({
  test: "Opsi A: Server token + Origin browser → invoice-trigger",
  result: await post("/api/v1/orders/invoice-trigger", invBody, SERVER_TOKEN, {
    Origin: "https://vialdi.id",
    "Sec-Fetch-Site": "cross-site",
  }),
});
report.security.push({
  test: "Opsi B+A OK: Server token tanpa Origin → invoice-trigger",
  result: await post("/api/v1/orders/invoice-trigger", invBody, SERVER_TOKEN),
});

const outPath = path.join(tmpDir, "report-rudi-maya.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log("\nWrote", outPath);

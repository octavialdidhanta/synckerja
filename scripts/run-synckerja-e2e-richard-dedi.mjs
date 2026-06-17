#!/usr/bin/env node
/**
 * E2E omnichannel public API — Synckerja org (Richard + Dedi).
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
    key: "richard",
    name: "Richard Simbolon",
    phone: "+6281384056120",
    email: "richard.simbolon.synckerja.e2e@gmail.com",
    sessionId: "a39203ec-43d2-4e82-bb5b-892c606f586b",
    visitorId: "5e014bfa-ca6e-47c4-afdf-a818b3894153",
    gclid: "E2E-SYN-RICHARD-gclid-20260616",
    fbclid: "E2E-SYN-RICHARD-fbclid-20260616",
    invoiceNumber: "INV-E2E-RICHARD-20260616",
    package: "Paket Wedding Platinum",
    amount: 32000000,
  },
  {
    key: "dedi",
    name: "Dedi Corbuzier",
    phone: "+6281384056121",
    email: "dedi.corbuzier.synckerja.e2e@gmail.com",
    sessionId: "6aa25a8b-939b-4490-a8f3-54f8de97b368",
    visitorId: "0ce752d4-52e6-4e2c-baef-39ddefed6915",
    gclid: "E2E-SYN-DEDI-gclid-20260616",
    fbclid: "E2E-SYN-DEDI-fbclid-20260616",
    invoiceNumber: "INV-E2E-DEDI-20260616",
    package: "Paket Wedding Diamond",
    amount: 45000000,
  },
];

async function post(endpoint, body, token) {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
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

const report = [];

for (const s of subjects) {
  const row = { subject: s.name, steps: {} };

  const traffic = await post(
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
  row.steps.traffic = traffic;

  const pageViewId = traffic.json?.page_view_id;
  if (pageViewId) {
    row.steps.heartbeat = await post(
      "/api/v1/page-views/heartbeat",
      { page_view_id: pageViewId, active_ms: 31200, scroll_max_pct: 74 },
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
      event_date: "2026-07-25",
      event_time: "16:30",
      event_address: "Jakarta Pusat — Gedung Wedding Hall",
      package_label: s.package,
      guest_count: 200,
      budget_range: "30-50jt",
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

  report.push(row);
}

const outPath = path.join(tmpDir, "report-richard-dedi.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log("\nWrote", outPath);

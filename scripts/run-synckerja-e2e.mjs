#!/usr/bin/env node
/**
 * E2E omnichannel public API — Synckerja org (Anton + Toni).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmpDir = path.join(__dirname, ".tmp-e2e-synckerja");
fs.mkdirSync(tmpDir, { recursive: true });

const BASE =
  "https://wqdzqqshoifwyrltzgvx.supabase.co/functions/v1/omnichannel-public-api";
const TOKEN = process.env.OMNICHANNEL_E2E_TOKEN ?? "";
if (!TOKEN) {
  console.error("Set OMNICHANNEL_E2E_TOKEN env var");
  process.exit(1);
}

const subjects = [
  {
    key: "anton",
    name: "Anton",
    phone: "+6281384056118",
    email: "anton.synckerja.e2e@gmail.com",
    sessionId: "0ef30983-bdc4-45ba-917b-b3ed3aeaa2c7",
    visitorId: "4f235371-cd2a-4ab2-b37f-f9b394d208b4",
    gclid: "E2E-SYN-ANTON-gclid-20260616",
    fbclid: "E2E-SYN-ANTON-fbclid-20260616",
    invoiceNumber: "INV-E2E-SYN-ANTON-20260616",
    package: "Paket Wedding Gold",
    amount: 25000000,
  },
  {
    key: "toni",
    name: "Toni",
    phone: "+447701071514",
    email: "toni.synckerja.e2e@gmail.com",
    sessionId: "83486d65-c03a-486b-a381-4f29eea9d3d5",
    visitorId: "b65132c8-f42c-48b1-ade0-76b2495619ce",
    gclid: "E2E-SYN-TONI-gclid-20260616",
    fbclid: "E2E-SYN-TONI-fbclid-20260616",
    invoiceNumber: "INV-E2E-SYN-TONI-20260616",
    package: "Paket Wedding Silver",
    amount: 18000000,
  },
];

async function post(endpoint, body) {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
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

  const traffic = await post("/api/v1/traffic-logs", {
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
  });
  row.steps.traffic = traffic;

  const pageViewId = traffic.json?.page_view_id;
  if (pageViewId) {
    row.steps.heartbeat = await post("/api/v1/page-views/heartbeat", {
      page_view_id: pageViewId,
      active_ms: 28500,
      scroll_max_pct: 68,
    });
  }

  row.steps.click = await post("/api/v1/click-events", {
    session_id: s.sessionId,
    visitor_id: s.visitorId,
    path: "/konsultasi",
    track_key: `form-submit-${s.key}`,
    element_type: "BUTTON",
    element_label: `Daftar ${s.name}`,
  });

  row.steps.waClick = await post("/api/v1/wa-link-clicks", {
    session_id: s.sessionId,
    visitor_id: s.visitorId,
    path: "/konsultasi",
    target_url: "https://wa.me/6281281714855",
    target_phone: "6281281714855",
  });

  row.steps.lead = await post("/api/v1/leads", {
    session_id: s.sessionId,
    name: s.name,
    phone_number: s.phone,
    email: s.email,
    notes: `E2E test lead ${s.name} — Synckerja org`,
    consent: true,
    event_date: "2026-06-20",
    event_time: "14:00",
    event_address: "Jakarta Selatan",
    package_label: s.package,
    guest_count: 150,
    budget_range: "20-30jt",
  });

  row.steps.invoice = await post("/api/v1/orders/invoice-trigger", {
    invoice_number: s.invoiceNumber,
    amount: s.amount,
    items: [{ name: s.package, qty: 1, price: s.amount }],
    phone_number: s.phone,
    email: s.email,
    customer_name: s.name,
  });

  report.push(row);
}

const outPath = path.join(tmpDir, "report.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log("\nWrote", outPath);

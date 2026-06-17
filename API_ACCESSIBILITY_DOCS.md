# Panduan Integrasi API Omnichannel

> v**1.4.0** · `npm run generate:omnichannel-api-docs`

Integrasikan website eksternal untuk **traffic**, **leads**, dan **invoice + nota WhatsApp**.

## Daftar isi

1. [Mulai cepat](#mulai-cepat)
2. [Autentikasi](#autentikasi)
3. [Keamanan dua lapis (scope + browser)](#keamanan-dua-lapis-scope--browser)
4. [Kebijakan token](#kebijakan-token)
5. [Integrasi Supabase (developer eksternal)](#integrasi-supabase-developer-eksternal)
6. [JavaScript SDK](#javascript-sdk)
7. [Referensi API](#referensi-api)
8. [Kode HTTP & checklist](#kode-http--checklist)

---

## Mulai cepat

| # | Langkah |
|---|---------|
| 1a | Buat token **SDK** — pasang di `SynckerjaConfig` di website; isi **allowed origins** |
| 1b | Buat token **Server** — simpan di backend secrets (Supabase Edge Function, dll.) |
| 2 | Di **Organization settings**: **template WhatsApp invoice** + offline conversion |
| 3 | Pasang SDK (konfigurasi + skrip) sebelum `</body>` — **hanya token SDK** |
| 4 | Tambah `data-syn-track` pada CTA, `data-syn-wa-track` pada link WA |
| 5 | Form → `SynckerjaTrackLead({ ...semuaFieldForm })` — field tambahan masuk `form_data` |
| 6 | Invoice → `POST /api/v1/orders/invoice-trigger` dengan **token Server** dari backend |

```text
Page load → traffic-logs │ 15s / tutup tab → heartbeat │ Klik CTA → click-events
Klik WA → wa-link-clicks │ Form → leads │ Order (server) → invoice-trigger → Converted + Sales Activity
```

SDK menangani baris pertama otomatis. Data tampil di `/digital-marketing/traffic`, `/omnichannel/leads`, dan `/operations/sales/activities` (setelah invoice).

---

## Autentikasi

```http
Authorization: Bearer sk_omni_<token>
Content-Type: application/json
```

**Base URL:** `https://<project-ref>.supabase.co/functions/v1/omnichannel-public-api`

| ID | Fungsi |
|----|--------|
| `web_id` | Pisahkan traffic per website |
| `session_id` | UUID per tab — ikat UTM ke lead |
| `visitor_id` | UUID per pengunjung |
| `page_view_id` | Dari respons `traffic-logs`, untuk heartbeat |

**Atribusi UTM & click ID:** Kirim `session_id` di `POST /leads` agar UTM, `gclid` (Google), dan `fbclid` (Meta) dari kunjungan pertama otomatis melekat ke lead. Nilai disimpan sebagai **string** di kolom lead dan JSON `attribution` (bukan boolean).

---

## Keamanan dua lapis (scope + browser)

| Lapisan | Apa yang dilindungi | Cara penegakan |
|---------|---------------------|----------------|
| **Scope token (Opsi B)** | Token SDK tidak bisa `invoice-trigger`; token Server tidak bisa traffic/leads | Kolom `token_type` + cek endpoint |
| **Blok browser (Opsi A)** | `invoice-trigger` tidak bisa dipanggil dari JavaScript browser | Tolak jika header `Origin` ada, atau `Sec-Fetch-Site` = `same-origin` / `same-site` / `cross-site` |

```text
Website (browser)  → token SDK  → traffic, leads, analytics saja
Backend / Edge Fn  → token Server → invoice-trigger saja (tanpa header browser)
```

Token `legacy_full` (lama) masih boleh semua endpoint dari **server**, tetapi **tetap ditolak** dari browser pada `invoice-trigger` (Opsi A). Cabut token legacy setelah migrasi ke pasangan SDK + Server.

**Jangan forward** header `Origin` / `Sec-Fetch-Site` dari client ke Synckerja di proxy backend — bisa memicu `403 BROWSER_REQUEST_REJECTED` palsu.

---

## Kebijakan token

| Kebijakan | Detail |
|-----------|--------|
| **Banyak token aktif** | Diizinkan — buat token baru tanpa revoke dulu (rotasi tanpa downtime, multi-website, staging/prod). |
| **Rotasi aman** | 1) Buat token baru → 2) Deploy SDK dengan token baru → 3) Verifikasi traffic/leads → 4) Cabut token lama. |
| **Revoke** | Soft revoke — `is_active` menjadi `false`, request API ditolak **403**. Baris tetap di database untuk audit (`revoked_at`, prefix, `last_used_at`). |
| **Plaintext** | Hanya ditampilkan **sekali** saat create — tidak disimpan di server (hanya hash + prefix). |
| **Batas abuse** | Maks. **50 token aktif** per organisasi (token kedaluwarsa tidak dihitung). |
| **Tipe token** | `sdk` = analytics + leads; `server` = invoice-trigger saja; `legacy_full` = token lama (semua endpoint dari server) sampai diganti |
| **Dua token per website** | Disarankan: 1× SDK (browser) + 1× Server (backend) per `web_id` |
| **Invoice dari browser** | Ditolak **403** `BROWSER_REQUEST_REJECTED` jika `Origin` atau `Sec-Fetch-Site` browser terdeteksi — meskipun token `server` / `legacy_full` |
| **Template WA invoice** | Atur di **Organization settings** — dipakai semua token aktif organisasi. |

---

## Integrasi Supabase (developer eksternal)

Website developer boleh memakai **Supabase project sendiri** — data tetap masuk Synckerja via HTTP, bukan ke database developer.

| Secret / config | Lokasi | Isi |
|-----------------|--------|-----|
| Token **SDK** | `SynckerjaConfig` di frontend | `sk_omni_...` tipe SDK |
| Token **Server** | `supabase secrets` project developer | `SYNCKERJA_OMNI_API_TOKEN` |
| Base URL | secrets atau hardcode | `SYNCKERJA_OMNI_API_BASE` = URL di tab Tokens & SDK |

`web_id` **bukan** secret — terikat di baris token saat create; tidak perlu env terpisah.

```bash
supabase secrets set SYNCKERJA_OMNI_API_TOKEN=sk_omni_...
supabase secrets set SYNCKERJA_OMNI_API_BASE=https://YOUR_PROJECT.supabase.co/functions/v1/omnichannel-public-api
```

```typescript
// BENAR — Edge Function developer (server), tanpa header Origin browser
await fetch(`${Deno.env.get("SYNCKERJA_OMNI_API_BASE")}/api/v1/orders/invoice-trigger`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${Deno.env.get("SYNCKERJA_OMNI_API_TOKEN")}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ invoice_number: "INV-001", amount: 1500000, items: [...], phone_number: "+628...", email: "..." }),
});
```

```javascript
// SALAH — fetch dari halaman website (akan 403 BROWSER_REQUEST_REJECTED)
fetch('https://.../omnichannel-public-api/api/v1/orders/invoice-trigger', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer sk_omni_...',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ invoice_number: 'INV-001', amount: 1500000, items: [...], phone_number: '+628...', email: '...' }),
});
```

**Arsitektur disarankan:** Website → pembayaran sukses → **Edge Function / server developer** → Synckerja `invoice-trigger`.

---

## JavaScript SDK

**Hanya token tipe SDK** — jangan pasang token Server di browser.

Dua blok `<script>` — tanpa npm.

**1. Konfigurasi**

```html
<script>
  window.SynckerjaConfig = {
    apiBase: 'https://YOUR_PROJECT.supabase.co/functions/v1/omnichannel-public-api',
    token: 'sk_omni_...',
  };
</script>
```

**2. Skrip pelacak** (sebelum `</body>`)

```html
<script>
(function (window, document) {
  'use strict';
  var CFG = window.SynckerjaConfig || {};
  var API_BASE = CFG.apiBase || '';
  var TOKEN = CFG.token || '';
  var VISITOR_KEY = 'synckerja_visitor_id';
  var SESSION_KEY = 'synckerja_session_id';
  var pageViewId = null;
  var activeMs = 0;
  var scrollMax = 0;
  var lastTick = Date.now();

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function getVisitorId() {
    try {
      var v = localStorage.getItem(VISITOR_KEY);
      if (v) return v;
      v = uuid();
      localStorage.setItem(VISITOR_KEY, v);
      return v;
    } catch (e) {
      return uuid();
    }
  }

  function getSessionId() {
    try {
      var s = sessionStorage.getItem(SESSION_KEY);
      if (s) return s;
      s = uuid();
      sessionStorage.setItem(SESSION_KEY, s);
      return s;
    } catch (e) {
      return uuid();
    }
  }

  function parseParams() {
    var sp = new URLSearchParams(window.location.search);
    var keys = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid','msclkid','gbraid','wbraid'];
    var out = {};
    keys.forEach(function (k) {
      var v = sp.get(k);
      if (v) out[k] = v;
    });
    return out;
  }

  function apiPost(path, body, beacon) {
    if (!API_BASE || !TOKEN) return Promise.resolve();
    var url = API_BASE.replace(/\/$/, '') + path;
    var payload = JSON.stringify(body);
    if (beacon && navigator.sendBeacon) {
      var blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
      return Promise.resolve();
    }
    return fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + TOKEN,
        'Content-Type': 'application/json',
      },
      body: payload,
      keepalive: true,
    }).catch(function () {});
  }

  function trackPageLoad() {
    var params = parseParams();
    return apiPost('/api/v1/traffic-logs', Object.assign({
      session_id: getSessionId(),
      visitor_id: getVisitorId(),
      page_url: window.location.href,
      referrer: document.referrer || null,
    }, params)).then(function (res) {
      if (!res || !res.json) return;
      return res.json().then(function (data) {
        if (data && data.page_view_id) pageViewId = data.page_view_id;
      });
    });
  }

  function heartbeat(finalize) {
    if (!pageViewId) return;
    var now = Date.now();
    activeMs += Math.max(0, now - lastTick);
    lastTick = now;
    scrollMax = Math.max(scrollMax, Math.round(
      ((window.scrollY + window.innerHeight) / Math.max(document.body.scrollHeight, 1)) * 100
    ));
    apiPost('/api/v1/page-views/heartbeat', {
      page_view_id: pageViewId,
      active_ms: activeMs,
      scroll_max_pct: Math.min(100, scrollMax),
      ended_at: finalize ? new Date().toISOString() : null,
    }, finalize);
  }

  function onClick(ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('[data-syn-track]') : null;
    if (!el) return;
    apiPost('/api/v1/click-events', {
      session_id: getSessionId(),
      visitor_id: getVisitorId(),
      path: window.location.pathname || '/',
      track_key: el.getAttribute('data-syn-track') || 'unknown',
      element_type: el.tagName,
      element_label: el.getAttribute('data-syn-label') || (el.textContent || '').trim().slice(0, 120),
      target_url: el.href || null,
      is_internal: !!(el.href && el.href.indexOf(window.location.origin) === 0),
    });
  }

  function onWaClick(ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('[data-syn-wa-track], a[href*="wa.me"], a[href*="api.whatsapp.com"]') : null;
    if (!el) return;
    var href = el.href || '';
    apiPost('/api/v1/wa-link-clicks', {
      session_id: getSessionId(),
      visitor_id: getVisitorId(),
      path: window.location.pathname || '/',
      target_url: href,
      target_phone: (href.match(/\d{8,15}/) || [])[0] || null,
    });
  }

  window.SynckerjaTrackLead = function (a, b, c, d) {
    var body = (a && typeof a === 'object' && !Array.isArray(a))
      ? Object.assign({ session_id: getSessionId() }, a)
      : {
          session_id: getSessionId(),
          name: a,
          phone_number: b || null,
          email: c || null,
          notes: d || null,
          status: 'new',
        };
    return apiPost('/api/v1/leads', body);
  };

  document.addEventListener('click', onClick, true);
  document.addEventListener('click', onWaClick, true);
  window.addEventListener('scroll', function () {
    scrollMax = Math.max(scrollMax, Math.round(
      ((window.scrollY + window.innerHeight) / Math.max(document.body.scrollHeight, 1)) * 100
    ));
  }, { passive: true });
  window.addEventListener('beforeunload', function () { heartbeat(true); });
  setInterval(function () { heartbeat(false); }, 15000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackPageLoad);
  } else {
    trackPageLoad();
  }
})(window, document);
</script>
```

**Atribut pelacakan**

```html
<button data-syn-track="hero-cta" data-syn-label="Daftar">Daftar</button>
<a href="https://wa.me/628123456789" data-syn-wa-track="floating-wa">Chat WA</a>
```

**Lead dari form**

Kirim objek flat — field inti: `name`, `phone_number`, `email`, `notes`. Sisanya otomatis ke `form_data`.

```javascript
// Form dinamis (disarankan)
window.SynckerjaTrackLead({
  name: 'John Doe',
  email: 'john.doe@example.com',
  phone_number: '+6281234567890',
  consent: true,
  event_date: '2026-06-09',
  event_address: 'Jl. Contoh No. 10, Jakarta',
});

// Dari FormData HTML
var payload = Object.fromEntries(new FormData(formEl));
window.SynckerjaTrackLead(payload);

// Legacy (tetap didukung)
window.SynckerjaTrackLead(nama, hp, email, catatan);
```

Field reserved (tidak masuk `form_data`): `name`, `phone_number`, `email`, `notes`, `session_id`, `status`.

> Invoice: panggil `/orders/invoice-trigger` **hanya dari server** — API menolak request browser (`403 BROWSER_REQUEST_REJECTED`).

---

## Referensi API

Semua endpoint **POST**, respons JSON. Pakai SDK → analytics otomatis; referensi di bawah untuk integrasi manual.

### Analytics

#### POST /api/v1/traffic-logs
Catat kunjungan halaman. Wajib: `session_id`, `visitor_id`, `page_url`. Opsional: UTM, `gclid`/`fbclid`, `referrer`.

```json
// Request
{ "session_id": "...", "visitor_id": "...", "page_url": "https://toko.com/?utm_source=google", "gclid": "..." }

// Response 201 — simpan page_view_id
{ "success": true, "page_view_id": "...", "web_id": "toko-anda" }
```

#### POST /api/v1/page-views/heartbeat
Wajib: `page_view_id`, `active_ms`, `scroll_max_pct`. Opsional: `ended_at` (saat tutup tab). → **SDK otomatis**

#### POST /api/v1/click-events
Wajib: `session_id`, `visitor_id`, `path`, `track_key`. → **SDK otomatis** via `data-syn-track`

#### POST /api/v1/wa-link-clicks
Wajib: `session_id`, `visitor_id`. Disarankan: `path` (default `/`), `target_url`, `target_phone`. → **SDK otomatis** via link wa.me / `data-syn-wa-track`

```json
{ "session_id": "...", "visitor_id": "...", "path": "/konsultasi", "target_url": "https://wa.me/628...", "target_phone": "628..." }
```

### Leads

#### POST /api/v1/leads
Wajib: `name`. Minimal salah satu `phone_number` atau `email`. Opsional: `session_id` (atribusi UTM + gclid/fbclid), `notes`. **Field lain** → `lead_submissions.form_data` (maks. 64 key, 32 KB, flat JSON).

```json
{
  "session_id": "...",
  "name": "John Doe",
  "email": "john.doe@example.com",
  "phone_number": "+6281234567890",
  "consent": true,
  "event_date": "2026-06-09",
  "event_time": "14:30",
  "event_address": "Jl. Contoh No. 10, Jakarta"
}
```

```json
// Response 201 — contoh atribusi dari session
{
  "success": true,
  "lead_id": "...",
  "ticket_id": "LEAD-...",
  "attribution": {
    "utm_source": "google",
    "utm_medium": "cpc",
    "gclid": "CjwK...",
    "fbclid": null
  }
}
```

### Orders

#### POST /api/v1/orders/invoice-trigger
Wajib: `invoice_number`, `amount`, `items`, `phone_number`, `email`. Opsional: `customer_name`. **Wajib token tipe `server`** (atau `legacy_full` dari server). **Ditegakkan API:** panggilan dari browser ditolak (`403`, kode `BROWSER_REQUEST_REJECTED`).

```json
{
  "invoice_number": "INV-2026-001",
  "amount": 1500000,
  "items": [{ "name": "Paket Gold", "qty": 1, "price": 1500000 }],
  "phone_number": "+6281234567890",
  "email": "john.doe@example.com",
  "customer_name": "John Doe"
}
```

```json
// Response 201
{
  "success": true,
  "invoice_id": "...",
  "lead_matched": true,
  "lead_converted": true,
  "sales_activity_id": "...",
  "whatsapp_status": "sent"
}
```

```json
// Response 403 — dipanggil dari browser (Origin / Sec-Fetch-Site)
{
  "success": false,
  "error": "invoice-trigger tidak boleh dipanggil dari browser. Gunakan token Server di backend (Edge Function / server).",
  "code": "BROWSER_REQUEST_REJECTED"
}
```

Saat invoice berhasil dan lead cocok:

- Lead status → **Converted** + `converted_at` (match **phone + email**, prioritas submission **terbaru**)
- Otomatis buat **Sales Activity** (`Lead Conversion`) + item dari `items` invoice → tampil di `/operations/sales/activities`
- **Offline conversion** Google/Meta dipicu jika diaktifkan di pengaturan API
- **Nota WhatsApp** (`whatsapp_status`) terkirim jika org punya akun WA + **template invoice** diset di **Organization settings** (tab Tokens & SDK)

- **409** — `invoice_number` duplikat

<!-- Kode HTTP & checklist: dirender via i18n di ApiIntegrationHttpCodesPanel.tsx -->

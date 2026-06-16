# Panduan Integrasi API Omnichannel

> v**1.2.0** · `npm run generate:omnichannel-api-docs`

Integrasikan website eksternal untuk **traffic**, **leads**, dan **invoice + nota WhatsApp**.

## Daftar isi

1. [Mulai cepat](#mulai-cepat)
2. [Autentikasi](#autentikasi)
3. [Kebijakan token](#kebijakan-token)
4. [JavaScript SDK](#javascript-sdk)
5. [Referensi API](#referensi-api)
6. [Kode HTTP & checklist](#kode-http--checklist)

---

## Mulai cepat

| # | Langkah |
|---|---------|
| 1 | Buat token di tab **Tokens & SDK** — simpan `sk_omni_...` dan `web_id` |
| 2 | Di **Organization settings** (tab Tokens & SDK): isi **allowed origins** + **template WhatsApp invoice** |
| 3 | Pasang SDK (konfigurasi + skrip) sebelum `</body>` |
| 4 | Tambah `data-syn-track` pada CTA, `data-syn-wa-track` pada link WA |
| 5 | Form → `SynckerjaTrackLead({ ...semuaFieldForm })` — field tambahan masuk `form_data` |
| 6 | Invoice → `POST /api/v1/orders/invoice-trigger` dari **backend** |

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

## Kebijakan token

| Kebijakan | Detail |
|-----------|--------|
| **Banyak token aktif** | Diizinkan — buat token baru tanpa revoke dulu (rotasi tanpa downtime, multi-website, staging/prod). |
| **Rotasi aman** | 1) Buat token baru → 2) Deploy SDK dengan token baru → 3) Verifikasi traffic/leads → 4) Cabut token lama. |
| **Revoke** | Soft revoke — `is_active` menjadi `false`, request API ditolak **403**. Baris tetap di database untuk audit (`revoked_at`, prefix, `last_used_at`). |
| **Plaintext** | Hanya ditampilkan **sekali** saat create — tidak disimpan di server (hanya hash + prefix). |
| **Batas abuse** | Maks. **50 token aktif** per organisasi (token kedaluwarsa tidak dihitung). |
| **Template WA invoice** | Atur di **Organization settings** — dipakai semua token aktif organisasi. |

---

## JavaScript SDK

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

> Invoice: panggil `/orders/invoice-trigger` **hanya dari server** — jangan dari browser.

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
Wajib: `invoice_number`, `amount`, `items`, `phone_number`, `email`. Opsional: `customer_name`. **Server-side only.**

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

Saat invoice berhasil dan lead cocok:

- Lead status → **Converted** + `converted_at` (match **phone + email**, prioritas submission **terbaru**)
- Otomatis buat **Sales Activity** (`Lead Conversion`) + item dari `items` invoice → tampil di `/operations/sales/activities`
- **Offline conversion** Google/Meta dipicu jika diaktifkan di pengaturan API
- **Nota WhatsApp** (`whatsapp_status`) terkirim jika org punya akun WA + **template invoice** diset di **Organization settings** (tab Tokens & SDK)

- **409** — `invoice_number` duplikat

<!-- Kode HTTP & checklist: dirender via i18n di ApiIntegrationHttpCodesPanel.tsx -->

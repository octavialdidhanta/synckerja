# Panduan Integrasi API Omnichannel

> v**1.4.10** · `npm run generate:omnichannel-api-docs`

Integrasikan website eksternal untuk **traffic**, **leads**, dan **invoice + nota WhatsApp**.

## Daftar isi

1. [Mulai cepat](#mulai-cepat)
2. [Autentikasi](#autentikasi)
3. [Keamanan dua lapis (scope + browser)](#keamanan-dua-lapis-scope--browser)
4. [Kebijakan token](#kebijakan-token)
5. [Integrasi Supabase (developer eksternal)](#integrasi-supabase-developer-eksternal)
6. [JavaScript SDK](#javascript-sdk)
7. [Website SPA (React/Vite)](#website-spa-reactvite)
8. [Dashboard traffic & sinkronisasi data](#dashboard-traffic--sinkronisasi-data)
9. [WhatsApp otomatis (leads vs invoice)](#whatsapp-otomatis-leads-vs-invoice)
10. [Referensi API](#referensi-api)
11. [Kode HTTP & checklist](#kode-http--checklist)

---

## Mulai cepat

| # | Langkah |
|---|---------|
| 1a | Buat token **SDK** — pasang di `SynckerjaConfig` di website; isi **allowed origins** |
| 1b | Buat token **Server** — simpan di backend secrets (Supabase Edge Function, dll.) |
| 2 | Di **Organization settings**: **template WhatsApp lead** + **template invoice** + offline conversion |
| 3 | Pasang SDK (konfigurasi + skrip) sebelum `</body>` — **hanya token SDK** |
| 4 | Tambah `data-syn-track` pada CTA, `data-syn-wa-track` pada link WA |
| 5 | Form → `SynckerjaTrackLead({ ...semuaFieldForm })` — field tambahan masuk `form_data` |
| 6 | Invoice → `POST /api/v1/orders/invoice-trigger` dengan **token Server** dari backend |

```text
Page load → traffic-logs │ 15s / tutup tab → heartbeat │ Klik CTA → click-events
Klik WA → wa-link-clicks → stub lead + analytics │ Form → leads (upgrade stub jika session sama) │ Order (server) → invoice-trigger → Converted + Sales Activity
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
| `session_id` | UUID per tab (`sessionStorage`) — mengikat atribusi first-touch ke lead & dashboard traffic |
| `visitor_id` | UUID per pengunjung (`localStorage`) |
| `page_view_id` | Dari respons `traffic-logs`, untuk heartbeat |

**Atribusi UTM & click ID:** Server merge **first-touch per `session_id`** saat `POST /traffic-logs`. Navigasi SPA tanpa query UTM tidak menghapus atribusi landing. `POST /wa-link-clicks` juga merge atribusi dari session yang sama ke stub lead CRM (tanpa kirim UTM di body). Kirim `session_id` di `POST /leads` agar UTM, `gclid` (Google), dan `fbclid` (Meta) dari kunjungan pertama otomatis melekat ke lead; jika sudah ada stub floating WA, lead di-upgrade bukan duplikat. Nilai disimpan sebagai **string** di kolom lead dan JSON `attribution` (bukan boolean).

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
| **Edit allowed origins** | Token SDK aktif dapat diubah dari dashboard — plaintext tidak berubah; website tidak perlu redeploy. Untuk rotasi secret atau ganti `web_id`, tetap buat token baru + cabut lama. |
| **Traffic approval** | Membuat token SDK otomatis menyetujui `web_id` di dashboard Traffic (`analytics_web_access.is_approved = true`). Mencabut token SDK terakhir untuk `web_id` menonaktifkan akses Traffic. |
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
  var ATTRIBUTION_KEY = 'synckerja_first_touch_attribution';
  var ATTRIBUTION_KEYS = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid','msclkid','gbraid','wbraid'];
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
    var out = {};
    ATTRIBUTION_KEYS.forEach(function (k) {
      var v = sp.get(k);
      if (v) out[k] = v;
    });
    return out;
  }

  function readStoredAttribution() {
    try {
      var raw = sessionStorage.getItem(ATTRIBUTION_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function persistAttribution(params) {
    if (!params || !Object.keys(params).length) return;
    try {
      var existing = readStoredAttribution();
      var next = Object.assign({}, existing);
      ATTRIBUTION_KEYS.forEach(function (k) {
        if (params[k]) next[k] = params[k];
      });
      sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(next));
    } catch (e) {}
  }

  function getAttributionPayload() {
    var fromUrl = parseParams();
    if (Object.keys(fromUrl).length) persistAttribution(fromUrl);
    return Object.assign({}, readStoredAttribution(), fromUrl);
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
    var params = getAttributionPayload();
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
    // path = halaman tempat klik terjadi (capture phase, sebelum navigasi SPA)
    var originPath = window.location.pathname || '/';
    var body = {
      session_id: getSessionId(),
      visitor_id: getVisitorId(),
      path: originPath,
      track_key: el.getAttribute('data-syn-track') || 'unknown',
      element_type: el.tagName,
      element_label: el.getAttribute('data-syn-label') || (el.textContent || '').trim().slice(0, 120),
      target_url: el.href || null,
      is_internal: !!(el.href && el.href.indexOf(window.location.origin) === 0),
    };
    if (pageViewId) body.page_view_id = pageViewId;
    apiPost('/api/v1/click-events', body);
  }

  function onWaClick(ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('[data-syn-wa-track], a[href*="wa.me"], a[href*="api.whatsapp.com"]') : null;
    if (!el) return;
    var href = el.href || '';
    var waBody = {
      session_id: getSessionId(),
      visitor_id: getVisitorId(),
      path: window.location.pathname || '/',
      target_url: href,
      target_phone: (href.match(/\d{8,15}/) || [])[0] || null,
    };
    if (pageViewId) waBody.page_view_id = pageViewId;
    apiPost('/api/v1/wa-link-clicks', waBody);
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

## Website SPA (React/Vite)

Untuk SPA (React Router, Vue Router, dll.):

1. **`session_id` wajib stabil** per tab — simpan di `sessionStorage` (`synckerja_session_id`), jangan buat UUID baru tiap route change.
2. **Server merge first-touch** — meski page view internal tanpa `?utm_*`, atribusi landing tetap terikat ke `session_id` yang sama.
3. **Best practice client:** persist UTM + click ID first-touch ke `sessionStorage` saat landing, lalu kirim field tersebut di **setiap** `POST /traffic-logs` (SDK resmi sudah melakukan ini).
4. **`page_url`:** kirim `window.location.href` lengkap; UTM di query tetap diekstrak otomatis bila body kosong.

Integrasi manual (React):

```javascript
// Panggil di router afterEach / useEffect route
await fetch(apiBase + '/api/v1/traffic-logs', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id: getSessionId(),       // sessionStorage — stabil per tab
    visitor_id: getVisitorId(),       // localStorage
    page_url: window.location.href,
    referrer: document.referrer || null,
    ...getAttributionPayload(),       // UTM first-touch dari sessionStorage (opsional tapi disarankan)
  }),
});
```

Dashboard Synckerja (`/digital-marketing/traffic`) menampilkan UTM Tracking per **sesi** dengan atribusi first-touch landing, bukan hanya page view yang masih membawa query UTM.

---

## Dashboard traffic & sinkronisasi data

Integrasi website dan tampilan dashboard Synckerja Office adalah **dua tahap terpisah**. Developer eksternal sering salah diagnosa “website tidak kirim data” padahal ingest sudah sukses.

### Alur data

```
Website SDK/API
  → POST /traffic-logs, /click-events, …  (HTTP 201 = diterima)
  → Tabel mentah (analytics_sessions, analytics_page_views, analytics_click_events)
  → Rollup harian (debounce ~45 detik setelah ingest)
  → RPC get_traffic_dashboard
  → UI /digital-marketing/traffic (poll otomatis ~45 detik)
```

| Tahap | Arti untuk developer |
|-------|----------------------|
| **HTTP 201** | Payload valid; baris mentah tersimpan atau di-update. **Bukan** jaminan angka dashboard langsung naik. |
| **Rollup harian** | Agregasi per hari (grafik series, sebagian KPI/top pages). Dijalankan otomatis setelah ingest (debounce) atau manual via Sync data. |
| **Dashboard UI** | Membaca rollup + raw (UTM Tracking / Sumber Traffic memakai atribusi sesi first-touch). UI mem-poll ~45 detik saat halaman Traffic terbuka. |

### Latensi wajar (setelah v1.4.2)

- **Ingest → raw DB:** hampir seketika (201).
- **Rollup otomatis:** debounce ~45 detik per `web_id` (today + yesterday WIB).
- **Dashboard tanpa klik Sync:** poll UI ~45 detik → worst case ~**90 detik** sampai KPI/UTM terlihat naik.
- **Grafik harian (series):** bergantung rollup; tunggu rollup selesai (sama ~45–90 detik) atau klik Sync data.

### Tombol Sync data (Synckerja Office)

- Hanya di dashboard **Traffic overview** (role owner/admin).
- **Refresh rollup** untuk rentang tanggal yang dipilih — **bukan** meminta website mengirim ulang event.
- Berguna untuk: instalasi pertama, backfill range lama, atau jika rollup otomatis gagal.

### SPA & atribusi

Lihat [Website SPA (React/Vite)](#website-spa-reactvite): navigasi internal tetap kirim `traffic-logs` dengan `session_id` stabil; UTM first-touch di-merge server-side; lead pakai `session_id` yang sama untuk atribusi.

### Troubleshooting cepat

1. Network browser: POST `/traffic-logs` → **201**? → ingest OK; lanjut cek dashboard Synckerja (bukan bug website).
2. Tunggu **1–2 menit** dengan halaman Traffic overview terbuka (poll otomatis).
3. Masih kosong / grafik nol? Owner/admin: **Sync data** sekali untuk bootstrap rollup.
4. Masih 201 tapi dashboard kosong setelah sync? Cek `web_id` token SDK = properti di Synckerja Office.

---

## WhatsApp otomatis (leads vs invoice)

HTTP **201** pada lead **bukan** jaminan WA terkirim — selalu cek `whatsapp_status` di respons.

| Trigger | Endpoint | Token | Setting template | Syarat kirim |
|---------|----------|-------|------------------|--------------|
| Konfirmasi lead | `POST /api/v1/leads` | SDK | `default_whatsapp_lead_template_name` + `default_whatsapp_lead_template_language` | `consent=true` + `phone_number` + WA terhubung |
| Nota invoice | `POST /api/v1/orders/invoice-trigger` | Server | `default_whatsapp_invoice_template_name` + `default_whatsapp_invoice_template_language` | `phone_number` + template diset |

**Prasyarat org:** WhatsApp Business terhubung (`/omnichannel/integrations/whatsapp`) + template Meta **APPROVED**. Atur template di **Omnichannel → Settings → API Integration → Tokens & SDK** (combobox dari daftar Meta atau nama custom). Field bahasa Meta (mis. `id`, `en_US`) ikut tersimpan; null → fallback `id`. Override per-token via API hanya **nama** template — bahasa mengikuti setting org.

### Prioritas bahasa template lead

1. **Baris mapping aktif** — `organization_whatsapp_templates.template_language` (per `web_id` + `template_name`).
2. **Org setting** — `default_whatsapp_lead_template_language`.
3. **Fallback** — `id`.

### Mapping variabel template lead

Atur mapping di **Omnichannel → Settings → API Integration → Mapping variabel lead** (per `web_id` + template lead org). Website tetap mengirim field di `POST /api/v1/leads`; nama key custom harus **sama** dengan yang dipilih di mapper.

Synckerja memilih mapping **otomatis** saat runtime:

1. **UI mapping (`parameter_mapping`)** — baris aktif di `organization_whatsapp_templates` dengan JSON slot `"1"`…`"n"` → field key.
2. **Legacy `body_keys`** — comma-separated (backward compatible).
3. **Default (fallback)** — jika tidak ada baris / mapping kosong → **7 variabel body** tetap (urutan di bawah).

**Contoh `new_leads_vialdi_id` (7 slot, `web_id=vialdi-wedding`):**

| Slot | Field key | Sumber payload |
|------|-----------|----------------|
| {{1}} | `name` | `name` |
| {{2}} | `email` | `email` |
| {{3}} | `phone_number` | `phone_number` |
| {{4}} | `package_label` | `form_data.package_label` |
| {{5}} | `event_date` | `form_data.event_date` |
| {{6}} | `event_time` | `form_data.event_time` |
| {{7}} | `event_address` | `form_data.event_address` |

**Contoh legacy `elementorform` (5 slot):**

| body_keys (5 slot) | Sumber payload |
|--------------------|----------------|
| `name` | `name` |
| `name` | `name` (duplikat — sesuai template Meta lama) |
| `event_date` | `form_data.event_date` |
| `event_time` | `form_data.event_time` |
| `package_label` | `form_data.package_label` |

**Field `form_data` yang disarankan:** `package_label`, `event_date`, `event_time`, `event_address`, `industry`, `consent`. Reserved keys (`name`, `phone_number`, `email`, `notes`, `session_id`, `status`) tidak masuk `form_data`.

**Fallback fixed 7 variabel** (org tanpa mapping UI / legacy):

1. `name` · 2. `email` · 3. `phone_number` · 4. `package_label` · 5. `event_date` · 6. `event_time` · 7. `event_address`

Field 4–7 dari `form_data` / body JSON. Kosong → `-`.

### `whatsapp_status` / `whatsapp_skip_reason` (leads)

| Status | Arti |
|--------|------|
| `sent` | Template diterima Meta; `whatsapp_message_id` terisi (`wamid....`) |
| `failed` | Graph API menolak (cek `whatsapp_skip_reason` prefix `meta:`) |
| `skipped` | Tidak ada attempt kirim — lihat `whatsapp_skip_reason` |

| skip_reason | Penyebab |
|-------------|----------|
| `no_consent` | `consent` bukan `true` |
| `no_phone` | `phone_number` kosong |
| `no_template` | `default_whatsapp_lead_template_name` belum diset |
| `wa_not_configured` | Akun WA / token Meta belum ada |
| `meta:...` | Error Meta saat `failed` (mis. jumlah variabel body tidak cocok dengan template) |
| `persist_failed:...` | Meta `sent` tapi gagal simpan thread livechat (lead tetap 201; cek log server) |

**Livechat setelah `sent`:** Synckerja membuat/update baris `whatsapp_conversations` + pesan outbound `whatsapp_messages`, merge `ticket_id` lead dari `LEAD-*` ke `WA-*`, dan mengembalikan `whatsapp_conversation_id`. Thread langsung muncul di **Omnichannel → Livechat**; tombol **Open Chat** di halaman Leads aktif.

**Troubleshooting `failed`:** pastikan jumlah variabel template Meta = jumlah `body_keys` legacy **atau** 7 (fallback). Kesalahan umum: setting org pakai template 5-slot tapi baris legacy kosong → API mengirim 7 variabel → Meta error #132000.

---

## Referensi API

Semua endpoint **POST**, respons JSON. Pakai SDK → analytics otomatis; referensi di bawah untuk integrasi manual.

### Analytics

#### POST /api/v1/traffic-logs
Catat kunjungan halaman. Wajib: `session_id` (stabil per tab), `visitor_id`, `page_url`. Opsional: UTM, `gclid`/`fbclid`, `referrer`. Server merge atribusi first-touch per `session_id` — navigasi SPA tanpa UTM tidak menghapus baris UTM Tracking. HTTP **201** hanya setelah baris `analytics_sessions.id = session_id` terverifikasi; `page_view_id` memakai `session_id` yang sama.

```json
// Request
{ "session_id": "...", "visitor_id": "...", "page_url": "https://toko.com/?utm_source=google", "gclid": "..." }

// Response 201 — simpan page_view_id
{ "success": true, "session_id": "...", "page_view_id": "...", "visitor_id": "...", "web_id": "toko-anda" }
```

#### POST /api/v1/page-views/heartbeat
Wajib: `page_view_id`, `active_ms`, `scroll_max_pct`. Opsional: `ended_at` (saat tutup tab). → **SDK otomatis**

#### POST /api/v1/click-events
Wajib: `session_id`, `visitor_id`, `path`, `track_key`. `path` = halaman **tempat klik terjadi** (bukan `target_url`). Server dapat mengoreksi `path` dari page_view aktif; opsional `page_view_id` dari respons `traffic-logs`. Urutan: `traffic-logs` lalu `click-events`. Error **422** `SESSION_NOT_READY`. → **SDK otomatis** via `data-syn-track` (capture phase)

#### POST /api/v1/wa-link-clicks
Wajib: `session_id`, `visitor_id`. Disarankan: `path` (default `/`), `target_url`, `target_phone`. UTM **tidak** dikirim di body — server merge dari `analytics_sessions`. Mencatat analytics **dan** stub lead CRM (`source: WhatsApp floating click`, submission `draft`). Satu stub per session + web_id. → **SDK otomatis** via link wa.me / `data-syn-wa-track`

```json
{ "session_id": "...", "visitor_id": "...", "path": "/konsultasi", "target_url": "https://wa.me/628...", "target_phone": "628..." }
```

```json
// Response 201
{
  "success": true,
  "wa_click_id": "...",
  "lead_id": "...",
  "lead_created": true,
  "lead_sync_status": "synced",
  "lead_sync_error": null
}
```

Urutan disarankan: `traffic-logs` (landing UTM) lalu `wa-link-clicks`. Server upsert parent `analytics_sessions` sebelum insert. Error **422** `SESSION_NOT_READY` jika session tidak siap. Jika `lead_sync_status=failed`, analytics tetap tersimpan — cek `lead_sync_error`.

### Leads

#### POST /api/v1/leads
Wajib: `name`. Minimal salah satu `phone_number` atau `email`. Opsional: `session_id` (atribusi UTM + gclid/fbclid; **upgrade stub** jika session sama dengan klik floating WA), `notes`, `consent`, `form_id`. **Field lain** → `lead_submissions.form_data` (maks. 64 key, 32 KB, flat JSON).

Jika `consent=true` + `phone_number` + template lead diset → WA konfirmasi otomatis (biasanya ≤ 1 menit). Lead **tetap 201** meski WA gagal. Cek `whatsapp_status`; jika `failed`, baca `whatsapp_skip_reason` (`meta:...` = error Meta).

```json
{
  "session_id": "...",
  "name": "John Doe",
  "email": "john.doe@example.com",
  "phone_number": "+6281234567890",
  "consent": true,
  "form_id": "contact-main",
  "package_label": "Konsultasi umum",
  "event_date": "2026-06-09",
  "event_time": "14:30",
  "event_address": "Jl. Contoh No. 10, Jakarta"
}
```

```json
// Response 201 — sukses WA + thread livechat (contoh production vialdi-wedding / elementorform)
{
  "success": true,
  "lead_id": "...",
  "ticket_id": "WA-F8B0674B",
  "whatsapp_ticket_id": "WA-F8B0674B",
  "whatsapp_status": "sent",
  "whatsapp_message_id": "wamid.HBgNNjI4MTM4NDA1NjExOBUCABEYEkU1MDJFQTVFMUI0QTUwMjVDNwA=",
  "whatsapp_conversation_id": "uuid-conversation",
  "whatsapp_skip_reason": null,
  "attribution": { "utm_source": "test_dev", "web_id": "vialdi-wedding" }
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

# POS-kasir-mobile

UI surface for **Synckerja POS** (tablet-first), separate from Synckerja Office (`android-mobile/` + native `android/`).

**Native POS shell:** [`android-pos/`](../android-pos/) — package `id.synckerja.pos` (Play listing terpisah). Sync: `npm run android-pos:prepare`. Cold start membuka `/pos`. Printer Bluetooth hanya di app POS.

## Current routes

| Path | Screen | Auth |
|------|--------|------|
| `/pos` | Welcome / get-started | Public |
| `/pos/login` | Sign in — email step | Public |
| `/pos/login/password` | Sign in — password step | Public |
| `/pos/login/mfa` | MFA challenge (POS shell) | Public |
| `/pos/register` | Register (POS shell) | Public |
| `/pos/forgot-password` | Forgot password (POS shell) | Public |
| `/pos/select-outlet` | Choose outlet after login/2FA | Authenticated |
| `/pos/cashier` | Cashier (grid + bill + bottom nav) | Authenticated |
| `/pos/table-map` | Table Map (read-only floor plan) | Authenticated |
| `/pos/settings` | Settings (master–detail) | Authenticated |
| `/pos/shift` | Shift / cash drawer (master–detail) | Authenticated |
| `/pos/inventory` | Inventory (read-only ingredient stock) | Authenticated |
| `/pos/kitchen` | Kitchen Display (ticket board) | Authenticated (`app.kitchen_display`) |
| `/pos/activity` | Activity / sales history | Authenticated |

Office routes `/login`, `/register`, and `/` are **not** POS entry/land points.

## Folder layout

```
POS-kasir-mobile/
  0-welcome/
  0-auth/
  1-outlet-select/
  2-cashier/
    components/
      sidebar/          # Brand-blue menu drawer
  3-settings/           # Master–detail settings
    components/hardware/
      printer/          # Printer list, Bluetooth discover, edit roles, ticket prefs
    lib/printer/        # Types, localStorage, Bluetooth scan hook
  4-shift/              # Cashier shift / cash drawer
    components/
    lib/                # settings + shift hooks, totals, copy
    pages/
  5-table-map/          # Read-only floor plan + occupancy (sessions)
    components/
    hooks/
    lib/                # selected table storage, duration format
    pages/
  6-inventory/          # Read-only ingredient stock (SSOT: Ingredient Library)
    components/
    lib/                # filter + copy
    pages/
  7-activity/           # Sales history master–detail
  8-kitchen/            # Kitchen Display System (KDS board)
    components/         # Board, tabs, ticket cards
    hooks/              # Tickets query + status mutations
    lib/                # Types, create/void/done helpers, copy
    pages/
  shared/
    layout/
    hooks/
    access/             # Tablet entitlement + post-outlet path
    printing/           # Bridge + ESC/POS + posPrintService
  index.ts
```
Import alias: `@/pos-mobile/*` → this folder.

## Flow

1. `/pos` → login → (MFA) → org/plan gates → `/pos/select-outlet`
2. **Lanjutkan** → `/pos/cashier` (never Office `/`)
3. Cashier: add products → **Bayar** (walk-in cash checkout; requires open shift or auto-start)
4. Menu → **Pengaturan** → `/pos/settings`
5. Menu → **Shift** → `/pos/shift`
6. Menu → **Denah Meja** → `/pos/table-map` (tap table → cashier; Save Bill marks Occupied + live duration)

## Menu sidebar (from footer Menu)

Brand-blue left drawer:

| Item | Behavior |
|------|----------|
| Denah Meja | → `/pos/table-map` |
| Point of Sale | → `/pos/cashier` |
| Kitchen | → `/pos/kitchen` (role with `app.kitchen_display`) |
| Pesanan Online | Coming soon toast |
| Aktivitas | → `/pos/activity` |
| Inventori | → `/pos/inventory` |
| Shift | → `/pos/shift` |
| Pengaturan | → `/pos/settings` |
| Ganti outlet (footer) | → `/pos/select-outlet` |
| Keluar (footer) | Clear POS surface → `/pos/login` |

## Kitchen Display (`/pos/kitchen`)

Phase 1 board for dine-in **Simpan Bill**:

1. Kasir: cart → Simpan Bill → meja → session open → **KDS ticket** created (independent of Bluetooth printer / `printTicketOnPay`).
2. Dapur: tabs Baru | Sedang | Siap — tap card advances status; Ready → Done leaves the board.
3. Bayar / cancel bill closes or voids active tickets for that session.
4. Product void on tickets still `new` reduces lines; cooking tickets unchanged.

Realtime: `pos_kitchen_tickets` filtered by `outlet_id`. Schema: `scripts/qa/verify-pos-kitchen-tickets.sql`.

## Settings (`/pos/settings`)

Two-pane tablet UI: profile + section nav (left), detail panel (right), blue footer (Menu + outlet name).

- **Pengaturan Pesanan Online** — device toggles + notification sound (localStorage per outlet)
- **Pembayaran** (group):
  - **Pembayaran** — digital payment panel (T&C notice, learn CTA, mock GOPAY/OVO/DANA Approved)
  - **Pajak** — toggle `tax_enabled` (`catalog_checkout_settings`, same as `/operations/settings/checkout`) + outlet tax list (`useCatalogTaxes` + `filterTaxesForOutlet`; same rates as receipt preview). Nav “Aktif” follows toggle.
  - **Biaya Tambahan** — toggle `gratuity_enabled` + outlet gratuity list (`useCatalogGratuities`; same as `/operations/library/gratuity`). Nav “Aktif” follows toggle. Kasir/receipt tetap memakai filter sales-type yang sudah ada.
  - **Pengaturan Pembayaran** — row “Pengaturan Pajak dan Biaya Tambahan” (pilih `application_method` add/include seperti screenshot; sync `/operations/settings/checkout`) + toggle **Monitor Pegawai** (device prefs lokal).
    - **Belum termasuk (`add`)**: pajak + biaya ditambahkan ke total dan ditagihkan.
    - **Sudah termasuk (`include`)**: total = harga menu; rincian pajak/biaya tetap di bill & receipt.
- **HARDWARE** (group):
  - **Printer** — daftar printer Bluetooth (Refresh → discover/pair), nama panggilan, toggle peran (Struk/Bill, Tiket, Antrian, Shift; Label Stiker N/A untuk BT), prefs Tiket Pesanan (copies 1–5, cetak saat bayar, per-produk disabled untuk BT). Storage: `localStorage` per outlet (`synckerja_pos_printers_{outletId}`). Cetak ESC/POS via Capacitor plugin `PosBluetoothPrinter` di **`android-pos`** (SPP); tidak ada di Office `android/`.
  - **Barcode Scanner / GoBiz PLUS EDC / Customer Display** — segera hadir.
- **AKUN** (group):
  - **Bahasa** — pilih Indonesia / English (`useLanguage` + `deviceOnly: true`); status nav menampilkan ID/EN.
  - **Profil** — edit **outlet aktif** (`readPosSelectedOutletId` + `usePosOutlets` / `pos_outlets`, sama dengan `/operations/settings/outlets-list`). Field: nama, alamat, logo (receipt), provinsi, kota, kode pos, telepon, status. Simpan + `stashPosSelectedOutlet`. Bukan profil akun user.
  - **Bantuan** — segera hadir.
  - Tombol **KELUAR** coral di bawah nav kiri (logout sama drawer kasir).
- Query `?section=payment|tax|surcharge|payment-settings|printer|language|…`; default is online orders

### Printer + kasir (best practice)

| Setting | Default | Perilaku |
|---------|---------|----------|
| Cetak Tiket Saat Bayar | OFF | **Simpan Bill** mencetak tiket dapur; Pay mencetak struk jika role aktif |
| Cetak Tiket Saat Bayar | ON | Tiket dicetak setelah Pay sukses; Simpan Bill tidak mencetak tiket |
| Cetak per Produk | OFF (BT) | Satu slip gabungan; per-unit hanya untuk Epson (belum di fase ini) |
| Copies | 1 | Mengulang payload tiket N kali |

**Smoke checklist (Android tablet):**
1. Pair printer di system Bluetooth, buka `/pos/settings?section=printer` → Refresh → pilih device → Simpan dengan Struk + Tiket ON.
2. Kasir: tambah item → Simpan Bill → tiket keluar (jika print-on-pay OFF).
3. Print Bill → bill draft keluar.
4. Bayar → struk keluar; jika print-on-pay ON, tiket juga keluar.
5. Di browser desktop: UI + storage OK; Refresh menampilkan pesan “hanya di app Android”.

### Receipt (F&B practice)

- **Tampilkan** di guest receipt: pajak + biaya yang dipungut dari pelanggan (service charge, take-away, platform fee ke tamu) — perilaku Synckerja existing saat rate applicable.
- **Jangan** assign fee internal (komisi owner, profit sharing) ke sales type customer-facing jika tidak ingin tercetak di receipt tamu.

## Shift (`/pos/shift`)

Master–detail seperti Settings. Data: `pos_outlet_shift_settings`, `pos_cashier_shifts`, `pos_cash_movements`; penjualan kasir di-tag `sales_activities.pos_shift_id`.

| Nav | Perilaku |
|-----|----------|
| **Pilihan Shift** (default) | Toggle *Memulai Shift Otomatis* + *Saldo Tunai Awal*. Status nav Aktif/Tidak Aktif. |
| **Shift Saat Ini** | Manual: Saldo Tunai + **Mulai Shift**. Aktif: detil, kas±, produk terjual, ringkasan TUNAI / expected, **Akhiri Shift** (Cetak = stub). |
| **Histori Shift** | List shift `closed` (opening + expected). |

- **Auto ON**: Pay / load Shift Saat Ini memanggil `pos_ensure_open_shift` dengan float default — kasir bisa transaksi tanpa buka menu.
- **Auto OFF**: Pay tanpa shift open → toast + redirect `/pos/shift?section=current`.
- **Kas Keluar/Masuk**: `?section=cash-io` — deskripsi, KAS MASUK/KELUAR, nominal, Kirim → Konfirmasi; mengurangi/menambah expected cash.
- Satu shift `open` per outlet (unique index).

**Smoke checklist:**
1. `/pos/shift` → Pilihan Shift → set auto OFF + float 100.000 → Simpan (blur/toggle).
2. Shift Saat Ini → Mulai Shift → Pay di kasir → expected naik.
3. Kas Keluar “Keresek” 30.000 → Konfirmasi → expected turun; list history di panel kas.
4. Akhiri Shift → muncul di Histori.
5. Set auto ON → tutup shift → Pay di kasir tanpa buka Shift → shift auto-open.

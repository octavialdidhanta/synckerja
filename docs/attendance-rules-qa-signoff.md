# Attendance Rules — QA Manual Sign-off

**Environment:** Linked Supabase demo  
**Org:** `663c9336-8cb6-4a36-9ad9-313126e70a1a` (Synckerja)  
**Tester user:** OCTA — `001b6725-bf16-4a2f-81ae-8960cf86c46d` (EMP-00001)  
**Office:** `AR Fresh Demo HQ` — lat `-6.136758`, lng `106.785000`, radius `100 m`

---

## Prasyarat

1. Supabase project **linked** (`npx supabase link` sudah OK).
2. Login aplikasi sebagai user OCTA (web + mobile APK).
3. Dev server atau build Capacitor Android dengan izin **kamera + GPS**.
4. Untuk **W2**: catat IP publik dari [https://ipapi.co/json](https://ipapi.co/json) sebelum prep.
5. OKR check-in (`ObjectiveAttendanceCheckIn`) **tidak di-wire** — skenario **W5 N/A**.

---

## Preflight (otomatis + prep SQL)

```bash
# Gate otomatis (S1/S2)
npm run verify:attendance-rules

# Edit scripts/attendance-rules-qa-prep.sql — ganti YOUR_PUBLIC_IP dengan IPv4 tester
npm run supabase:db:push:attendance-rules-qa-prep
```

Preflight JSON harus menunjukkan:

- `face_reg_count_octa` = **0** (W4 siap)
- `holiday_today` berisi **QA Manual Holiday Today**
- `w3_rpc_holiday_block` → `can_attend` = **false**

---

## Urutan skenario (hindari konflik state)

```text
1.  S1/S2  — otomatis (verify:attendance-rules)
2.  W3     — libur block (UI) → toast/error, NO record
3.  Partial cleanup — hapus libur saja (C1 di cleanup SQL atau re-run prep tanpa P4)
4.  W4     — first face reg setelah prep hapus wajah
5.  W1     — web home check-in sukses
6.  W2     — desktop IP fallback (GPS deny/mock fail)
7.  M1     — mobile check-in fisik + foto (onsite HQ atau mock di radius)
8.  M3     — mobile check-out + foto
9.  M4     — mobile luar radius → block
10. post-check SQL
11. qa-cleanup full
```

**Partial cleanup (setelah W3, sebelum W4/W1):** jalankan hanya blok C1:

```sql
DELETE FROM public.national_holidays nh
WHERE nh.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND nh.name = 'QA Manual Holiday Today';
```

Atau: `npm run supabase:db:push:attendance-rules-qa-cleanup` lalu **re-run prep tanpa holiday** (comment P4) jika perlu face/IP backup ulang.

---

## Instruksi per skenario

### Mobile (`android-mobile/1-home/pages/Absensi.tsx`)

| ID | Langkah | Expected |
|----|---------|----------|
| **M1** | Di radius HQ → Clock In → ambil foto | Toast sukses; record + `check_in_photo_path` di DB |
| **M3** | Setelah M1 → Clock Out → foto | `check_out_photo_path` terisi |
| **M4** | Mock GPS jauh / offsite → Clock In | Toast lokasi invalid; tidak ada record baru |

**Storage:** Dashboard → Storage → `attendance-photos` → `{employeeId}/`

### Web home (`SimpleAttendanceCamera` + `useSimpleAttendance`)

| ID | Setup | Langkah | Expected |
|----|-------|---------|----------|
| **W1** | Normal (libur sudah dihapus) | Check-in + foto | Sukses |
| **W2** | IP seeded di prep; Chrome deny location | Check-in + foto | Toast WiFi/IP; sukses jika IP match |
| **W3** | Prep libur TODAY | Check-in | Block libur meski lokasi/IP OK |
| **W4** | Prep face deleted | Check-in pertama | Toast wajah terdaftar → sukses |
| **W5** | — | — | **N/A** (OKR dormant) |

### Opsional (~5 menit)

Buka `AttendanceRulesSettings.tsx` — toggle Save masih persist.

---

## Checklist sign-off

| ID | Skenario | Langkah ringkas | Expected | Actual | PASS/FAIL | Penguji | Tanggal | Catatan |
|----|----------|-----------------|----------|--------|-----------|---------|---------|---------|
| S1 | Verify SQL matrix | `npm run supabase:db:push:attendance-rules-verify` | 0 failures `_ar_verify` | 12/12 PASS | **PASS** | Agent | 2026-05-31 | Via verify combo |
| S2 | Fresh-demo T08c/T08d | Bagian dari `verify:attendance-rules` | ALL PASS | ALL PASS | **PASS** | Agent | 2026-05-31 | |
| W3 | Web libur block | Check-in hari libur | Block, no record | | PENDING MANUAL | | | |
| W4 | Web auto-reg wajah | Check-in pertama tanpa face | Reg + sukses | | PENDING MANUAL | | | |
| W1 | Web home check-in | Check-in + foto | Sukses | Toast keterlambatan + modal alasan; flow check-in jalan | **PASS** | Tester | 2026-05-31 | Web home `useSimpleAttendance` — validasi + late reason UI OK |
| W1b | Web home — bukan hari kerja | Jadwal `tes` (Min off / hari ini off) → Clock In | Block + pesan jadwal | Toast *Clock In Gagal*: *Bukan hari kerja sesuai jadwal* | **PASS** | Tester | 2026-05-31 | Schedule enforcement via RPC + UI; no record |
| W2 | Web IP fallback | GPS fail, IP match | Sukses via IP | | PENDING MANUAL | | | |
| M1 | Mobile clock-in | Radius + foto | Sukses + path DB | | PENDING MANUAL | | | |
| M3 | Mobile clock-out | Foto checkout | `check_out_photo_path` | | PENDING MANUAL | | | |
| M4 | Mobile luar radius | Clock-in offsite | Block lokasi | | PENDING MANUAL | | | |
| W5 | OKR check-in | — | N/A skip | N/A | N/A | | | Dormant |
| P1 | Post-check SQL | `npm run supabase:db:push:attendance-rules-qa-post-check` | ALL PASS `_ar_qa_post` | P1a/P1b FAIL (no manual yet) | **PENDING** | Agent | 2026-05-31 | Re-run after M1/M3 |

---

## Post-check & cleanup

```bash
npm run supabase:db:push:attendance-rules-qa-post-check
npm run supabase:db:push:attendance-rules-qa-cleanup
```

---

## Sign-off block

- [ ] Semua skenario (kecuali W5 N/A) **PASS**
- [ ] Post-check SQL **ALL PASS**
- [ ] Cleanup selesai (holiday QA, IP QA, face restored)

| Field | Value |
|-------|-------|
| Approver | |
| Tanggal sign-off | |
| Commit / deploy ref | |
| Catatan | |

---

## Eksekusi otomatis (2026-05-31)

### S1/S2 — `npm run verify:attendance-rules`

| Gate | Result |
|------|--------|
| fresh-demo `_ar_verify` | **PASS** (0 failures) |
| verify SQL V01–V12 | **12/12 PASS** |
| unit tests | **16/16 PASS** |
| spot-check RPC | **PASS** (`photo_ok_with_face.can_attend=true`, `outside_radius.can_attend=false`) |

### QA prep SQL (preflight)

| Check | Result |
|-------|--------|
| `face_reg_count_octa` | **0** (W4 ready) |
| `face_backup_count` | **1** |
| `holiday_today` | **QA Manual Holiday Today** inserted |
| `w3_rpc_holiday_block` | `is_holiday=true`, `can_attend=false` **PASS** |
| `allowed_ips_qa` | Seeded — **edit `YOUR_PUBLIC_IP` before W2** |

### Post-check SQL (tanpa manual M1/M3)

Dijalankan sebelum tester menyelesaikan M1/M3 — expected **FAIL** pada P1a/P1b (no record). Jalankan ulang setelah manual QA.

| Check | Result | Catatan |
|-------|--------|---------|
| P1a check-in record | **FAIL** | No attendance record (manual belum dijalankan) |
| P1b photo path | **FAIL** | No record |
| P1c checkout path | **PASS** | Vacuous (no checkout yet) |
| P1e RPC HQ | **FAIL** | Holiday masih aktif saat post-check di prep state |

### Cleanup SQL

| Check | Result |
|-------|--------|
| Holiday QA removed | **0** remaining |
| QA IP removed | **0** remaining |
| Face restored OCTA | **1** registration |
| Attendance today cleared | **0** records |

### Manual QA (W1–W4, M1–M4)

**PENDING MANUAL** — isi kolom Actual / PASS/FAIL di checklist setelah sesi perangkat fisik + browser.

# TikTok Content Posting API — Catatan Pengisian Direct Post Audit

Dokumen ini adalah panduan melanjutkan atau mengulang form **Application to request access to Content Posting API** untuk app TikTok Developer **Synckerja Office**.

> Ini **Direct Post Audit**, bukan App Review ulang. App Synckerja Office sudah Live. Audit ini diperlukan agar Direct Post dapat memublikasikan video ke akun TikTok Public dengan visibility Public/Followers.

## Status terakhir — 27 Juli 2026

- App TikTok Developer: **Synckerja Office**
- App ID portal: `7654513562417039368`
- Environment: **Production** · App status: **Live**
- **Direct Post: Approved** (provisioned access for users)
- Upload to TikTok (draft inbox) tetap enabled by default
- `push_by_file` / `FILE_UPLOAD`: siap dipakai (implementasi Synckerja)
- `pull_by_url` / `PULL_FROM_URL`: butuh **Verify domains** di portal (belum wajib — kita pakai FILE_UPLOAD)
- Default visibility di app: **PUBLIC_TO_EVERYONE** (tetap dihormati lewat `creator_info.privacy_level_options`)

## Sebelum mulai lagi

Siapkan:

1. Nama lengkap penanggung jawab.
2. File demo MP4, maksimal 50 MB.
3. Demo terbaru harus menampilkan:
   - aplikasi pada `https://office.synckerja.com`;
   - Connect TikTok account;
   - klik **Authorize publishing**;
   - halaman consent harus bertuliskan **Synckerja Office**, bukan Synkerja Content Insight;
   - Post Now/Schedule dari content plan;
   - hasil publish/status Published dan video muncul di akun TikTok.

Jika video lama masih memperlihatkan **Synkerja Content Insight** pada tahap Authorize publishing, rekam dan upload video baru. Connect pertama untuk insight memang boleh bertuliskan Synkerja Content Insight; tahap **Authorize publishing** harus bertuliskan Synckerja Office.

## Cara membuka form dari awal

1. Buka TikTok for Developers.
2. Pilih app **Synckerja Office** pada mode **Production**.
3. Buka **Products → Content Posting API**.
4. Pada bagian **Direct Post**, klik **Apply**.
5. Isi empat langkah berikut.

---

## Step 1 — General Information

### Full Name

Isi nama lengkap penanggung jawab aplikasi.

### Organization name

```text
Synckerja Office
```

### Organization website

```text
https://office.synckerja.com
```

### Describe your organization's work as it relates to TikTok

```text
Synckerja Office (https://office.synckerja.com) is a B2B marketing operations platform used by marketing teams to plan, review, approve, and publish social media content from an internal content calendar. For TikTok, organization admins connect their own TikTok creator accounts and use our scheduler to Direct Post approved videos sourced from Google Drive to their profiles, and to view organic video performance such as views, likes, comments, and follower statistics.
```

### TikTok representative email address

Kosongkan jika tidak memiliki kontak langsung karyawan TikTok.

Klik **Next**.

---

## Step 2 — API client information

### Input the App ID that wants to access Content Posting API

```text
7654513562417039368
```

Pastikan ini App ID app **Synckerja Office** yang sedang dibuka di portal.

### Explain the goal of your application and how Content Posting API integration can be beneficial

```text
Synckerja Office (https://office.synckerja.com) is a marketing operations platform where teams plan, review, and approve social content in an internal calendar. The Content Posting API lets an organization admin publish an approved TikTok video directly from Synckerja to their own connected creator profile, without manually re-uploading it in the TikTok app.

The administrator connects their TikTok account via Login Kit and authorizes publishing through Synckerja Office. On an approved content plan, they click Post Now or Schedule. We query creator_info for the creator's allowed privacy and interaction settings, initialize a FILE_UPLOAD post, upload the video sourced from the organization's Google Drive, and poll the publishing status until completion. Only authorized organization administrators can initiate publishing to accounts they have connected.

This integration removes manual re-uploading, keeps publishing timely and consistent, and ensures that content passes the organization's approval workflow before it is posted.
```

### Approximately how many users use your API client(s) daily?

Pilih:

```text
101–300
```

### Explain how you determined the daily usage estimate

```text
We estimated 101–300 publishing users per day based on Synckerja Office's go-live plan for marketing teams. Each organization typically connects 1–3 TikTok creator accounts, and only authorized organization administrators publish through Schedule or Post Now after content approval. Early production usage is expected to be in the low hundreds of publishing users per day, so 101–300 is a conservative estimate that covers initial customer adoption without requesting an oversized quota.
```

Klik **Next**.

---

## Step 3 — Supporting documents

### Screen recording

Upload demo terbaru:

- Format: MP4
- Maksimum: 50 MB per file
- Maksimum: 3 file
- Harus menampilkan authorization, proses Post Now/Schedule, dan hasil sesudah publish
- Pada tahap publishing authorization, consent harus menampilkan **Synckerja Office**

### Please list the API response data fields that your API client will save in its database

Copy-paste:

```text
We save only the minimum data required to track and display the publishing result: publish_id, publicly_available_post_id (stored as the external TikTok post ID), the final publishing outcome/status, and the failure message or TikTok log_id when applicable. We also store an internal upload-completed flag, the connected account open_id, the selected privacy level, caption/title, scheduled time, and the resulting public post URL. We do not store the temporary upload_url, uploaded video bytes, or complete raw API responses. OAuth access and refresh tokens are stored separately in encrypted form on the server and are never exposed to end users.
```

Klik **Next**.

---

## Step 4 — Review

Sebelum submit, periksa:

- App yang diajukan adalah **Synckerja Office**
- App ID adalah `7654513562417039368`
- Website adalah `https://office.synckerja.com`
- Estimasi adalah `101–300`
- Video terbaru menampilkan consent publishing **Synckerja Office**
- Tidak ada Client secret, access token, atau Supabase service-role key di video

Klik **Submit** dan simpan screenshot status submission.

## Setelah Direct Post Approved (27 Juli 2026)

1. ~~Tunggu status Direct Post Audit menjadi approved.~~ **Done — Approved.**
2. Uji **Post Now** dengan akun TikTok Public dan visibility **Public** (`PUBLIC_TO_EVERYONE`).
3. Uji Schedule dan pastikan status menjadi Published.
4. Jika token publish lama (dari masa pre-approval), org admin boleh **Authorize publishing** ulang.
5. Domain verification untuk `pull_by_url` opsional — pipeline produksi memakai `FILE_UPLOAD`.

## Catatan penting

- **App Live/App Review** dan **Direct Post Audit** adalah dua persetujuan berbeda.
- App sudah Live, sehingga tidak perlu mengulang App Review.
- Form ini khusus meminta pembukaan Direct Post untuk akun Public.
- App **Synkerja Content Insight** tetap dipakai untuk insights/comments.
- App **Synckerja Office** dipakai untuk `video.upload` dan `video.publish`.

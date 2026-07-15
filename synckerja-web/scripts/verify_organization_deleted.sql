-- Verifikasi zero residue setelah CMS hard-delete organisasi.
-- Ganti placeholder dengan UUID org yang sudah dihapus (atau org dummy staging).

-- 1) RPC ringkas (butuh login CMS admin)
SELECT public.admin_verify_organization_deleted('00000000-0000-0000-0000-000000000000'::uuid);

-- 2) Audit trail (harus ada 1 baris, tanpa FK ke organizations)
SELECT id, organization_id, company_name, deleted_by, reason, created_at
FROM public.cms_organization_deletions
WHERE organization_id = '00000000-0000-0000-0000-000000000000'::uuid
ORDER BY created_at DESC
LIMIT 1;

-- 3) Manual: semua tabel public dengan organization_id (harus 0 kecuali cms_organization_deletions)
SELECT c.table_name,
       (
         SELECT count(*)::bigint
         FROM pg_catalog.pg_class cls
         JOIN pg_catalog.pg_namespace nsp ON nsp.oid = cls.relnamespace
         WHERE nsp.nspname = 'public'
           AND cls.relname = c.table_name
           AND cls.relkind = 'r'
       ) IS NOT NULL AS is_table
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.column_name = 'organization_id'
  AND c.table_name NOT IN ('cms_organization_deletions')
ORDER BY c.table_name;

-- 4) Staging test checklist (manual)
-- - Buat org dummy + 1 user eksklusif + 1 employee + 1 payment row (jika ada)
-- - Upload file ke storage path {org_id}/...
-- - Hapus via CMS Zona bahaya
-- - admin_verify_organization_deleted → is_clean = true
-- - auth.users: user eksklusif tidak ada
-- - storage: prefix org kosong di semua bucket

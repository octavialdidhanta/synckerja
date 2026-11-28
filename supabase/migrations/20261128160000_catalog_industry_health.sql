-- Industry template for clinics and health services, the industry where claims are most sensitive
-- (sembuh, permanen, tanpa efek samping, aman, klinis, dokter). Same scene kinds as the other packs.
-- Not applied to any organization here; an owner picks it in Content Studio → Pengaturan.

INSERT INTO public.catalog_industry_templates (code, label, description, position)
VALUES ('health', 'Klinik & kesehatan', 'Klinik, perawatan, layanan kesehatan', 7)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.catalog_industry_template_menu_fields (template_code, field_key, label, position) VALUES
  ('health', 'main', 'Layanan / perawatan', 1),
  ('health', 'procedure', 'Tahapan yang terlihat', 2),
  ('health', 'setting', 'Ruangan & alat', 3),
  ('health', 'audience', 'Untuk siapa', 4),
  ('health', 'larangan', 'Larangan (must NOT)', 5),
  ('health', 'khusus', 'Aturan khusus', 6)
ON CONFLICT DO NOTHING;

INSERT INTO public.catalog_industry_template_tags (template_code, key, label, applies_to, value_type, position) VALUES
  ('health', 'watermark_ui', 'Watermark/UI', 'scene', 'bool', 1),
  ('health', 'face_visible', 'Wajah pasien terlihat', 'scene', 'bool', 2),
  ('health', 'procedure_visible', 'Tindakan terlihat', 'scene', 'bool', 3),
  ('health', 'medical_staff', 'Tenaga medis terlihat', 'scene', 'bool', 4)
ON CONFLICT DO NOTHING;

INSERT INTO public.catalog_industry_template_scene_kinds (template_code, key, label, position)
SELECT 'health', k.key, k.label, k.position
FROM public.catalog_industry_template_scene_kinds k
WHERE k.template_code = 'fnb'
ON CONFLICT DO NOTHING;

-- Words that state a medical or safety fact. claim_check flags them; only an approved claim
-- in the Daftar Klaim may back them.
UPDATE public.catalog_industry_templates SET claim_words = ARRAY[
  'sembuh','menyembuhkan','pasti sembuh','sembuh total','permanen','selamanya','tanpa efek samping','efek samping',
  'tanpa rasa sakit','tidak sakit','nggak sakit','bebas nyeri','aman','100% aman','aman untuk ibu hamil','klinis',
  'teruji klinis','uji klinis','terbukti','dokter','direkomendasikan dokter','dokter spesialis','spesialis',
  'bersertifikat','tersertifikasi','izin kemenkes','kemenkes','terdaftar','bpom','fda','halal','steril',
  'hasil instan','langsung terlihat','sekali treatment','sekali datang','tanpa operasi','tanpa bekas','tanpa downtime',
  'alami','herbal','garansi','jaminan','mengatasi','menghilangkan','mencegah','obat'
] WHERE code = 'health';

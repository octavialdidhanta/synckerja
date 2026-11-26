-- Claim words per industry for the brief claim check (MCP claim_check). The universal patterns (numbers with a unit,
-- prices, superlatives, guarantees) live in the MCP server; these are the words that state a fact in one industry.
-- An organization adds its own words in Gaya baku ("Kata klaim: ..."), so nothing here is Sate Sultan specific.

ALTER TABLE public.catalog_industry_templates
  ADD COLUMN IF NOT EXISTS claim_words text[] NOT NULL DEFAULT '{}';

UPDATE public.catalog_industry_templates SET claim_words = ARRAY[
  'muda','segar','fresh','empuk','juicy','gurih','homemade','rumahan','resep rahasia','turun-temurun','turun temurun',
  'tanpa msg','tanpa pengawet','tidak bau','nggak bau','tidak amis','nggak amis','prengus','dimasak','direbus','dibakar',
  'dipanggang','dimarinasi','diungkep','diasap','rempah','porsi jumbo','porsi besar','kenyang','habis','sold out',
  'antre','antri','viral','impor','lokal','organik'
] WHERE code = 'fnb';

UPDATE public.catalog_industry_templates SET claim_words = ARRAY[
  'katun','cotton','linen','sutra','kulit asli','genuine leather','adem','tidak luntur','nggak luntur','anti kusut',
  'stretch','all size','oversize','handmade','limited','eksklusif','jahitan rapi','tebal','tidak menerawang',
  'nggak nerawang','brand lokal'
] WHERE code = 'fashion';

UPDATE public.catalog_industry_templates SET claim_words = ARRAY[
  'fast charging','pengisian cepat','awet','tahan lama','anti air','waterproof','tahan air','ip67','ip68','garansi resmi',
  'bluetooth','wireless','kompatibel','compatible','support','4k','full hd','anti gores','anti panas','hemat daya'
] WHERE code = 'electronics';

UPDATE public.catalog_industry_templates SET claim_words = ARRAY[
  'dekat','bebas banjir','strategis','shm','hgb','imb','pbg','legalitas','cicilan','dp 0','tanpa dp','kpr','sea view',
  'siap huni','keamanan 24 jam','one gate','akses tol','investasi','naik nilai','roi','fasilitas lengkap'
] WHERE code = 'property';

UPDATE public.catalog_industry_templates SET claim_words = ARRAY[
  'bpom','glowing','cerah','mencerahkan','memutihkan','jerawat','acne','flek','kerutan','anti aging','awet muda',
  'menghilangkan','tahan lama','long lasting','waterproof','non comedogenic','kulit sensitif','dermatologically tested',
  'hypoallergenic','alami','natural','tanpa paraben','tanpa alkohol','hasil instan','klinis'
] WHERE code = 'beauty';

UPDATE public.catalog_industry_templates SET claim_words = ARRAY[
  'otomatis','hemat waktu','real-time','realtime','enkripsi','uptime','gratis','free trial','integrasi','terintegrasi',
  'tanpa coding','no code','unlimited','support 24 jam','cloud','backup otomatis'
] WHERE code = 'software';

CREATE OR REPLACE FUNCTION public.mcp_get_claim_words(p_user_id uuid, p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $claim_words$
DECLARE
  v_code text;
  v_words text[];
BEGIN
  PERFORM public.mcp_footage_require_member(p_user_id, p_organization_id);
  SELECT s.industry_template_code INTO v_code FROM public.organization_catalog_settings s WHERE s.organization_id = p_organization_id;
  SELECT t.claim_words INTO v_words FROM public.catalog_industry_templates t WHERE t.code = v_code;
  RETURN jsonb_build_object('industry', v_code, 'claim_words', to_jsonb(COALESCE(v_words, '{}'::text[])));
END;
$claim_words$;

REVOKE ALL ON FUNCTION public.mcp_get_claim_words(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_get_claim_words(uuid, uuid) TO service_role;

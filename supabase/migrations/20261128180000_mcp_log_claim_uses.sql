-- Jejak pemakaian from the MCP: when a brief (or later a video, ad, reply) is saved, the Daftar Klaim codes its
-- claim_check found are recorded in product_claim_uses. Unknown codes are skipped; a repeated use is kept once
-- and its label refreshed.

CREATE OR REPLACE FUNCTION public.mcp_log_catalog_claim_uses(p_user_id uuid, p_organization_id uuid, p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_module text := p_input->>'module';
  v_ref text := btrim(COALESCE(p_input->>'ref_id', ''));
  v_label text := NULLIF(left(btrim(COALESCE(p_input->>'label', '')), 300), '');
  v_codes text[];
  v_count integer;
BEGIN
  PERFORM public.mcp_catalog_require_member(p_user_id, p_organization_id);
  IF v_module NOT IN ('brief', 'video', 'thinking_lab', 'ai_employee', 'inbox', 'ads', 'product_knowledge', 'other')
     OR char_length(v_ref) NOT BETWEEN 1 AND 200
     OR jsonb_typeof(p_input->'codes') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_input->'codes') > 100 THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;
  SELECT array_agg(DISTINCT upper(btrim(c))) INTO v_codes FROM jsonb_array_elements_text(p_input->'codes') c;

  INSERT INTO public.product_claim_uses (organization_id, claim_id, module, ref_id, label, created_by)
  SELECT p_organization_id, pc.id, v_module, v_ref, v_label, p_user_id
  FROM public.product_claims pc
  WHERE pc.organization_id = p_organization_id AND pc.code = ANY (COALESCE(v_codes, '{}'::text[]))
  ON CONFLICT (claim_id, module, ref_id) DO UPDATE SET label = COALESCE(EXCLUDED.label, public.product_claim_uses.label);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('logged', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.mcp_log_catalog_claim_uses(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_log_catalog_claim_uses(uuid, uuid, jsonb) TO service_role;

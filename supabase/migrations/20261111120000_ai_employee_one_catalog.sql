-- Satu karyawan AI menyimpan paling banyak satu katalog.
-- Batasan tabel tetap 12 supaya baris lama yang masih dua katalog tidak ditolak atau dihapus.

DO $patch$
DECLARE
  def text := replace(
    pg_get_functiondef('public.ai_employee_brief_write(uuid, uuid, uuid, jsonb)'::regprocedure),
    E'\r',
    ''
  );
  marker text := 'cardinality(v_services) > 12';
  hits integer := (length(def) - length(replace(def, marker, ''))) / length(marker);
BEGIN
  IF hits = 0 AND position('cardinality(v_services) > 1' IN def) > 0 THEN
    RETURN;
  END IF;
  IF hits <> 1 THEN
    RAISE EXCEPTION 'brief catalog snippet missing';
  END IF;
  EXECUTE replace(def, marker, 'cardinality(v_services) > 1');
END;
$patch$;

COMMENT ON FUNCTION public.ai_employee_brief_write(uuid, uuid, uuid, jsonb) IS
  'Owner menyimpan brief. Katalog paling banyak satu. Nol katalog tetap sah.';

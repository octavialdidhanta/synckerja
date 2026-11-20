-- Fungsi baru yang dibuat role postgres tidak otomatis bisa dipanggil PUBLIC atau anon.
-- authenticated dan service_role tetap mengikuti default privilege schema public yang sudah ada.
-- Fungsi halaman publik wajib GRANT EXECUTE ... TO anon secara eksplisit.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon;

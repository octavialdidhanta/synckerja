/**
 * Defaults for HR attendance UI queries: satu fetch per key selama sesi SPA,
 * tanpa refetch saat navigasi kembali ke /attendance/attendance atau saat window focus.
 * Invalidate manual / mutation tetap bisa memaksa data baru.
 */
export const attendanceHRQueryDefaults = {
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: 1000 * 60 * 60,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

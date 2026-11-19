import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useEmployees } from "@/2-1-employees/hooks/useEmployees";
import {
  aiEmployeePageQueryKey,
  isAngleEligibleForBrief,
  MAX_BRIEF_ANGLES,
  toggleAiEmployeeBriefAngle,
} from "@/2-1-employees/ai/briefAngleFocus";
import { classifyAiEmployeeError, parseAiEmployeePage } from "@/2-1-employees/ai/parse";
import { isEmployeeUuid } from "@/2-1-employees/ai/useAiEmployeePage";
import { supabase } from "@/shared/lib/supabaseClient";

const SESSION_KEY_PREFIX = "thinking-lab-fokus-angle-employee:";

function sessionKey(organizationId: string) {
  return `${SESSION_KEY_PREFIX}${organizationId}`;
}

function readSessionEmployeeId(organizationId: string | null): string | null {
  if (!organizationId || typeof sessionStorage === "undefined") return null;
  try {
    const value = sessionStorage.getItem(sessionKey(organizationId));
    return isEmployeeUuid(value) ? value : null;
  } catch {
    return null;
  }
}

function writeSessionEmployeeId(organizationId: string | null, employeeId: string | null) {
  if (!organizationId || typeof sessionStorage === "undefined") return;
  try {
    if (!employeeId) sessionStorage.removeItem(sessionKey(organizationId));
    else sessionStorage.setItem(sessionKey(organizationId), employeeId);
  } catch {
    /* ignore quota */
  }
}

/** Prefill Thinking Lab Fokus-angle employee picker when navigating from AI Employee. */
export function setThinkingLabFokusEmployee(organizationId: string | null, employeeId: string | null) {
  writeSessionEmployeeId(organizationId, employeeId);
}

export function useThinkingLabAngleFocus() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const employeesQuery = useEmployees();
  const [targetEmployeeId, setTargetEmployeeIdState] = useState<string | null>(() =>
    readSessionEmployeeId(organizationId),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingAngleId, setPendingAngleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const aiEmployees = useMemo(
    () => (employeesQuery.data ?? []).filter((employee) => employee.is_ai),
    [employeesQuery.data],
  );

  const setTargetEmployeeId = useCallback(
    (employeeId: string | null) => {
      setTargetEmployeeIdState(employeeId);
      writeSessionEmployeeId(organizationId, employeeId);
    },
    [organizationId],
  );

  useEffect(() => {
    if (!organizationId) {
      setTargetEmployeeIdState(null);
      return;
    }
    setTargetEmployeeIdState(readSessionEmployeeId(organizationId));
  }, [organizationId]);

  const pageQuery = useQuery({
    queryKey: aiEmployeePageQueryKey(organizationId, targetEmployeeId ?? undefined),
    enabled: Boolean(organizationId && isEmployeeUuid(targetEmployeeId ?? undefined)),
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ai_employee_page_read", {
        p_employee_id: targetEmployeeId as string,
      });
      if (error) throw error;
      return parseAiEmployeePage(data);
    },
  });

  const selectedAngleIds = useMemo(
    () => new Set(pageQuery.data?.brief.angleIds ?? []),
    [pageQuery.data?.brief.angleIds],
  );

  const eligibleAngleIds = useMemo(() => {
    const page = pageQuery.data;
    if (!page) return new Set<string>();
    return new Set(
      page.options.angles
        .filter((option) => isAngleEligibleForBrief(page.options.angles, page.brief.serviceIds, option.id))
        .map((option) => option.id),
    );
  }, [pageQuery.data]);

  const angleFocusStatus = useCallback(
    (angleId: string): { selected: boolean; disabled: boolean; label: string } => {
      const selected = selectedAngleIds.has(angleId);
      if (saving) {
        return {
          selected,
          disabled: true,
          label: selected ? "Sedang menyimpan… tunggu sebentar" : "Sedang menyimpan… tunggu sebentar",
        };
      }
      if (!targetEmployeeId) {
        return { selected, disabled: false, label: "Pilih karyawan AI untuk Fokus angle" };
      }
      if (selected) {
        return { selected: true, disabled: false, label: "Hapus dari Fokus angle" };
      }
      if (!pageQuery.data) {
        return { selected: false, disabled: true, label: "Memuat brief karyawan AI…" };
      }
      if (!eligibleAngleIds.has(angleId)) {
        return {
          selected: false,
          disabled: true,
          label:
            "Belum bisa ditambah: butuh ide yang locked + LOLOS, dan angle cocok katalog karyawan AI.",
        };
      }
      if (selectedAngleIds.size >= MAX_BRIEF_ANGLES) {
        return {
          selected: false,
          disabled: true,
          label: `Fokus angle sudah penuh (${MAX_BRIEF_ANGLES}/${MAX_BRIEF_ANGLES}). Lepas satu angle di brief dulu, baru angle ini bisa ditambah.`,
        };
      }
      return { selected: false, disabled: false, label: "Tambah ke Fokus angle" };
    },
    [eligibleAngleIds, pageQuery.data, saving, selectedAngleIds, targetEmployeeId],
  );

  const targetEmployeeName = useMemo(() => {
    if (!targetEmployeeId) return null;
    return aiEmployees.find((row) => row.id === targetEmployeeId)?.full_name?.trim() || null;
  }, [aiEmployees, targetEmployeeId]);

  // Drop a session target that is no longer an AI employee in this org.
  useEffect(() => {
    if (!targetEmployeeId || employeesQuery.isLoading) return;
    if (aiEmployees.some((row) => row.id === targetEmployeeId)) return;
    setTargetEmployeeId(null);
  }, [aiEmployees, employeesQuery.isLoading, setTargetEmployeeId, targetEmployeeId]);

  const applyToggle = useCallback(
    async (employeeId: string, angleId: string) => {
      if (savingRef.current) return;
      savingRef.current = true;
      setSaving(true);
      try {
        const result = await toggleAiEmployeeBriefAngle({
          employeeId,
          organizationId,
          angleId,
          queryClient,
        });
        if (result.ok === false) {
          if (result.reason === "not_eligible") {
            toast.error(
              "Belum bisa ditambah: butuh ide yang locked + LOLOS, dan angle cocok katalog karyawan AI.",
            );
          } else {
            toast.error(
              `Fokus angle sudah penuh (${MAX_BRIEF_ANGLES}/${MAX_BRIEF_ANGLES}). Lepas satu angle di brief dulu.`,
            );
          }
          return;
        }
        toast.success(
          result.action === "added"
            ? "Angle ditambahkan ke Fokus angle."
            : "Angle dihapus dari Fokus angle.",
        );
      } catch (error) {
        const kind = classifyAiEmployeeError(error);
        if (kind === "forbidden") toast.error("Anda tidak punya akses mengubah brief karyawan AI ini.");
        else if (kind === "not_found") toast.error("Karyawan AI tidak ditemukan.");
        else toast.error("Gagal menyimpan Fokus angle.");
      } finally {
        savingRef.current = false;
        setSaving(false);
        setPendingAngleId(null);
      }
    },
    [organizationId, queryClient],
  );

  const onAngleFocusClick = useCallback(
    (angleId: string) => {
      if (savingRef.current) return;
      const status = angleFocusStatus(angleId);
      // Disabled robot still receives the click so we can explain why (max / not eligible).
      if (status.disabled) {
        toast.error(status.label);
        return;
      }
      if (!targetEmployeeId) {
        setPendingAngleId(angleId);
        setPickerOpen(true);
        return;
      }
      void applyToggle(targetEmployeeId, angleId);
    },
    [angleFocusStatus, applyToggle, targetEmployeeId],
  );

  const selectEmployee = useCallback(
    (employeeId: string) => {
      setTargetEmployeeId(employeeId);
      setPickerOpen(false);
      const angleId = pendingAngleId;
      setPendingAngleId(null);
      if (angleId) void applyToggle(employeeId, angleId);
    },
    [applyToggle, pendingAngleId, setTargetEmployeeId],
  );

  const openPicker = useCallback(() => {
    setPendingAngleId(null);
    setPickerOpen(true);
  }, []);

  const clearTarget = useCallback(() => {
    setTargetEmployeeId(null);
  }, [setTargetEmployeeId]);

  return {
    aiEmployees,
    employeesLoading: employeesQuery.isLoading,
    targetEmployeeId,
    targetEmployeeName,
    selectedAngleIds,
    eligibleAngleIds,
    angleFocusStatus,
    saving,
    pickerOpen,
    setPickerOpen,
    onAngleFocusClick,
    selectEmployee,
    openPicker,
    clearTarget,
    pageLoading: pageQuery.isLoading && Boolean(targetEmployeeId),
  };
}

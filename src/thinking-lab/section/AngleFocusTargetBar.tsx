import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { AiEmployeeBotIcon } from "@/2-1-employees/ai/AiEmployeeBotIcon";
import type { Employee } from "@/2-1-employees/hooks/useEmployees";

export function AngleFocusTargetBar({
  targetName,
  pickerOpen,
  employees,
  employeesLoading,
  onOpenPicker,
  onClosePicker,
  onSelectEmployee,
  onClear,
}: {
  targetName: string | null;
  pickerOpen: boolean;
  employees: Employee[];
  employeesLoading: boolean;
  onOpenPicker: () => void;
  onClosePicker: () => void;
  onSelectEmployee: (employeeId: string) => void;
  onClear: () => void;
}) {
  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white/90 px-2.5 py-1.5 text-xs text-slate-700">
        <AiEmployeeBotIcon className="h-3.5 w-3.5 text-slate-600" />
        <span className="min-w-0 flex-1 truncate">
          {targetName
            ? `Fokus angle → ${targetName}`
            : "Fokus angle → pilih karyawan AI di icon robot pada node Angle"}
        </span>
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onOpenPicker}>
          {targetName ? "Ganti" : "Pilih"}
        </Button>
        {targetName ? (
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClear}>
            Lepas
          </Button>
        ) : null}
      </div>

      <Dialog open={pickerOpen} onOpenChange={(open) => { if (!open) onClosePicker(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pilih karyawan AI</DialogTitle>
            <DialogDescription>
              Angle yang diklik akan masuk ke Fokus angle brief Content Plan Carousel karyawan ini (maksimal 6).
            </DialogDescription>
          </DialogHeader>
          <div className="scrollbar-hide max-h-64 space-y-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {employeesLoading ? (
              <p className="px-1 py-2 text-sm text-muted-foreground">Memuat…</p>
            ) : employees.length === 0 ? (
              <p className="px-1 py-2 text-sm text-muted-foreground">Belum ada karyawan AI di organisasi ini.</p>
            ) : (
              employees.map((employee) => (
                <button
                  key={employee.id}
                  type="button"
                  className="flex w-full rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => onSelectEmployee(employee.id)}
                >
                  <span className="truncate font-medium">{employee.full_name || "Tanpa nama"}</span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Switch } from "@/shared/components/ui/switch";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { CHECK_LEVELS, CHECK_REGISTRY, checkEnabled, checkKey, type CheckLevel } from "@/thinking-lab/shared/checkSettings";
import { useCheckSettings, useSaveCheckSettings } from "@/thinking-lab/shared/useCheckSettings";

const LEVEL_LABEL: Record<CheckLevel, { id: string; en: string }> = {
  master: { id: "Master Thought", en: "Master Thought" },
  bigThought: { id: "Big Thought", en: "Big Thought" },
  territory: { id: "Territory", en: "Territory" },
  angle: { id: "Angle", en: "Angle" },
  idea: { id: "Idea", en: "Idea" },
};

export function CheckSettingsDialog({ organizationId }: { organizationId: string | null }) {
  const { t, language } = useAppTranslation();
  const [open, setOpen] = useState(false);
  const settings = useCheckSettings(organizationId);
  const save = useSaveCheckSettings(organizationId);
  const checks = settings.data?.checks ?? {};
  const canEdit = settings.data?.canEdit === true;
  const label = (pair: { id: string; en: string }) => (language === "id" ? pair.id : pair.en);

  const write = (next: Record<string, boolean>) => {
    const clean = Object.fromEntries(Object.entries(next).filter(([, on]) => on));
    save.mutate(clean, {
      onError: () => toast.error(t("thinkingLab.checks.saveFailed", "Pengaturan syarat lolos gagal disimpan.")),
    });
  };
  const toggle = (level: CheckLevel, id: string, on: boolean) => write({ ...checks, [checkKey(level, id)]: on });
  const toggleLevel = (level: CheckLevel, on: boolean) => {
    const next = { ...checks };
    for (const entry of CHECK_REGISTRY[level]) next[checkKey(level, entry.id)] = on;
    write(next);
  };

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} disabled={!organizationId}>
        <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
        {t("thinkingLab.checks.open", "Syarat lolos")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("thinkingLab.checks.title", "Syarat lolos")}</DialogTitle>
            <DialogDescription>
              {canEdit
                ? t(
                    "thinkingLab.checks.description",
                    "Syarat yang OFF dilewati, termasuk saat menyimpan lewat chat. Item yang disimpan tanpa semua syarat ditandai \"Tanpa cek\".",
                  )
                : t("thinkingLab.checks.readOnly", "Hanya Owner atau Admin yang bisa mengubah syarat lolos.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {CHECK_LEVELS.map((level) => {
              const entries = CHECK_REGISTRY[level];
              const onCount = entries.filter((entry) => checkEnabled(checks, level, entry.id)).length;
              return (
                <section key={level} className="space-y-2">
                  <div className="flex items-center justify-between border-b pb-1">
                    <h3 className="text-sm font-semibold">
                      {label(LEVEL_LABEL[level])}{" "}
                      <span className="font-normal text-muted-foreground">
                        {onCount}/{entries.length}
                      </span>
                    </h3>
                    <Switch
                      checked={onCount === entries.length}
                      disabled={!canEdit || save.isPending}
                      onCheckedChange={(on) => toggleLevel(level, on)}
                      aria-label={t("thinkingLab.checks.all", "Semua")}
                    />
                  </div>
                  {entries.map((entry) => (
                    <label key={entry.id} className="flex items-center justify-between gap-3 text-sm">
                      <span>{language === "id" ? entry.id_label : entry.en_label}</span>
                      <Switch
                        checked={checkEnabled(checks, level, entry.id)}
                        disabled={!canEdit || save.isPending}
                        onCheckedChange={(on) => toggle(level, entry.id, on)}
                      />
                    </label>
                  ))}
                </section>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

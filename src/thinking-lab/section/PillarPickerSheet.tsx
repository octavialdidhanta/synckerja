import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/shared/components/ui/sheet";
import { Switch } from "@/shared/components/ui/switch";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { groupContentPillars, type ContentPillarFunnel, type LabContentPillar } from "@/thinking-lab/execution/pillars";
import { pillarLessSuitable, type ScriptAudio, type ScriptLook, type ScriptSpeech } from "@/thinking-lab/execution/script";

const FUNNEL_LABEL: Record<ContentPillarFunnel, string> = {
  top: "Awareness",
  middle: "Consideration",
  bottom: "Conversion",
};

export function PillarPickerSheet({
  open,
  pillars,
  masterSells,
  pending = false,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  pillars: LabContentPillar[];
  masterSells: true | false | "unresolved" | "unknown";
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (
    pillars: LabContentPillar[],
    audio: ScriptAudio,
    look: ScriptLook,
    speech: ScriptSpeech,
    durationSeconds: number | null,
  ) => void;
}) {
  const { t } = useAppTranslation();
  const [selected, setSelected] = useState<string[]>([]);
  const [audioOpen, setAudioOpen] = useState(false);
  const [sound, setSound] = useState(false);
  const [music, setMusic] = useState(false);
  const [look, setLook] = useState<ScriptLook>("ugc");
  const [speech, setSpeech] = useState<ScriptSpeech>("vo");
  const [durationAmount, setDurationAmount] = useState("");
  const [durationUnit, setDurationUnit] = useState<"seconds" | "minutes">("seconds");
  const looks: Array<{ id: ScriptLook; label: string }> = [
    { id: "ugc", label: t("thinkingLab.execution.lookUgc", "UGC") },
    { id: "commercial", label: t("thinkingLab.execution.lookCommercial", "Commercial") },
    { id: "cinematic", label: t("thinkingLab.execution.lookCinematic", "Cinematic film") },
  ];
  const speeches: Array<{ id: ScriptSpeech; label: string }> = [
    { id: "vo", label: t("thinkingLab.execution.speechVo", "VO") },
    { id: "mix", label: t("thinkingLab.execution.speechMix", "Mix") },
    { id: "dialog", label: t("thinkingLab.execution.speechDialog", "Dialog") },
    { id: "silent", label: t("thinkingLab.execution.speechSilent", "Visual") },
  ];
  const groups = groupContentPillars(pillars);
  const chosen = pillars.filter((pillar) => selected.includes(pillar.id));

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    setAudioOpen(false);
    setSound(false);
    setMusic(false);
    setLook("ugc");
    setSpeech("vo");
    setDurationAmount("");
    setDurationUnit("seconds");
  }, [open]);

  const toggle = (id: string, checked: boolean) => {
    setSelected((current) => (checked ? [...current, id] : current.filter((item) => item !== id)));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("thinkingLab.execution.chooseTitle", "Choose a content pillar")}</SheetTitle>
          <SheetDescription>
            {t("thinkingLab.execution.chooseHint", "Every selected pillar becomes its own Execution and writes a Script VO.")}
          </SheetDescription>
        </SheetHeader>
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("thinkingLab.execution.noPillars", "This organization has no active content pillars yet.")}
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.funnel} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{FUNNEL_LABEL[group.funnel]}</h3>
                <ul className="space-y-2">
                  {group.items.map((pillar) => {
                    const checked = selected.includes(pillar.id);
                    const unsuitable = pillarLessSuitable(pillar.name, masterSells);
                    return (
                      <li key={pillar.id}>
                        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background px-3 py-2">
                          <Checkbox
                            checked={checked}
                            disabled={pending}
                            onCheckedChange={(value) => toggle(pillar.id, value === true)}
                            aria-label={pillar.name}
                          />
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-foreground">{pillar.name}</span>
                              <span className="text-xs text-muted-foreground">{FUNNEL_LABEL[pillar.funnel]}</span>
                            </span>
                            {pillar.category ? <span className="mt-0.5 block text-xs text-muted-foreground">{pillar.category}</span> : null}
                            {unsuitable ? (
                              <span className="mt-1 block text-xs text-amber-700">
                                {t("thinkingLab.execution.lessSuitable", "Marked as a weak fit for this Idea.")}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            disabled={pending || chosen.length === 0}
            onClick={() => {
              setSound(false);
              setMusic(false);
              setLook("ugc");
              setSpeech("vo");
              setDurationAmount("");
              setDurationUnit("seconds");
              setAudioOpen(true);
            }}
          >
            {t("thinkingLab.execution.create", "Create Execution for {{count}} pillar", { count: chosen.length })}
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("thinkingLab.execution.cancel", "Cancel")}
          </Button>
        </div>
        <Dialog open={audioOpen} onOpenChange={setAudioOpen}>
          <DialogContent className="gap-4 p-5 sm:max-w-sm">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base">{t("thinkingLab.execution.settingsTitle", "Video settings")}</DialogTitle>
            </DialogHeader>
            <section className="space-y-1.5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("thinkingLab.execution.audio", "Audio")}
              </h3>
              <div className="grid grid-cols-2 divide-x rounded-md border border-border">
                <label className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="text-sm">{t("thinkingLab.execution.sound", "Sound")}</span>
                  <Switch
                    checked={speech === "mix" || speech === "dialog" || sound}
                    disabled={pending || speech === "mix" || speech === "dialog"}
                    onCheckedChange={setSound}
                    aria-label={t("thinkingLab.execution.sound", "Sound")}
                  />
                </label>
                <label className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="text-sm">{t("thinkingLab.execution.music", "Music")}</span>
                  <Switch checked={music} disabled={pending} onCheckedChange={setMusic} aria-label={t("thinkingLab.execution.music", "Music")} />
                </label>
              </div>
            </section>
            <section className="space-y-1.5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("thinkingLab.execution.look", "Look")}
              </h3>
              <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1" role="radiogroup" aria-label={t("thinkingLab.execution.look", "Look")}>
                {looks.map((item) => {
                  const selected = look === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={pending}
                      className={cn(
                        "h-8 rounded px-1 text-xs font-medium",
                        selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setLook(item.id)}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </section>
            <section className="space-y-1.5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("thinkingLab.execution.speech", "Speech")}
              </h3>
              <div className="grid grid-cols-4 gap-1 rounded-md bg-muted p-1" role="radiogroup" aria-label={t("thinkingLab.execution.speech", "Speech")}>
                {speeches.map((item) => {
                  const selected = speech === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={pending}
                      className={cn(
                        "h-8 rounded px-1 text-[11px] font-medium",
                        selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => {
                        setSpeech(item.id);
                        setSound(item.id === "mix" || item.id === "dialog");
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </section>
            <section className="space-y-1.5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("thinkingLab.execution.duration", "Duration")}
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={durationAmount}
                  disabled={pending}
                  aria-label={t("thinkingLab.execution.duration", "Duration")}
                  className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onChange={(event) => {
                    const next = event.target.value.trim();
                    if (next === "" || /^\d+$/.test(next)) setDurationAmount(next.replace(/^0+(?=\d)/, ""));
                  }}
                />
                <select
                  value={durationUnit}
                  disabled={pending}
                  aria-label={t("thinkingLab.execution.durationUnit", "Duration unit")}
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onChange={(event) => setDurationUnit(event.target.value === "minutes" ? "minutes" : "seconds")}
                >
                  <option value="seconds">{t("thinkingLab.execution.durationSeconds", "Seconds")}</option>
                  <option value="minutes">{t("thinkingLab.execution.durationMinutes", "Minutes")}</option>
                </select>
              </div>
            </section>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => setAudioOpen(false)}>
                {t("thinkingLab.execution.cancel", "Cancel")}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={pending || chosen.length === 0}
                onClick={() => {
                  setAudioOpen(false);
                  const amount = Number(durationAmount);
                  const durationSeconds = durationAmount && amount > 0 ? (durationUnit === "minutes" ? amount * 60 : amount) : null;
                  onConfirm(chosen, { sound: speech === "mix" || speech === "dialog" || sound, music }, look, speech, durationSeconds);
                }}
              >
                {t("thinkingLab.execution.create", "Create Execution for {{count}} pillar", { count: chosen.length })}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}

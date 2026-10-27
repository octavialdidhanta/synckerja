import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { pillarBarWidth } from "@/6-1-dashboard/lib/contentPillarTracker";
import { useContentPillarData } from "@/6-1-dashboard/hook/useContentPillarData";
import { Button } from "@/shared/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/shared/components/ui/sheet";
import { Switch } from "@/shared/components/ui/switch";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { monthFunnelStats, pillarsInFunnel } from "@/thinking-lab/execution/pillarUsage";
import type { ContentPillarFunnel, LabContentPillar } from "@/thinking-lab/execution/pillars";
import { pillarLessSuitable, UGC_LOOK_COMPONENTS, type ImageSettings, type ScriptAudio, type ScriptLook, type ScriptMedium, type ScriptSpeech } from "@/thinking-lab/execution/script";

export type ExecutionSettingsDirect = {
  token: number;
  pillarId: string;
  medium: "video" | "image";
  imageFormat: "single" | "carousel";
};

export function PillarPickerSheet({
  open,
  pillars,
  masterSells,
  pending = false,
  mediumByPillar = {},
  direct = null,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  pillars: LabContentPillar[];
  masterSells: true | false | "unresolved" | "unknown";
  pending?: boolean;
  mediumByPillar?: Record<string, ScriptMedium | undefined>;
  direct?: ExecutionSettingsDirect | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (
    pillars: LabContentPillar[],
    audio: ScriptAudio,
    look: ScriptLook,
    speech: ScriptSpeech,
    durationSeconds: number | null,
    brandName: string | null,
    cta: string | null,
    image: ImageSettings | null,
  ) => void;
}) {
  const { t, dateLocale } = useAppTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [funnel, setFunnel] = useState<ContentPillarFunnel>("top");
  const [audioOpen, setAudioOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [mediumOpen, setMediumOpen] = useState(false);
  const [imageFormat, setImageFormat] = useState<"single" | "carousel">("single");
  const [slideCountMode, setSlideCountMode] = useState<"manual" | "idea">("idea");
  const [slideCount, setSlideCount] = useState("5");
  const [withImage, setWithImage] = useState(true);
  const [sound, setSound] = useState(false);
  const [music, setMusic] = useState(false);
  const [look, setLook] = useState<ScriptLook>("ugc");
  const [speech, setSpeech] = useState<ScriptSpeech>("vo");
  const [durationAmount, setDurationAmount] = useState("");
  const [durationUnit, setDurationUnit] = useState<"seconds" | "minutes">("seconds");
  const [mentionBrand, setMentionBrand] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [cta, setCta] = useState("");
  const ctas = [
    { id: "link_bio", label: t("thinkingLab.execution.ctaLinkBio", "Klik Link di Bio") },
    { id: "link_below", label: t("thinkingLab.execution.ctaLinkBelow", "Klik Link di Bawah") },
    { id: "shop_now", label: t("thinkingLab.execution.ctaShopNow", "Belanja Sekarang") },
    { id: "order_now", label: t("thinkingLab.execution.ctaOrderNow", "Pesan Sekarang") },
    { id: "like_comment", label: t("thinkingLab.execution.ctaLikeComment", "Like & Comment") },
    { id: "save_post", label: t("thinkingLab.execution.ctaSavePost", "Save Postingan Ini") },
    { id: "share_friend", label: t("thinkingLab.execution.ctaShareFriend", "Share ke Teman") },
    { id: "follow", label: t("thinkingLab.execution.ctaFollow", "Follow Akun Ini") },
    { id: "dm_whatsapp", label: t("thinkingLab.execution.ctaWhatsapp", "DM / Chat WhatsApp") },
    { id: "check_location", label: t("thinkingLab.execution.ctaLocation", "Cek Lokasi") },
  ];
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
  const usageQuery = useContentPillarData(undefined, "all");
  const usage = usageQuery.data ?? [];
  const usageReady = usageQuery.isSuccess;
  const stats = monthFunnelStats(usage);
  const visible = pillarsInFunnel(pillars, usageReady ? usage : [], funnel);
  const chosen = pillars.filter((pillar) => pillar.id === selectedId);
  const monthLabel = new Date().toLocaleDateString(dateLocale, { month: "short", year: "numeric" });
  const funnelCards: Array<{ id: ContentPillarFunnel; label: string; stat: { count: number; percentage: number } }> = [
    { id: "top", label: t("thinkingLab.execution.funnelAwareness", "Awareness"), stat: stats.top },
    { id: "middle", label: t("thinkingLab.execution.funnelConsideration", "Consideration"), stat: stats.middle },
    { id: "bottom", label: t("thinkingLab.execution.funnelConversion", "Conversion"), stat: stats.bottom },
  ];

  useEffect(() => {
    if (direct && !open) {
      setSelectedId(direct.pillarId);
      setSound(false);
      setMusic(false);
      setLook("ugc");
      setSpeech("vo");
      setDurationAmount("");
      setDurationUnit("seconds");
      setMentionBrand(false);
      setBrandName("");
      setCta("");
      setImageFormat(direct.imageFormat);
      setSlideCountMode("idea");
      setSlideCount("5");
      setWithImage(true);
      setMediumOpen(false);
      setAudioOpen(direct.medium === "video");
      setImageOpen(direct.medium === "image");
      return;
    }
    if (!open) {
      setAudioOpen(false);
      setImageOpen(false);
      setMediumOpen(false);
      return;
    }
    setSelectedId(null);
    setFunnel("top");
    setAudioOpen(false);
    setImageOpen(false);
    setMediumOpen(false);
    setImageFormat("single");
    setSlideCountMode("idea");
    setSlideCount("5");
    setWithImage(true);
    setSound(false);
    setMusic(false);
    setLook("ugc");
    setSpeech("vo");
    setDurationAmount("");
    setDurationUnit("seconds");
    setMentionBrand(false);
    setBrandName("");
    setCta("");
  }, [open, direct]);

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("thinkingLab.execution.chooseTitle", "Choose a content pillar")}</SheetTitle>
          <SheetDescription>
            {t("thinkingLab.execution.chooseHint", "Every selected pillar becomes its own Execution and writes a Script VO.")}
          </SheetDescription>
        </SheetHeader>
        {pillars.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("thinkingLab.execution.noPillars", "This organization has no active content pillars yet.")}
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {usageReady
                ? t("thinkingLab.execution.monthUsage", "{{month}} · {{count}} content", { month: monthLabel, count: stats.total })
                : monthLabel}
            </p>
            <div className="grid grid-cols-3 gap-1">
              {funnelCards.map((card) => {
                const active = funnel === card.id;
                const tone =
                  card.id === "top"
                    ? { active: "border border-green-200 bg-green-100 text-green-800", figure: "text-green-600" }
                    : card.id === "middle"
                      ? { active: "border border-yellow-200 bg-yellow-100 text-yellow-800", figure: "text-yellow-600" }
                      : { active: "border border-red-200 bg-red-100 text-red-800", figure: "text-red-600" };
                return (
                  <button
                    key={card.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFunnel(card.id)}
                    className={cn(
                      "flex flex-col items-center rounded-md px-1 py-2 text-xs font-medium",
                      active ? tone.active : "bg-muted/40 text-muted-foreground",
                    )}
                  >
                    <span className={cn("mb-1 text-sm font-semibold", active ? tone.figure : undefined)}>
                      {usageReady ? `${card.stat.percentage}% (${card.stat.count})` : "—"}
                    </span>
                    <span className="text-center leading-tight">{card.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {pillars.length > 0 && visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("thinkingLab.execution.noFunnelPillars", "No pillars in this funnel.")}</p>
          ) : null}
          <RadioGroup
            value={selectedId ?? ""}
            disabled={pending}
            className="space-y-2"
            onValueChange={setSelectedId}
          >
            {visible.map((pillar) => {
              const checked = pillar.id === selectedId;
              const unsuitable = pillarLessSuitable(pillar.name, masterSells);
              return (
                <label
                  key={pillar.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border bg-background px-3 py-2",
                    checked ? "border-primary" : "border-border",
                  )}
                >
                    <RadioGroupItem value={pillar.id} className="mt-0.5" aria-label={pillar.name} />
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="block truncate text-sm font-medium text-foreground">{pillar.name}</span>
                      <span className="flex items-end justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate text-xs leading-tight text-muted-foreground">
                          {pillar.category ?? ""}
                        </span>
                        <span className="flex shrink-0 items-end gap-2 leading-none">
                          {pillar.isDefault ? (
                            <span className="flex items-center">
                              <Shield className="h-3 w-3 text-blue-500" aria-hidden />
                              <span className="ml-1 text-xs leading-tight text-blue-600">
                                {t("thinkingLab.execution.pillarDefault", "Default")}
                              </span>
                            </span>
                          ) : null}
                          {usageReady ? <span className="text-sm font-medium text-foreground">{pillar.count}</span> : null}
                        </span>
                      </span>
                      {usageReady ? (
                        <span className="mt-1 block h-2 overflow-hidden rounded-full bg-muted">
                          <span
                            className={cn(
                              "block h-full rounded-full",
                              funnel === "top" ? "bg-green-500" : funnel === "middle" ? "bg-yellow-500" : "bg-red-500",
                            )}
                            style={{ width: `${pillarBarWidth(pillar.count)}%` }}
                          />
                        </span>
                      ) : null}
                      {unsuitable ? (
                        <span className="mt-1 block text-xs text-amber-700">
                          {t("thinkingLab.execution.lessSuitable", "Marked as a weak fit for this Idea.")}
                        </span>
                      ) : null}
                    </span>
                </label>
              );
            })}
          </RadioGroup>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            disabled={pending || chosen.length === 0}
            onClick={() => {
              const remembered = chosen[0] ? mediumByPillar[chosen[0].id] : undefined;
              setSound(false);
              setMusic(false);
              setLook("ugc");
              setSpeech("vo");
              setDurationAmount("");
              setDurationUnit("seconds");
              setMentionBrand(false);
              setBrandName("");
              setCta("");
              setImageFormat("single");
              setSlideCountMode("idea");
              setSlideCount("5");
              setWithImage(true);
              if (remembered === "image") setImageOpen(true);
              else if (remembered === "video") setAudioOpen(true);
              else setMediumOpen(true);
            }}
          >
            {t("thinkingLab.execution.create", "Create Execution for {{count}} pillar", { count: chosen.length })}
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("thinkingLab.execution.cancel", "Cancel")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
        <Dialog open={audioOpen} onOpenChange={setAudioOpen}>
          <DialogContent className="gap-4 p-5 sm:max-w-sm">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base">{t("thinkingLab.execution.settingsTitle", "Video settings")}</DialogTitle>
              <button
                type="button"
                className="text-left text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => {
                  setAudioOpen(false);
                  setImageOpen(true);
                }}
              >
                {t("thinkingLab.execution.switchToImage", "Switch to Image")}
              </button>
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
              {look === "ugc" ? (
                <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                  {UGC_LOOK_COMPONENTS.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
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
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("thinkingLab.execution.brand", "Brand")}
                </h3>
                <label className="flex items-center gap-2 text-sm">
                  <span>{t("thinkingLab.execution.mentionBrand", "Mention the brand")}</span>
                  <Switch
                    checked={mentionBrand}
                    disabled={pending}
                    onCheckedChange={setMentionBrand}
                    aria-label={t("thinkingLab.execution.mentionBrand", "Mention the brand")}
                  />
                </label>
              </div>
              {mentionBrand ? (
                <input
                  type="text"
                  value={brandName}
                  disabled={pending}
                  placeholder={t("thinkingLab.execution.brandPlaceholder", "Your Brand")}
                  aria-label={t("thinkingLab.execution.brandName", "Brand name")}
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onChange={(event) => setBrandName(event.target.value)}
                />
              ) : null}
            </section>
            <section className="space-y-1.5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("thinkingLab.execution.cta", "CTA")}
              </h3>
              <select
                value={cta}
                disabled={pending}
                aria-label={t("thinkingLab.execution.cta", "CTA")}
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) => setCta(event.target.value)}
              >
                <option value="">{t("thinkingLab.execution.ctaNone", "None")}</option>
                {ctas.map((item) => (
                  <option key={item.id} value={item.label}>
                    {item.label}
                  </option>
                ))}
              </select>
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
                disabled={pending || chosen.length === 0 || (mentionBrand && !brandName.trim())}
                onClick={() => {
                  setAudioOpen(false);
                  const amount = Number(durationAmount);
                  const durationSeconds = durationAmount && amount > 0 ? (durationUnit === "minutes" ? amount * 60 : amount) : null;
                  onConfirm(
                    chosen,
                    { sound: speech === "mix" || speech === "dialog" || sound, music },
                    look,
                    speech,
                    durationSeconds,
                    mentionBrand ? brandName.trim() : null,
                    cta || null,
                    null,
                  );
                }}
              >
                {t("thinkingLab.execution.create", "Create Execution for {{count}} pillar", { count: chosen.length })}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={mediumOpen} onOpenChange={setMediumOpen}>
          <DialogContent className="gap-4 p-5 sm:max-w-sm">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base">{t("thinkingLab.execution.chooseMedium", "Image or Video")}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setMediumOpen(false);
                  setImageOpen(true);
                }}
              >
                {t("thinkingLab.execution.mediumImage", "Image")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setMediumOpen(false);
                  setAudioOpen(true);
                }}
              >
                {t("thinkingLab.execution.mediumVideo", "Video")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={imageOpen} onOpenChange={setImageOpen}>
          <DialogContent className="gap-4 p-5 sm:max-w-sm">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base">{t("thinkingLab.execution.imageSettingsTitle", "Image settings")}</DialogTitle>
              <button
                type="button"
                className="text-left text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => {
                  setImageOpen(false);
                  setAudioOpen(true);
                }}
              >
                {t("thinkingLab.execution.switchToVideo", "Switch to Video")}
              </button>
            </DialogHeader>
            <section className="space-y-1.5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("thinkingLab.execution.imageFormat", "Format")}
              </h3>
              <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
                {([
                  ["single", t("thinkingLab.execution.imageSingle", "Single Image")],
                  ["carousel", t("thinkingLab.execution.imageCarousel", "Carousel")],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={cn(
                      "h-8 rounded px-1 text-xs font-medium",
                      imageFormat === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                    )}
                    onClick={() => setImageFormat(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>
            {imageFormat === "carousel" ? (
              <section className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("thinkingLab.execution.slideCount", "Slides")}
                  </h3>
                  <label className="flex items-center gap-2 text-sm">
                    <span>{t("thinkingLab.execution.slideCountManual", "Choose the count")}</span>
                    <Switch
                      checked={slideCountMode === "manual"}
                      disabled={pending}
                      onCheckedChange={(checked) => setSlideCountMode(checked ? "manual" : "idea")}
                    />
                  </label>
                </div>
                {slideCountMode === "manual" ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={slideCount}
                    disabled={pending}
                    aria-label={t("thinkingLab.execution.slideCount", "Slides")}
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                    onChange={(event) => {
                      const next = event.target.value.trim();
                      if (next === "" || /^\d+$/.test(next)) setSlideCount(next);
                    }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("thinkingLab.execution.slideCountIdea", "The Idea decides, from 2 to 10 slides.")}
                  </p>
                )}
              </section>
            ) : null}
            <section className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("thinkingLab.execution.imagePicture", "Picture")}
                </h3>
                <label className="flex items-center gap-2 text-sm">
                  <span>{withImage ? t("thinkingLab.execution.withImage", "With image") : t("thinkingLab.execution.copyOnly", "Copy only")}</span>
                  <Switch checked={withImage} disabled={pending} onCheckedChange={setWithImage} />
                </label>
              </div>
            </section>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => setImageOpen(false)}>
                {t("thinkingLab.execution.cancel", "Cancel")}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={pending || chosen.length === 0 || (imageFormat === "carousel" && slideCountMode === "manual" && (Number(slideCount) < 2 || Number(slideCount) > 10))}
                onClick={() => {
                  setImageOpen(false);
                  const count = Number(slideCount);
                  onConfirm(chosen, { sound: false, music: false }, "ugc", "vo", null, null, null, {
                    format: imageFormat,
                    slideCountMode: imageFormat === "carousel" ? slideCountMode : "idea",
                    slideCount: imageFormat === "carousel" && slideCountMode === "manual" ? count : null,
                    withImage,
                  });
                }}
              >
                {t("thinkingLab.execution.create", "Create Execution for {{count}} pillar", { count: chosen.length })}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </>
  );
}

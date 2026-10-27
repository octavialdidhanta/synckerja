import { useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import { ArrowLeft, Info } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/mobile-app/components/ui/drawer";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useSocialMediaData } from "@/6-1-dashboard/hook/useOptimizedSocialMediaState";
import { MobileContentPlanBriefEditor } from "@/mobile/6-1-content-calendar/components/MobileContentPlanBriefEditor";

type PlanLike = {
  id: string;
  title?: string | null;
  brief?: string | null;
  content_pillar_id?: string | null;
  content_pillar?: { name?: string | null } | null;
  content_type_id?: string | null;
  content_type?: { name?: string | null } | null;
  organization_id?: string | null;
  service?: { name?: string | null } | null;
};

function isEditableTarget(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** Restore height only after the keyboard is gone. Do not fight Vaul while it is opening. */
function useResetDrawerHeightAfterKeyboard(open: boolean) {
  const [contentEl, setContentEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const el = contentEl;
    if (!el) return;

    let keyboardOpen = false;
    let lockedTopPx = 0;
    let lockedHeightPx = 0;

    const captureLockFrame = () => {
      if (keyboardOpen) return;
      const rect = el.getBoundingClientRect();
      if (rect.height > 0) {
        lockedTopPx = rect.top;
        lockedHeightPx = rect.height;
      }
    };

    const pinDrawer = (reason: string) => {
      if (lockedHeightPx <= 0) captureLockFrame();
      if (lockedHeightPx <= 0) return;
      el.style.top = `${lockedTopPx}px`;
      el.style.height = `${lockedHeightPx}px`;
      el.style.maxHeight = "none";
      el.style.bottom = "auto";
      el.style.transform = "none";
      console.info("[storyboard-drawer] pin", reason, { lockedTopPx, lockedHeightPx });
    };

    const restoreFullHeight = (reason: string) => {
      if (keyboardOpen) {
        console.info("[storyboard-drawer] skip-restore", reason);
        return;
      }
      if (!el.style.height && !el.style.bottom && !el.style.top && !el.style.transform) return;
      console.info("[storyboard-drawer] restore", reason, {
        top: el.style.top,
        height: el.style.height,
        bottom: el.style.bottom,
      });
      el.style.top = "";
      el.style.height = "";
      el.style.maxHeight = "";
      el.style.bottom = "";
      el.style.transform = "";
    };

    const restoreSoon = (reason: string) => {
      restoreFullHeight(reason);
      window.setTimeout(() => restoreFullHeight(`${reason}+50`), 50);
      window.setTimeout(() => restoreFullHeight(`${reason}+200`), 200);
    };

    const onFocusIn = (event: FocusEvent) => {
      if (!(event.target instanceof Node) || !el.contains(event.target)) return;
      if (!isEditableTarget(event.target as Element)) return;
      captureLockFrame();
      pinDrawer("focusin");
    };

    const onFocusOut = (event: FocusEvent) => {
      if (keyboardOpen) return;
      const next = event.relatedTarget;
      if (next instanceof Node && el.contains(next) && isEditableTarget(next)) return;
      restoreSoon("focusout");
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    window.requestAnimationFrame(captureLockFrame);
    window.setTimeout(captureLockFrame, 120);

    let removeKeyboard: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      const onShow = () => {
        keyboardOpen = true;
        console.info("[storyboard-drawer] keyboard-show");
        pinDrawer("keyboard-show");
      };
      const onHide = () => {
        keyboardOpen = false;
        console.info("[storyboard-drawer] keyboard-hide");
        restoreSoon("keyboard-hide");
      };
      void Promise.all([
        Keyboard.addListener("keyboardWillShow", onShow),
        Keyboard.addListener("keyboardDidShow", onShow),
        Keyboard.addListener("keyboardWillHide", onHide),
        Keyboard.addListener("keyboardDidHide", onHide),
      ]).then((handles) => {
        removeKeyboard = () => {
          handles.forEach((handle) => void handle.remove());
        };
      });
    }

    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      removeKeyboard?.();
      keyboardOpen = false;
      restoreFullHeight("cleanup");
    };
  }, [open, contentEl]);

  return setContentEl;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PlanLike | null;
  /** When true, back returns to plan picker instead of closing everything. */
  showBackToPicker?: boolean;
  onBackToPicker?: () => void;
};

/**
 * Step 2: Storyline / Storyboard editor only (SSoT brief + images).
 */
export function MobilePlanBriefSheet({
  open,
  onOpenChange,
  plan,
  showBackToPicker = false,
  onBackToPicker,
}: Props) {
  const { t } = useAppTranslation();
  const { contentPillars, contentTypes } = useSocialMediaData();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const drawerContentRef = useResetDrawerHeightAfterKeyboard(open);

  useEffect(() => {
    if (!open) setDetailsOpen(false);
  }, [open]);

  const pillar = useMemo(() => {
    const fromMaster = contentPillars.find((item) => item.id === plan?.content_pillar_id);
    if (fromMaster) return fromMaster;
    const fallbackName = plan?.content_pillar?.name?.trim();
    if (!fallbackName) return null;
    return {
      id: plan?.content_pillar_id ?? fallbackName,
      name: fallbackName,
      description: null as string | null,
      category: null as string | null,
    };
  }, [contentPillars, plan?.content_pillar_id, plan?.content_pillar?.name]);

  const contentTypeName = useMemo(() => {
    const direct = plan?.content_type?.name?.trim();
    if (direct) return direct;
    const match = (contentTypes as Array<{ id?: string; name?: string | null }>).find(
      (item) => item.id && item.id === plan?.content_type_id,
    );
    return match?.name?.trim() || "";
  }, [contentTypes, plan?.content_type?.name, plan?.content_type_id]);

  const serviceName = plan?.service?.name?.trim() || "";
  const planTitle = plan?.title?.trim() || t("contentCalendar.mobile.untitled", "Untitled");
  const subtitle = [serviceName, planTitle, pillar?.name].filter(Boolean).join(" · ");

  return (
    <Drawer
      handleOnly
      shouldScaleBackground={false}
      repositionInputs={false}
      open={open}
      onOpenChange={onOpenChange}
    >
      <DrawerContent
        ref={drawerContentRef}
        className="!mt-0 top-24 h-[calc(100dvh-6rem)] max-h-[calc(100dvh-6rem)] flex min-h-0 min-w-0 flex-col overflow-hidden px-0 pb-0 ![touch-action:pan-x_pan-y]"
        style={{ overflow: "hidden" }}
      >
        <DrawerHeader className="min-w-0 w-full shrink-0 px-3 pb-2 pr-5 text-left">
          <div className="flex min-w-0 w-full items-start gap-1">
            {showBackToPicker && onBackToPicker ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-0.5 h-8 w-8 shrink-0"
                onClick={onBackToPicker}
                aria-label={t("common.back", "Back")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : null}
            <div className="flex min-w-0 flex-1 items-center overflow-hidden pr-4">
              <div
                data-vaul-no-drag=""
                className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overflow-y-hidden py-0.5 scrollbar-hide [touch-action:pan-x] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{ touchAction: "pan-x" }}
              >
                <DrawerTitle className="shrink-0 whitespace-nowrap text-base">
                  {t("contentCalendar.mobile.storyboardTitle", "Storyboard")}
                </DrawerTitle>
                {subtitle ? (
                  <button
                    type="button"
                    className="inline-flex shrink-0 items-center gap-1"
                    aria-label={t(
                      "contentCalendar.mobile.planDetailsAria",
                      "View service, title, and content pillar",
                    )}
                    aria-expanded={detailsOpen}
                    onClick={() => setDetailsOpen((openDetails) => !openDetails)}
                  >
                    <span className="whitespace-nowrap text-left text-xs text-muted-foreground">
                      {subtitle}
                    </span>
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Info className="h-3 w-3" />
                    </span>
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </DrawerHeader>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-0">
          {plan?.id ? (
            <MobileContentPlanBriefEditor
              planId={plan.id}
              brief={plan.brief}
              title={plan.title}
              contentTypeName={contentTypeName}
              organizationId={plan.organization_id}
            />
          ) : null}
          {detailsOpen ? (
            <div className="absolute inset-0 z-50 isolate">
              <button
                type="button"
                className="absolute inset-0 bg-background/40"
                aria-label={t("common.close", "Close")}
                onClick={() => setDetailsOpen(false)}
              />
              <div
                role="tooltip"
                className="absolute left-3 right-3 top-2 max-h-[45%] space-y-2 overflow-y-auto rounded-md border bg-background px-2.5 py-2 text-left shadow-md"
              >
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t("contentCalendar.mobile.detailService", "Service")}
                  </p>
                  <p className="text-xs text-foreground">
                    {serviceName || t("contentCalendar.mobile.untitled", "Untitled")}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t("contentCalendar.mobile.detailTitle", "Title")}
                  </p>
                  <p className="text-xs text-foreground">{planTitle}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t("contentCalendar.mobile.detailPillar", "Content pillar")}
                  </p>
                  {pillar ? (
                    <>
                      <p className="text-xs font-medium text-foreground">{pillar.name}</p>
                      {pillar.category?.trim() ? (
                        <p className="text-[10px] uppercase leading-tight text-muted-foreground">
                          {pillar.category.trim()}
                        </p>
                      ) : null}
                      <p className="mt-0.5 whitespace-pre-wrap text-xs text-foreground/80">
                        {pillar.description?.trim() ||
                          t(
                            "contentCalendar.mobile.noPillarDescription",
                            "No description available.",
                          )}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t("contentCalendar.mobile.noPillar", "No content pillar")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

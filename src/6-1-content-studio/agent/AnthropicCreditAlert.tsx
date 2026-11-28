/**
 * App-wide alert when the Synckerja Agent reports Anthropic credits, spend limit or payment blocking AI tagging.
 * Owner/admin see it on any page, not only in Content Studio → Agent:
 * - AnthropicCreditPopupWatcher: the shared billing dialog, once per laptop per blocked stretch (remembered in this browser).
 * - AnthropicCreditBanner: a sticky strip under the header until credits return or the owner closes it.
 */
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, X } from "lucide-react";
import { presentAnthropicCredit } from "@/shared/ai/geminiSpendCap";
import { useCurrentUserRole } from "@/shared/hooks/useCurrentUserRole";
import { CONTENT_STUDIO_BASE } from "../studioTabs";
import { ago, anthropicCreditAlert, type AnthropicCreditAlert } from "./agentData";
import { useAgentDevices } from "./useAgentData";

const AGENT_TAB_PATH = `${CONTENT_STUDIO_BASE}/agent`;
/** Outside the Agent tab a 2-minute check is enough; the Agent probes Anthropic every 10 minutes. */
const GLOBAL_REFETCH_MS = 2 * 60_000;
const POPUP_SEEN_KEY = "synckerja.anthropicCredit.popupSeen";
const BANNER_CLOSED_KEY = "synckerja.anthropicCredit.bannerClosed";

function readKey(name: string): string | null {
  try {
    return window.localStorage.getItem(name);
  } catch {
    return null;
  }
}

function writeKey(name: string, value: string): void {
  try {
    window.localStorage.setItem(name, value);
  } catch {
    /* storage unavailable: the alert may show again after reload */
  }
}

/** Popup keys already shown in this tab, in case localStorage is unavailable. */
const popupShown = new Set<string>();

function useAnthropicCreditAlert(): AnthropicCreditAlert | null {
  const role = useCurrentUserRole();
  const canSee = role.data === "owner" || role.data === "admin";
  const devices = useAgentDevices({ enabled: canSee, refetchInterval: GLOBAL_REFETCH_MS });
  if (!canSee) return null;
  return anthropicCreditAlert(devices.data ?? []);
}

/** Mounted once in the app layout (desktop and mobile). Renders nothing; opens the shared billing dialog. */
export function AnthropicCreditPopupWatcher() {
  const alert = useAnthropicCreditAlert();
  const key = alert?.key ?? null;
  const kind = alert?.credit.kind ?? null;

  useEffect(() => {
    if (!key || !kind) return;
    if (popupShown.has(key) || readKey(POPUP_SEEN_KEY) === key) return;
    popupShown.add(key);
    writeKey(POPUP_SEEN_KEY, key);
    presentAnthropicCredit(kind);
  }, [key, kind]);

  return null;
}

function headline(kind: AnthropicCreditAlert["credit"]["kind"]): string {
  if (kind === "spend_limit") return "Batas belanja Anthropic tercapai.";
  if (kind === "billing") return "Pembayaran Anthropic bermasalah.";
  return "Kredit Anthropic habis.";
}

/** Sticky strip in the desktop app shell. Hidden on the Agent tab, which shows the same notice per laptop. */
export function AnthropicCreditBanner({ className = "" }: { className?: string }) {
  const alert = useAnthropicCreditAlert();
  const { pathname } = useLocation();
  const [closed, setClosed] = useState<string | null>(() => readKey(BANNER_CLOSED_KEY));

  if (!alert || closed === alert.key || pathname.startsWith(AGENT_TAB_PATH)) return null;

  const close = () => {
    writeKey(BANNER_CLOSED_KEY, alert.key);
    setClosed(alert.key);
  };
  const { credit } = alert;

  return (
    <div
      role="alert"
      className={`flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 ${className}`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
      <p className="min-w-0 flex-1">
        <b>{headline(credit.kind)}</b> Footage baru belum diberi keterangan AI
        {credit.since ? ` sejak ${ago(credit.since)}` : ""} (laptop {alert.deviceName}). Ini bukan bug: Agent lanjut
        sendiri setelah {credit.kind === "spend_limit" ? "batasnya dinaikkan" : "kredit masuk"}.
      </p>
      <a
        href={credit.url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-md bg-amber-600 px-3 py-1 font-medium text-white hover:bg-amber-700"
      >
        {credit.kind === "spend_limit" ? "Naikkan batas" : "Isi kredit"}
      </a>
      <Link to={AGENT_TAB_PATH} className="shrink-0 font-medium underline underline-offset-2">
        Lihat Agent
      </Link>
      <button
        type="button"
        onClick={close}
        aria-label="Tutup peringatan kredit Anthropic"
        className="shrink-0 rounded p-1 text-amber-700 hover:bg-amber-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Run log of one AI employee: where each content plan came from and how each run ended. */

export type ChainLink = { id: string; code: string; statement: string };

export type IdeaChain = {
  idea: ChainLink | null;
  angle: ChainLink | null;
  territory: ChainLink | null;
  bigThought: ChainLink | null;
  master: ChainLink | null;
};

export type RunLogCanva = {
  status: string;
  imagesReady: boolean;
  logoPlaced: boolean;
  error: string;
  designUrl: string;
};

export type RunLogPlan = {
  id: string;
  title: string;
  postDate: string | null;
  pillarName: string;
  chain: IdeaChain | null;
  ideaMonthCount: number;
  canva: RunLogCanva | null;
};

export type RunLogSource = "manual" | "schedule" | "job" | "chat" | null;
export type RunLogStatus = "succeeded" | "failed" | "deferred" | "late" | "running" | "returned" | string;

export type RunLogRow = {
  id: string;
  sopCode: string;
  status: RunLogStatus;
  source: RunLogSource;
  startedAt: string | null;
  finishedAt: string | null;
  note: string;
  planCount: number;
  attempt: { chain: IdeaChain | null; pillarName: string } | null;
  plans: RunLogPlan[];
};

export type RunLogSummary = {
  runs: number;
  succeeded: number;
  failed: number;
  deferred: number;
  running: number;
  plans: number;
  uniqueIdeas: number;
};

export type RunLog = { month: string; summary: RunLogSummary; rows: RunLogRow[] };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function count(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function link(value: unknown): ChainLink | null {
  const row = record(value);
  if (!row) return null;
  const statement = text(row.statement).trim();
  const code = text(row.code).trim();
  return statement || code ? { id: text(row.id), code, statement } : null;
}

function chainOf(value: unknown): IdeaChain | null {
  const row = record(value);
  if (!row) return null;
  return {
    idea: link(row.idea),
    angle: link(row.angle),
    territory: link(row.territory),
    bigThought: link(row.big_thought),
    master: link(row.master),
  };
}

function sourceOf(value: unknown): RunLogSource {
  return value === "manual" || value === "schedule" || value === "job" || value === "chat" ? value : null;
}

export function parseRunLog(value: unknown): RunLog {
  const root = record(value) ?? {};
  const summary = record(root.summary) ?? {};
  const rows = Array.isArray(root.rows) ? root.rows : [];
  return {
    month: text(root.month),
    summary: {
      runs: count(summary.runs),
      succeeded: count(summary.succeeded),
      failed: count(summary.failed),
      deferred: count(summary.deferred),
      running: count(summary.running),
      plans: count(summary.plans),
      uniqueIdeas: count(summary.unique_ideas),
    },
    rows: rows.flatMap((item) => {
      const row = record(item);
      if (!row || !text(row.id)) return [];
      const attempt = record(row.attempt);
      const plans = Array.isArray(row.plans) ? row.plans : [];
      return [{
        id: text(row.id),
        sopCode: text(row.sop_code),
        status: text(row.status),
        source: sourceOf(row.trigger_source),
        startedAt: text(row.started_at) || null,
        finishedAt: text(row.finished_at) || null,
        note: text(row.note),
        planCount: count(row.plan_count),
        attempt: attempt ? { chain: chainOf(attempt.chain), pillarName: text(attempt.pillar_name) } : null,
        plans: plans.flatMap((entry) => {
          const plan = record(entry);
          if (!plan || !text(plan.id)) return [];
          const canva = record(plan.canva);
          return [{
            id: text(plan.id),
            title: text(plan.title),
            postDate: text(plan.post_date) || null,
            pillarName: text(plan.pillar_name),
            chain: chainOf(plan.chain),
            ideaMonthCount: count(plan.idea_month_count),
            canva: canva
              ? {
                status: text(canva.status),
                imagesReady: canva.images_ready === true,
                logoPlaced: canva.logo_placed === true,
                error: text(canva.error),
                designUrl: text(canva.design_url).startsWith("https://") ? text(canva.design_url) : "",
              }
              : null,
          }];
        }),
      }];
    }),
  };
}

type Label = (key: string, fallback: string) => string;

/** The reason a run ended, from its note ("sop1 <label> ... reject=<check>"), in plain words. */
export function runReason(row: Pick<RunLogRow, "note" | "status" | "planCount">, t: Label): string {
  const note = row.note.trim();
  const label = /^sop1\s+(\S+)/i.exec(note)?.[1] ?? "";
  const reject = /\breject=(\S+)/.exec(note)?.[1] ?? "";
  const check = checkName(reject, t);
  switch (label) {
    case "done":
      return row.planCount > 0 ? t("aiEmployee.log.reason.done", "Plan dibuat") : t("aiEmployee.log.reason.empty", "Tidak ada plan baru");
    case "dry_run":
      return t("aiEmployee.log.reason.dryRun", "Uji coba, tidak disimpan");
    case "target_met":
      return t("aiEmployee.log.reason.targetMet", "Target hari ini sudah terpenuhi");
    case "checks_failed":
      return check
        ? `${t("aiEmployee.log.reason.checksFailed", "Semua draf gagal dicek")}: ${check}`
        : t("aiEmployee.log.reason.checksFailed", "Semua draf gagal dicek");
    case "ideas_exhausted":
      return t("aiEmployee.log.reason.ideasExhausted", "Ide habis setelah draf ditolak");
    case "time_budget":
      return check
        ? `${t("aiEmployee.log.reason.timeBudget", "Waktu habis sebelum draf lolos")} (${check})`
        : t("aiEmployee.log.reason.timeBudget", "Waktu habis sebelum draf lolos");
    case "quota":
      return t("aiEmployee.log.reason.quota", "Kuota model habis");
    case "path_unconfirmed":
      return t("aiEmployee.log.reason.pathUnconfirmed", "Ide di Fokus angle belum cocok dengan pilar yang dipilih");
    case "ideas_blocked":
      return t("aiEmployee.log.reason.ideasBlocked", "Tidak ada ide siap pakai di Fokus angle");
    case "no_pillars":
      return t("aiEmployee.log.reason.noPillars", "Tidak ada pilar aktif");
    case "brief_missing":
      return t("aiEmployee.log.reason.briefMissing", "Katalog di brief belum diisi");
    case "catalog_limit":
      return t("aiEmployee.log.reason.catalogLimit", "Brief memilih lebih dari satu katalog");
    case "schedule_missing":
      return t("aiEmployee.log.reason.scheduleMissing", "Jadwal tidak ditemukan");
    case "sop_missing":
      return t("aiEmployee.log.reason.sopMissing", "SOP belum dibuat");
    case "pillar_cap":
      return t("aiEmployee.log.reason.pillarCap", "Pilar tidak bisa dipakai");
    case "model_failed":
      return t("aiEmployee.log.reason.modelFailed", "Model AI gagal menjawab");
    default:
      break;
  }
  if (row.status === "running") return t("aiEmployee.log.reason.running", "Sedang berjalan");
  if (row.status === "succeeded") return row.planCount > 0 ? t("aiEmployee.log.reason.done", "Plan dibuat") : "—";
  if (/^model_failed/.test(note)) return t("aiEmployee.log.reason.modelFailed", "Model AI gagal menjawab");
  return note && note !== "manual" ? note : "—";
}

function checkName(reject: string, t: Label): string {
  if (!reject) return "";
  if (reject.startsWith("copy:")) return t("aiEmployee.log.check.copy", "naskah terlalu mirip plan sebelumnya");
  const names: Record<string, [string, string]> = {
    hookHolds: ["aiEmployee.log.check.hookHolds", "hook slide 1"],
    soundsSpoken: ["aiEmployee.log.check.soundsSpoken", "bahasa kurang lisan"],
    usesSlang: ["aiEmployee.log.check.usesSlang", "bahasa terlalu formal"],
    pillarFits: ["aiEmployee.log.check.pillarFits", "tidak sesuai pilar"],
    messageStays: ["aiEmployee.log.check.messageStays", "mengulang plan terakhir"],
    mechanismVisible: ["aiEmployee.log.check.mechanismVisible", "draf tidak membawa ide"],
    checks_incomplete: ["aiEmployee.log.check.incomplete", "pemeriksaan tidak lengkap"],
  };
  const known = names[reject];
  return known ? t(known[0], known[1]) : reject;
}

/** "AN02 · ID01" for the table; empty when the run has no idea yet. */
export function ideaCode(chain: IdeaChain | null): string {
  if (!chain) return "";
  return [chain.angle?.code, chain.idea?.code].filter(Boolean).join(" · ");
}

/** The month before or after "YYYY-MM". */
export function shiftMonth(month: string, step: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return month;
  const index = Number(match[1]) * 12 + Number(match[2]) - 1 + step;
  const year = Math.floor(index / 12);
  const value = (index % 12) + 1;
  return `${year}-${String(value).padStart(2, "0")}`;
}

/** Current month in Asia/Jakarta as "YYYY-MM". */
export function jakartaMonth(now: Date = new Date()): string {
  const local = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Levels of the Thinking Lab chain, parent first. */
export const CHAIN_LEVELS = ["master", "bigThought", "territory", "angle", "idea"] as const;
export type ChainLevel = (typeof CHAIN_LEVELS)[number];
export type ChainFilter = Partial<Record<ChainLevel, string>>;
export type ChainOption = { id: string; label: string; runs: number };

/** Chains of a run: its plans, or the idea it tried when no plan came. */
export function rowChains(row: RunLogRow): IdeaChain[] {
  const chains = row.plans.map((plan) => plan.chain).filter((chain): chain is IdeaChain => Boolean(chain));
  if (chains.length > 0) return chains;
  return row.attempt?.chain ? [row.attempt.chain] : [];
}

function levelId(chain: IdeaChain, level: ChainLevel): string {
  return chain[level]?.id || "";
}

function chainFits(chain: IdeaChain, filter: ChainFilter, upTo: number = CHAIN_LEVELS.length): boolean {
  return CHAIN_LEVELS.slice(0, upTo).every((level) => !filter[level] || levelId(chain, level) === filter[level]);
}

export function chainFilterActive(filter: ChainFilter): boolean {
  return CHAIN_LEVELS.some((level) => Boolean(filter[level]));
}

/** A run fits when one of its chains has every chosen level. */
export function rowFitsChain(row: RunLogRow, filter: ChainFilter): boolean {
  if (!chainFilterActive(filter)) return true;
  return rowChains(row).some((chain) => chainFits(chain, filter));
}

function optionLabel(item: ChainLink, level: ChainLevel): string {
  const statement = item.statement.length > 70 ? `${item.statement.slice(0, 69).trimEnd()}…` : item.statement;
  if (level === "master" || !item.code) return statement || item.code;
  return statement ? `${item.code} · ${statement}` : item.code;
}

/** Choices for one level, limited by the levels above it, with how many runs each has. */
export function chainOptions(rows: RunLogRow[], filter: ChainFilter, level: ChainLevel): ChainOption[] {
  const depth = CHAIN_LEVELS.indexOf(level);
  const found = new Map<string, ChainOption>();
  for (const row of rows) {
    const seen = new Set<string>();
    for (const chain of rowChains(row)) {
      if (!chainFits(chain, filter, depth)) continue;
      const item = chain[level];
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      const option = found.get(item.id) ?? { id: item.id, label: optionLabel(item, level), runs: 0 };
      option.runs += 1;
      found.set(item.id, option);
    }
  }
  return [...found.values()].sort((left, right) => left.label.localeCompare(right.label));
}

/** A new filter with one level set; the levels below it are cleared. */
export function setChainLevel(filter: ChainFilter, level: ChainLevel, id: string): ChainFilter {
  const depth = CHAIN_LEVELS.indexOf(level);
  const next: ChainFilter = {};
  CHAIN_LEVELS.slice(0, depth).forEach((parent) => {
    if (filter[parent]) next[parent] = filter[parent];
  });
  if (id) next[level] = id;
  return next;
}

/** Summary of the runs shown, so the numbers follow the filters. */
export function summarizeRows(rows: RunLogRow[]): RunLogSummary {
  const ideas = new Set<string>();
  let plans = 0;
  const summary: RunLogSummary = { runs: rows.length, succeeded: 0, failed: 0, deferred: 0, running: 0, plans: 0, uniqueIdeas: 0 };
  for (const row of rows) {
    if (row.status === "succeeded") summary.succeeded += 1;
    else if (row.status === "failed" || row.status === "returned") summary.failed += 1;
    else if (row.status === "running") summary.running += 1;
    else summary.deferred += 1;
    plans += row.plans.length;
    row.plans.forEach((plan) => {
      if (plan.chain?.idea?.id) ideas.add(plan.chain.idea.id);
    });
  }
  summary.plans = plans;
  summary.uniqueIdeas = ideas.size;
  return summary;
}

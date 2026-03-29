// Logger configuration for development and production
const isDevelopment = import.meta.env.DEV;
const isVerbose = import.meta.env.VITE_VERBOSE_LOGGING === "true";

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3, trace: 4 } as const;
const envLevel = (import.meta.env.VITE_LOG_LEVEL as keyof typeof LEVELS) || (isDevelopment ? "info" : "warn");
const currentLevel = LEVELS[envLevel] ?? (isDevelopment ? 2 : 1);

function isDailyTaskPage(): boolean {
  return typeof window !== "undefined" && window.location.pathname.includes("/tools/daily-task");
}

function isHomePage(): boolean {
  return typeof window !== "undefined" && (window.location.pathname === "/" || window.location.pathname === "");
}

function isOKRPage(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.location.pathname === "/okr" || window.location.pathname.startsWith("/okr/"))
  );
}

function isAnalysisPage(): boolean {
  return isDailyTaskPage() || isHomePage() || isOKRPage();
}

function consoleForAnalysisPage(...args: unknown[]) {
  if (isAnalysisPage()) console.log(...args);
  else console.debug(...args);
}

const lastLogAt = new Map<string, number>();
const loggedOnce = new Set<string>();

function shouldLogRateLimited(key: string, minIntervalMs = 3000): boolean {
  if (isAnalysisPage()) return true;
  const now = Date.now();
  const last = lastLogAt.get(key) ?? 0;
  if (now - last < minIntervalMs) return false;
  lastLogAt.set(key, now);
  return true;
}

function shouldLogOnce(key: string): boolean {
  if (loggedOnce.has(key)) return false;
  loggedOnce.add(key);
  return true;
}

function withGroupCollapsed(label: string, fn: () => void): void {
  if (isDevelopment || isAnalysisPage()) {
    console.groupCollapsed(label);
    try {
      fn();
    } finally {
      console.groupEnd();
    }
  } else {
    fn();
  }
}

export const logger = {
  trace: (...args: unknown[]) => {
    if (isAnalysisPage() || currentLevel >= LEVELS.trace) consoleForAnalysisPage(...args);
  },
  debug: (...args: unknown[]) => {
    if (isAnalysisPage() || currentLevel >= LEVELS.debug || isVerbose) consoleForAnalysisPage(...args);
  },
  info: (...args: unknown[]) => {
    if (isAnalysisPage() || currentLevel >= LEVELS.info || isVerbose) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    if (currentLevel >= LEVELS.warn) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    if (currentLevel >= LEVELS.error) console.error(...args);
  },
  query: (...args: unknown[]) => {
    if (isAnalysisPage() || (isDevelopment && (isVerbose || currentLevel >= LEVELS.debug))) {
      (isAnalysisPage() ? console.log : console.debug)(...args);
    }
  },
  userData: (...args: unknown[]) => {
    if (isAnalysisPage() || (isDevelopment && (isVerbose || currentLevel >= LEVELS.debug))) {
      (isAnalysisPage() ? console.log : console.debug)(...args);
    }
  },
  realtime: (...args: unknown[]) => {
    if (isAnalysisPage() || (isDevelopment && (isVerbose || currentLevel >= LEVELS.debug))) {
      (isAnalysisPage() ? console.log : console.debug)(...args);
    }
  },
  performance: (label: string, duration: number, threshold = 500) => {
    const isUserDataFetch = label.toLowerCase().includes("user data fetch");
    const showAll = isAnalysisPage();
    if (duration > threshold && !isUserDataFetch) {
      console.warn(`⚠️ SLOW OPERATION: ${label} took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`);
    } else if ((showAll || (isDevelopment && (isVerbose || currentLevel >= LEVELS.debug))) && !isUserDataFetch) {
      (isAnalysisPage() ? console.log : console.debug)(`⚡ ${label}: ${duration.toFixed(2)}ms`);
    }
  },
  rateLimited: (key: string, minIntervalMs: number, cb: () => void) => {
    if (shouldLogRateLimited(key, minIntervalMs)) cb();
  },
  once: (key: string, cb: () => void) => {
    if (shouldLogOnce(key)) cb();
  },
  groupCollapsed: (label: string, cb: () => void) => withGroupCollapsed(label, cb),
};

export const devLog = {
  debug: logger.debug,
  info: logger.info,
  warn: logger.warn,
  error: logger.error,
  log: logger.debug,
};

export default logger;

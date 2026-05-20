import type { Plugin } from "vite";

const STYLESHEET_LINK_RE =
  /<link\s+[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+\.css)"[^>]*>/gi;

/**
 * Loads the main Tailwind bundle without blocking first paint (Lighthouse render-blocking CSS).
 * Pair with minimal inline critical CSS in index.html to limit FOUC.
 */
export function deferAppCssPlugin(): Plugin {
  return {
    name: "synckerja-defer-app-css",
    apply: "build",
    enforce: "post",
    transformIndexHtml(html) {
      return html.replace(STYLESHEET_LINK_RE, (_full, href) => {
        return [
          `<link rel="preload" href="${href}" as="style" onload="this.onload=null;this.rel='stylesheet'">`,
          `<noscript><link rel="stylesheet" href="${href}"></noscript>`,
        ].join("\n    ");
      });
    },
  };
}

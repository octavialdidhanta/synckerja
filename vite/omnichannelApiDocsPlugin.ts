import { execSync } from "node:child_process";
import fs from "node:fs";
import type { Plugin, ViteDevServer } from "vite";
import {
  isOmnichannelApiDocsSourceFile,
  isOmnichannelApiDocsStale,
  OMNICHANNEL_API_DOCS_GENERATOR,
  OMNICHANNEL_API_DOCS_ROOT,
  OMNICHANNEL_API_DOCS_SOURCE_PATHS,
} from "../scripts/lib/omnichannelApiDocsSources.mjs";

function regenerateDocs() {
  execSync(`node "${OMNICHANNEL_API_DOCS_GENERATOR}"`, {
    stdio: "inherit",
    cwd: OMNICHANNEL_API_DOCS_ROOT,
  });
}

function syncIfStale() {
  if (isOmnichannelApiDocsStale()) {
    console.log("[omnichannel-api-docs] sources changed — regenerating…");
    regenerateDocs();
  }
}

function watchSources(server: ViteDevServer) {
  for (const sourcePath of OMNICHANNEL_API_DOCS_SOURCE_PATHS) {
    if (fs.existsSync(sourcePath)) {
      server.watcher.add(sourcePath);
    }
  }

  server.watcher.on("change", (file) => {
    if (!isOmnichannelApiDocsSourceFile(file)) return;
    console.log("[omnichannel-api-docs] source changed — regenerating…");
    regenerateDocs();
    server.ws.send({ type: "full-reload", path: "*" });
  });
}

/** Keep tab Docs in sync when openapi.yaml or omnichannel edge handlers change. */
export function omnichannelApiDocsPlugin(): Plugin {
  return {
    name: "omnichannel-api-docs-sync",
    buildStart() {
      syncIfStale();
    },
    configureServer(server) {
      syncIfStale();
      watchSources(server);
    },
  };
}

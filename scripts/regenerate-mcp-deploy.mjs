import fs from "fs";
import path from "path";

const root = process.cwd();
const outDir = path.join(root, "scripts", ".deploy-temp");

const bundles = {
  "flow-runtime": {
    entrypoint_path: "flow-runtime/index.ts",
    files: [
      "supabase/functions/flow-runtime/index.ts",
      "supabase/functions/_shared/omnichannelFlow/graphExecutor.ts",
      "supabase/functions/_shared/omnichannelFlow/flowRuntimeSendMessage.ts",
      "supabase/functions/_shared/omnichannelFlow/sendMessageRuntime.ts",
      "supabase/functions/_shared/omnichannelFlow/endNodeRuntime.ts",
      "supabase/functions/_shared/omnichannelFlow/enrollmentRules.ts",
      "supabase/functions/_shared/omnichannelFlow/interpolateVariables.ts",
      "supabase/functions/_shared/omnichannelFlow/omnichannelFlowAuth.ts",
    ],
  },
  "flow-runtime-send": {
    entrypoint_path: "flow-runtime-send/index.ts",
    files: [
      "supabase/functions/flow-runtime-send/index.ts",
      "supabase/functions/_shared/omnichannelFlow/flowRuntimeSendMessage.ts",
      "supabase/functions/_shared/omnichannelFlow/omnichannelFlowAuth.ts",
    ],
  },
  "whatsapp-webhook": {
    entrypoint_path: "whatsapp-webhook/index.ts",
    files: [
      "supabase/functions/whatsapp-webhook/index.ts",
      "supabase/functions/_shared/omnichannelFlow/sendMessageRuntime.ts",
      "supabase/functions/_shared/omnichannelPublicApi/syncOmnichannelWhatsAppDelivery.ts",
      "supabase/functions/_shared/omnichannelPublicApi/mergeWaInboundAttribution.ts",
      "supabase/functions/_shared/omnichannelPublicApi/resolveWebIdFromWhatsAppAccount.ts",
      "supabase/functions/_shared/omnichannelPublicApi/urlParams.ts",
      "supabase/functions/_shared/omnichannelPublicApi/apiLeadCrmFields.ts",
    ],
  },
};

fs.mkdirSync(outDir, { recursive: true });

for (const [name, cfg] of Object.entries(bundles)) {
  const payload = {
    name,
    entrypoint_path: cfg.entrypoint_path,
    verify_jwt: false,
    files: cfg.files.map((p) => ({
      name: p.replace("supabase/functions/", ""),
      content: fs.readFileSync(path.join(root, p), "utf8"),
    })),
  };
  const outPath = path.join(outDir, `mcp-${name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(payload));
  console.log(`Wrote ${outPath} (${JSON.stringify(payload).length} chars, ${payload.files.length} files)`);
}

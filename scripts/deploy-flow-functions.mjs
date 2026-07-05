import fs from "fs";
import path from "path";

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const ref = "wqdzqqshoifwyrltzgvx";
const root = process.cwd();

if (!token) {
  console.error("SUPABASE_ACCESS_TOKEN is required");
  process.exit(1);
}

const bundles = {
  "flow-runtime": [
    "supabase/functions/flow-runtime/index.ts",
    "supabase/functions/_shared/omnichannelFlow/graphExecutor.ts",
    "supabase/functions/_shared/omnichannelFlow/flowRuntimeSendMessage.ts",
    "supabase/functions/_shared/omnichannelFlow/sendMessageRuntime.ts",
    "supabase/functions/_shared/omnichannelFlow/endNodeRuntime.ts",
    "supabase/functions/_shared/omnichannelFlow/enrollmentRules.ts",
    "supabase/functions/_shared/omnichannelFlow/interpolateVariables.ts",
    "supabase/functions/_shared/omnichannelFlow/omnichannelFlowAuth.ts",
  ],
  "flow-runtime-send": [
    "supabase/functions/flow-runtime-send/index.ts",
    "supabase/functions/_shared/omnichannelFlow/flowRuntimeSendMessage.ts",
    "supabase/functions/_shared/omnichannelFlow/omnichannelFlowAuth.ts",
  ],
};

async function deploy(name, filePaths) {
  const files = filePaths.map((p) => ({
    name: p.replace("supabase/functions/", ""),
    content: fs.readFileSync(path.join(root, p), "utf8"),
  }));

  const body = {
    name,
    entrypoint_path: `${name}/index.ts`,
    verify_jwt: false,
    files,
  };

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/functions/deploy?slug=${name}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  const text = await res.text();
  console.log(`${name}: ${res.status}`, text.slice(0, 500));
  if (!res.ok) process.exit(1);
}

for (const [name, paths] of Object.entries(bundles)) {
  await deploy(name, paths);
}

console.log("All flow functions deployed.");
console.log("Tip: if deploy fails with 401, use CLI instead:");
console.log("  npx supabase functions deploy flow-runtime flow-runtime-send whatsapp-webhook --project-ref wqdzqqshoifwyrltzgvx --no-verify-jwt --use-api");

import fs from "fs";
import path from "path";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = "wqdzqqshoifwyrltzgvx";
const root = process.cwd();
const filePaths = [
  "supabase/functions/whatsapp-webhook/index.ts",
  "supabase/functions/_shared/omnichannelFlow/sendMessageRuntime.ts",
  "supabase/functions/_shared/omnichannelPublicApi/syncOmnichannelWhatsAppDelivery.ts",
  "supabase/functions/_shared/omnichannelPublicApi/resolveWebIdFromWhatsAppAccount.ts",
  "supabase/functions/_shared/omnichannelPublicApi/urlParams.ts",
  "supabase/functions/_shared/omnichannelPublicApi/mergeWaInboundAttribution.ts",
  "supabase/functions/_shared/omnichannelPublicApi/apiLeadCrmFields.ts",
];

const files = filePaths.map((p) => ({
  name: p.replace("supabase/functions/", ""),
  content: fs.readFileSync(path.join(root, p), "utf8"),
}));

const body = {
  name: "whatsapp-webhook",
  entrypoint_path: "whatsapp-webhook/index.ts",
  verify_jwt: false,
  files,
};

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/functions/deploy?slug=whatsapp-webhook`,
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
console.log(res.status, text.slice(0, 3000));
process.exit(res.ok ? 0 : 1);

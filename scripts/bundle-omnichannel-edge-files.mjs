import fs from "node:fs";
import path from "node:path";

const root = path.resolve("supabase/functions");

const publicApiFiles = [
  "omnichannel-public-api/index.ts",
  "omnichannel-public-api/handlers/analyticsHandlers.ts",
  "omnichannel-public-api/handlers/leadsHandler.ts",
  "omnichannel-public-api/handlers/invoiceHandler.ts",
  "_shared/omnichannelPublicApi/auth.ts",
  "_shared/omnichannelPublicApi/response.ts",
  "_shared/omnichannelPublicApi/analyticsRollupDebounce.ts",
  "_shared/omnichannelPublicApi/ensureAnalyticsSession.ts",
  "_shared/omnichannelPublicApi/syncFloatingWaClickToLead.ts",
  "_shared/omnichannelPublicApi/resolveClickPathFromPageView.ts",
  "_shared/omnichannelPublicApi/urlParams.ts",
  "_shared/omnichannelPublicApi/leadStatusMap.ts",
  "_shared/omnichannelPublicApi/phoneNormalize.ts",
  "_shared/omnichannelPublicApi/leadFormData.ts",
  "_shared/omnichannelPublicApi/triggerLeadWhatsApp.ts",
  "_shared/omnichannelPublicApi/leadWhatsAppBodyParams.ts",
  "_shared/omnichannelPublicApi/leadTemplateMapping.ts",
  "_shared/omnichannelPublicApi/leadWhatsAppTemplateSlots.ts",
  "_shared/omnichannelPublicApi/persistLeadWhatsAppThread.ts",
  "_shared/omnichannelPublicApi/leadWhatsAppTemplatePreview.ts",
  "_shared/omnichannelPublicApi/resolveOrganizationWhatsAppCredentials.ts",
  "_shared/omnichannelPublicApi/resolveWebIdFromWhatsAppAccount.ts",
  "_shared/omnichannelPublicApi/kickOfflineConversions.ts",
  "_shared/omnichannelPublicApi/createLeadConversionSalesActivity.ts",
  "_shared/omnichannelPublicApi/triggerInvoiceWhatsApp.ts",
  "_shared/omnichannelPublicApi/whatsappConversationForLead.ts",
  "_shared/omnichannelPublicApi/mergeWaInboundAttribution.ts",
];

const manageFiles = [
  "omnichannel-api-manage/index.ts",
  "_shared/omnichannelPublicApi/auth.ts",
  "_shared/omnichannelPublicApi/response.ts",
  "_shared/omnichannelPublicApi/tokenOrigins.ts",
  "_shared/omnichannelPublicApi/urlParams.ts",
  "_shared/omnichannelPublicApi/leadTemplateMappingManage.ts",
  "_shared/omnichannelPublicApi/leadFormDataKeys.ts",
  "_shared/omnichannelPublicApi/leadTemplateMapping.ts",
  "_shared/omnichannelPublicApi/leadWhatsAppTemplateSlots.ts",
  "_shared/omnichannelPublicApi/leadWhatsAppTemplatePreview.ts",
  "_shared/omnichannelPublicApi/resolveOrganizationWhatsAppCredentials.ts",
  "_shared/omnichannelPublicApi/resolveWebIdFromWhatsAppAccount.ts",
  "_shared/omnichannelPublicApi/webIdWhatsAppAccountManage.ts",
  "_shared/omnichannelPublicApi/leadFormData.ts",
];

const webhookFiles = [
  "whatsapp-webhook/index.ts",
  "_shared/omnichannelPublicApi/mergeWaInboundAttribution.ts",
  "_shared/omnichannelPublicApi/resolveWebIdFromWhatsAppAccount.ts",
  "_shared/omnichannelPublicApi/urlParams.ts",
];

function bundle(relPaths) {
  return relPaths.map((rel) => {
    const abs = path.join(root, rel);
    return { name: rel, content: fs.readFileSync(abs, "utf8") };
  });
}

const outDir = path.resolve("scripts/.edge-bundles");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "omnichannel-public-api.json"),
  JSON.stringify(bundle(publicApiFiles)),
);
fs.writeFileSync(
  path.join(outDir, "omnichannel-api-manage.json"),
  JSON.stringify(bundle(manageFiles)),
);
fs.writeFileSync(
  path.join(outDir, "whatsapp-webhook.json"),
  JSON.stringify(bundle(webhookFiles)),
);
console.log("Wrote bundles to", outDir);

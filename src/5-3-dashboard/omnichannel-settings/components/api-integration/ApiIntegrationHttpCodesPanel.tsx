import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import {
  DocsNumberedCardList,
  docsInlineCodeClass,
  docsTextClass,
  renderInlineMarkdownText,
} from "./apiIntegrationDocsUi.tsx";

const HTTP_CODE_ROWS = [
  "200",
  "201",
  "400",
  "401",
  "403",
  "404",
  "405",
  "409",
  "422",
  "429",
  "500",
  "503",
] as const;

const CHECKLIST_KEYS = [
  "omnichannel.settings.apiIntegration.docs.checklist.token",
  "omnichannel.settings.apiIntegration.docs.checklist.sdk",
  "omnichannel.settings.apiIntegration.docs.checklist.form",
  "omnichannel.settings.apiIntegration.docs.checklist.invoice",
] as const;

const docsKey = (suffix: string) => `omnichannel.settings.apiIntegration.docs.httpCodes.${suffix}`;

export function ApiIntegrationHttpCodesPanel() {
  const { t } = useTranslation();

  const checklistItems = useMemo(
    () => CHECKLIST_KEYS.map((key) => t(key)),
    [t],
  );

  return (
    <section className="mt-8 scroll-mt-4 border-t border-border pt-6">
      <h2
        id="kode-http-checklist"
        className="mb-2 scroll-mt-4 text-base font-semibold text-foreground"
      >
        {t(docsKey("title"))}
      </h2>
      <p className={cn("mb-3 text-muted-foreground", docsTextClass)}>{t(docsKey("intro"))}</p>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className={cn("w-full min-w-[640px] border-collapse text-left", docsTextClass)}>
          <thead className="bg-muted/60 text-foreground">
            <tr>
              <th className="w-[72px] px-3 py-2 font-semibold">{t(docsKey("colCode"))}</th>
              <th className="w-[28%] px-3 py-2 font-semibold">{t(docsKey("colMeaning"))}</th>
              <th className="px-3 py-2 font-semibold">{t(docsKey("colDetail"))}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {HTTP_CODE_ROWS.map((code) => (
              <tr key={code} className="hover:bg-muted/30">
                <td className="px-3 py-2 align-top">
                  <code className={cn(docsInlineCodeClass, "tabular-nums")}>{code}</code>
                </td>
                <td className="px-3 py-2 align-top font-medium text-foreground">
                  {t(docsKey(`${code}.label`))}
                </td>
                <td className="px-3 py-2 align-top text-foreground">
                  {renderInlineMarkdownText(t(docsKey(`${code}.detail`)))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mb-2 mt-6 text-sm font-semibold text-foreground">
        {t(docsKey("checklistTitle"))}
      </h3>
      <DocsNumberedCardList
        items={checklistItems}
        renderItem={(item) => (typeof item === "string" ? renderInlineMarkdownText(item) : item)}
      />
    </section>
  );
}

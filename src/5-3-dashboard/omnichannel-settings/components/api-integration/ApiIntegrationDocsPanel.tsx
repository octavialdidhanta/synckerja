import { Children, isValidElement, useMemo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "react-i18next";
import apiDocsMarkdown from "../../../../../API_ACCESSIBILITY_DOCS.md?raw";
import { cn } from "@/shared/lib/utils";
import {
  DocsNumberedCardList,
  docsInlineCodeClass,
  docsTextClass,
} from "./apiIntegrationDocsUi.tsx";
import { ApiIntegrationHttpCodesPanel } from "./ApiIntegrationHttpCodesPanel";

const panelScrollClass =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const HTTP_SECTION_MARKER = "## Kode HTTP & checklist";

function normalizeDocsMarkdown(markdown: string): string {
  return markdown.replace(/^(#### POST .+)$/gm, "$1\n");
}

/** HTTP codes & checklist are rendered via i18n — strip from markdown source. */
function stripHttpAndChecklistSection(markdown: string): string {
  const idx = markdown.indexOf(HTTP_SECTION_MARKER);
  if (idx < 0) return markdown;
  return markdown
    .slice(0, idx)
    .replace(/\n---\s*$/, "")
    .trimEnd();
}

function DocsUnorderedList({ children }: { children?: ReactNode }) {
  const items = Children.toArray(children).filter(isValidElement);
  if (items.length === 0) return null;

  return (
    <DocsNumberedCardList
      items={items.map((child) => (child.props as { children?: ReactNode }).children ?? null)}
    />
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/ /g, "-");
}

function headingText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(headingText).join("");
  if (children && typeof children === "object" && "props" in children) {
    const props = (children as { props?: { children?: ReactNode } }).props;
    return headingText(props?.children ?? "");
  }
  return "";
}

function DocsInlineCode({
  className,
  children,
}: {
  inline?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  // react-markdown v10: inline code has no className; fenced blocks have language-*
  const isFencedBlock = Boolean(className);

  if (!isFencedBlock) {
    return <code className={docsInlineCodeClass}>{children}</code>;
  }

  return (
    <code className={cn("block font-mono text-sm leading-6 text-foreground", className)}>
      {children}
    </code>
  );
}

function DocsEndpointHeading({ children }: { children?: ReactNode }) {
  const text = headingText(children).trim();
  const match = text.match(/^(POST|GET|PUT|PATCH|DELETE)\s+(\S+)$/i);

  if (match) {
    const method = match[1].toUpperCase();
    const path = match[2];
    return (
      <div className="mb-1.5 mt-4 rounded-md border border-border/80 bg-muted/20 px-3 py-2 first:mt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-primary px-2 py-0.5 font-mono text-xs font-semibold tracking-wide text-primary-foreground">
            {method}
          </span>
          <code className={cn(docsInlineCodeClass, "break-all bg-transparent px-0")}>{path}</code>
        </div>
      </div>
    );
  }

  return <h4 className="mb-1 mt-4 text-sm font-semibold text-foreground">{children}</h4>;
}

const docsMarkdownComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="mb-1 mt-0 text-lg font-semibold tracking-tight text-foreground">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => {
    const id = slugify(headingText(children));
    return (
      <h2
        id={id}
        className="mb-3 mt-8 scroll-mt-4 border-b border-border pb-2 text-base font-semibold text-foreground first:mt-0"
      >
        {children}
      </h2>
    );
  },
  h3: ({ children }: { children?: ReactNode }) => {
    const id = slugify(headingText(children));
    return (
      <h3
        id={id}
        className="mb-2 mt-6 scroll-mt-4 border-b border-border/60 pb-1 text-sm font-semibold text-foreground"
      >
        {children}
      </h3>
    );
  },
  h4: DocsEndpointHeading,
  p: ({ children }: { children?: ReactNode }) => (
    <p className={cn("my-1.5 text-foreground", docsTextClass)}>{children}</p>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  ul: DocsUnorderedList,
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className={cn("my-2 list-decimal space-y-1.5 pl-5 text-foreground", docsTextClass)}>
      {children}
    </ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="min-w-0 text-foreground">{children}</li>
  ),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote
      className={cn(
        "my-3 rounded-md border border-amber-200/80 bg-amber-50/50 px-3 py-2 text-foreground dark:border-amber-900/40 dark:bg-amber-950/20",
        docsTextClass,
      )}
    >
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-border" />,
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a
      href={href}
      className="font-medium text-primary underline-offset-2 hover:underline"
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noreferrer" : undefined}
    >
      {children}
    </a>
  ),
  table: ({ children }: { children?: ReactNode }) => (
    <div className="my-3 overflow-x-auto rounded-md border border-border">
      <table className={cn("w-full min-w-[480px] border-collapse text-left", docsTextClass)}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: { children?: ReactNode }) => (
    <thead className="bg-muted/60 text-foreground">{children}</thead>
  ),
  tbody: ({ children }: { children?: ReactNode }) => (
    <tbody className="divide-y divide-border">{children}</tbody>
  ),
  tr: ({ children }: { children?: ReactNode }) => (
    <tr className="hover:bg-muted/30">{children}</tr>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th className="px-3 py-2 font-semibold text-foreground">{children}</th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="px-3 py-2 align-top text-foreground">{children}</td>
  ),
  code: DocsInlineCode,
  pre: ({ children }: { children?: ReactNode }) => (
    <pre className="my-2.5 overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-sm leading-6 text-foreground">
      {children}
    </pre>
  ),
};

type ApiIntegrationDocsPanelProps = {
  apiBase: string;
  className?: string;
};

function applyApiBasePlaceholders(content: string, apiBase: string): string {
  const placeholders = [
    "https://YOUR_PROJECT.supabase.co/functions/v1/omnichannel-public-api",
    "https://<project-ref>.supabase.co/functions/v1/omnichannel-public-api",
  ];
  let result = content;
  for (const placeholder of placeholders) {
    result = result.replaceAll(placeholder, apiBase);
  }
  return result;
}

function DocsMarkdownBody({ markdown }: { markdown: string }) {
  if (!markdown.trim()) return null;

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={docsMarkdownComponents}>
      {markdown}
    </ReactMarkdown>
  );
}

export function ApiIntegrationDocsPanel({ apiBase, className }: ApiIntegrationDocsPanelProps) {
  const { t } = useTranslation();

  const markdownBody = useMemo(() => {
    const content = normalizeDocsMarkdown(applyApiBasePlaceholders(apiDocsMarkdown, apiBase));
    return stripHttpAndChecklistSection(content);
  }, [apiBase]);

  return (
    <div className={cn(panelScrollClass, className)}>
      <div
        className={cn(
          "rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 text-muted-foreground",
          docsTextClass,
        )}
      >
        <span className="font-medium text-foreground">
          {t("omnichannel.settings.apiIntegration.docs.baseUrlBanner")}{" "}
        </span>
        <code className="break-all font-mono text-sm leading-6 text-foreground">{apiBase}</code>
      </div>

      <div className="max-w-none pb-4 pt-4 [&_p:empty]:hidden">
        <DocsMarkdownBody markdown={markdownBody} />
        <ApiIntegrationHttpCodesPanel />
      </div>
    </div>
  );
}

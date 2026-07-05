import { ExternalLink } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { FlowBuilderStatusBadge } from "@/5-3-dashboard/omnichannel-settings/components/flow-builder/shared/FlowBuilderStatusBadge";
import type { MetaFormFlowCatalogRow, TemplateCatalogView } from "../types";

type TemplateFormFlowsTableProps = {
  rows: MetaFormFlowCatalogRow[];
  onCreateTemplate?: (flowId: string) => void;
};

function formatDate(d: Date | null): string {
  if (!d) return "—";
  try {
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "—";
  }
}

export function TemplateFormFlowsTable({ rows, onCreateTemplate }: TemplateFormFlowsTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-muted-foreground">
        Belum ada WhatsApp Form Flow di Meta untuk akun ini.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-primary/5 hover:bg-primary/5">
            <TableHead>Flow name</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead>Flow ID</TableHead>
            <TableHead>Linked template</TableHead>
            <TableHead className="w-[160px]">Last updated</TableHead>
            <TableHead className="w-[140px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell>
                <FlowBuilderStatusBadge
                  status={row.status}
                  label={row.status === "ACTIVE" ? "ACTIVE" : row.status === "DRAFT" ? "DRAFT" : "OTHER"}
                />
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{row.id}</TableCell>
              <TableCell className="text-sm">
                {row.linkedTemplateName ? (
                  <span>
                    {row.linkedTemplateName}
                    {!row.canSendViaTemplate ? (
                      <span className="ml-1 text-xs text-amber-600">(belum approved)</span>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Perlu template approved</span>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {formatDate(row.lastUpdatedAt)}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {onCreateTemplate ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => onCreateTemplate(row.id)}
                    >
                      Buat template
                    </Button>
                  ) : null}
                  <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 text-xs" asChild>
                    <a
                      href="https://business.facebook.com/latest/whatsapp_manager/flows"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Manager
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function TemplateCatalogFilterChips({
  value,
  onChange,
  counts,
}: {
  value: TemplateCatalogView;
  onChange: (v: TemplateCatalogView) => void;
  counts: { all: number; messageTemplates: number; formFlows: number; flowTemplates: number };
}) {
  const chips: { id: TemplateCatalogView; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "message_templates", label: "Message Templates", count: counts.messageTemplates },
    { id: "form_flows", label: "Form Flows", count: counts.formFlows },
    { id: "flow_templates", label: "Flow Templates", count: counts.flowTemplates },
  ];

  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => onChange(chip.id)}
          className={
            value === chip.id
              ? "rounded-full border border-brand-blue/40 bg-brand-blue/10 px-3 py-1 text-xs font-medium text-brand-blue"
              : "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
          }
        >
          {chip.label}
          <span className="ml-1 tabular-nums text-muted-foreground">({chip.count})</span>
        </button>
      ))}
    </div>
  );
}

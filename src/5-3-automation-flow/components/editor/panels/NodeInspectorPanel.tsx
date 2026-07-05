import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Switch } from "@/shared/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";
import { SelectTriggerModal } from "@/5-3-automation-flow/components/editor/panels/SelectTriggerModal";
import { ListMessageOptionsEditor } from "@/5-3-automation-flow/components/editor/panels/ListMessageOptionsEditor";
import { QuickReplyButtonsEditor } from "@/5-3-automation-flow/components/editor/panels/QuickReplyButtonsEditor";
import { EndNodeInspectorPanel } from "@/5-3-automation-flow/components/editor/panels/EndNodeInspectorPanel";
import {
  normalizeSendMessageData,
} from "@/5-3-automation-flow/lib/graph/sendMessageData";
import {
  VariableTokenPicker,
  MESSAGE_MAX_LENGTH,
  insertAtCursor,
} from "@/5-3-automation-flow/components/shared/VariableTokenPicker";
import type {
  AutomationFlowGraph,
  AutomationFlowGraphNode,
  AutomationFlowNodeType,
  AssignToMode,
} from "@/5-3-automation-flow/types/automationFlowGraph.types";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useOmnichannelRosterAssignees } from "@/shared/hooks/useOrganizationOmnichannelStaff";
import { useDepartmentsCrud } from "@/shared/hooks/crudMaster/useDepartmentsCrud";

type NodeInspectorPanelProps = {
  graph: AutomationFlowGraph;
  selectedNodeId: string | null;
  whatsAppAccounts: Array<{ phone_number_id: string; display_name: string }>;
  accountsLoading?: boolean;
  accountsError?: Error | null;
  onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void;
};

function findNode(graph: AutomationFlowGraph, id: string | null): AutomationFlowGraphNode | null {
  if (!id) return null;
  return graph.nodes.find((n) => n.id === id) ?? null;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{children}</p>
  );
}

export function NodeInspectorPanel({
  graph,
  selectedNodeId,
  whatsAppAccounts,
  accountsLoading = false,
  accountsError = null,
  onUpdateNode,
}: NodeInspectorPanelProps) {
  const { t } = useTranslation();
  const { organizationId } = useCurrentOrg();
  const { data: employees = [] } = useOmnichannelRosterAssignees();
  const { data: departments = [] } = useDepartmentsCrud(organizationId ?? undefined);
  const node = findNode(graph, selectedNodeId);
  const [triggerModalOpen, setTriggerModalOpen] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const [messageTab, setMessageTab] = useState<"manual" | "template">("manual");

  if (!node) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        {t("omnichannel.automationFlow.editor.selectNodeHint")}
      </div>
    );
  }

  const patch = (data: Record<string, unknown>) => onUpdateNode(node.id, { ...node.data, ...data });

  if (node.type === "start") {
    const phoneNumberIds = (node.data as { phoneNumberIds?: string[] }).phoneNumberIds ?? [];
    const selectedPhoneId = phoneNumberIds[0] ?? "";

    return (
      <>
        <div className="space-y-5">
          <div className="space-y-2">
            <SectionLabel>{t("omnichannel.automationFlow.editor.sectionTrigger")}</SectionLabel>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{t("omnichannel.automationFlow.editor.trigger.incomingMessages")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("omnichannel.automationFlow.editor.trigger.incomingMessagesHint")}
                  </p>
                  <Badge variant="outline" className="mt-2 text-[10px] uppercase">
                    WhatsApp
                  </Badge>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setTriggerModalOpen(true)}>
                  {t("omnichannel.automationFlow.editor.triggerChange")}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <SectionLabel>{t("omnichannel.automationFlow.editor.sectionChannel")}</SectionLabel>
            {accountsLoading ? (
              <Select disabled>
                <SelectTrigger aria-busy="true" aria-label={t("omnichannel.automationFlow.editor.channelLoading")}>
                  <SelectValue placeholder={t("omnichannel.automationFlow.editor.channelPlaceholder")} />
                </SelectTrigger>
              </Select>
            ) : accountsError ? (
              <p className="text-xs text-destructive">{t("omnichannel.automationFlow.editor.channelLoadError")}</p>
            ) : whatsAppAccounts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card p-3 text-xs text-muted-foreground">
                <p>{t("omnichannel.automationFlow.editor.channelEmpty")}</p>
                <Link
                  to="/omnichannel/integrations/whatsapp"
                  className="mt-2 inline-block font-medium text-primary hover:underline"
                >
                  {t("omnichannel.automationFlow.editor.channelEmptyLink")}
                </Link>
              </div>
            ) : (
              <Select
                value={selectedPhoneId || undefined}
                onValueChange={(value) => patch({ phoneNumberIds: value ? [value] : [] })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("omnichannel.automationFlow.editor.channelPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {whatsAppAccounts.map((acc) => (
                    <SelectItem key={acc.phone_number_id} value={acc.phone_number_id}>
                      {acc.display_name || acc.phone_number_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{t("omnichannel.automationFlow.editor.filterByCondition")}</p>
              <Switch checked={false} disabled aria-label={t("omnichannel.automationFlow.editor.filterByCondition")} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("omnichannel.automationFlow.editor.filterByConditionHint")}
            </p>
            <Button type="button" variant="link" className="mt-2 h-auto p-0 text-xs" disabled>
              {t("omnichannel.automationFlow.editor.addCondition")}
            </Button>
          </div>
        </div>

        <SelectTriggerModal
          open={triggerModalOpen}
          onOpenChange={setTriggerModalOpen}
          onSelect={() => patch({ triggerType: "incoming_message_received" })}
        />
      </>
    );
  }

  if (node.type === "action_send_message") {
    const sendData = normalizeSendMessageData(node.data as Record<string, unknown>);
    const body = sendData.body;

    const insertVariable = (token: string) => {
      const el = messageRef.current;
      if (el) {
        const { next, cursor } = insertAtCursor(body, token, el.selectionStart, el.selectionEnd);
        patch({ body: next.slice(0, MESSAGE_MAX_LENGTH) });
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(cursor, cursor);
        });
        return;
      }
      patch({ body: `${body}${token}`.slice(0, MESSAGE_MAX_LENGTH) });
    };

    const handleButtonTypeChange = (value: string) => {
      if (value === "list_message") {
        const options =
          (sendData.listOptions?.length ?? 0) > 0
            ? sendData.listOptions
            : [{ id: `opt-${Date.now()}`, title: "", description: "" }];
        patch({
          buttonType: "list_message",
          buttonAsBranch: true,
          listOptions: options,
          listButtonText: sendData.listButtonText ?? "Pilih Opsi",
        });
        return;
      }
      if (value === "quick_reply") {
        const options =
          (sendData.listOptions?.length ?? 0) > 0
            ? sendData.listOptions
            : [{ id: `opt-${Date.now()}`, title: "" }];
        patch({
          buttonType: "quick_reply",
          buttonAsBranch: true,
          listOptions: options,
          listButtonText: undefined,
          listSectionTitle: undefined,
        });
        return;
      }
      patch({ buttonType: "none", buttonAsBranch: false });
    };

    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <SectionLabel>{t("omnichannel.automationFlow.editor.sectionAction")}</SectionLabel>
          <Select value="action_send_message" disabled>
            <SelectTrigger>
              <SelectValue>{t("omnichannel.automationFlow.editor.nodeType.action_send_message")}</SelectValue>
            </SelectTrigger>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <SectionLabel>{t("omnichannel.automationFlow.editor.sendVia")}</SectionLabel>
            <Badge variant="outline" className="text-[10px] uppercase">
              WhatsApp
            </Badge>
          </div>
          <Select value="incoming_channel" disabled>
            <SelectTrigger>
              <SelectValue>{t("omnichannel.automationFlow.editor.incomingChannel")}</SelectValue>
            </SelectTrigger>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex border-b border-border">
            <button
              type="button"
              disabled
              className="cursor-not-allowed px-3 py-2 text-sm text-muted-foreground opacity-50"
            >
              {t("omnichannel.automationFlow.editor.messageTypeTemplate")}
            </button>
            <button
              type="button"
              className={cn(
                "border-b-2 px-3 py-2 text-sm font-medium",
                messageTab === "manual" ? "border-primary text-primary" : "border-transparent text-muted-foreground",
              )}
              onClick={() => setMessageTab("manual")}
            >
              {t("omnichannel.automationFlow.editor.messageTypeManual")}
            </button>
          </div>

          <Label htmlFor="flow-message-body">{t("omnichannel.automationFlow.editor.messageLabel")}</Label>
          <div className="relative rounded-md border border-border">
            <Textarea
              id="flow-message-body"
              ref={messageRef}
              value={body}
              onChange={(e) => patch({ body: e.target.value.slice(0, MESSAGE_MAX_LENGTH) })}
              rows={8}
              className="min-h-[160px] resize-none border-0 pb-10 focus-visible:ring-0"
              placeholder={t("omnichannel.automationFlow.editor.sendMessagePlaceholder")}
            />
            <div className="absolute bottom-2 left-2 flex items-center gap-1">
              <VariableTokenPicker onInsert={insertVariable} />
            </div>
            <p className="absolute bottom-2 right-2 text-xs text-muted-foreground">
              {body.length}/{MESSAGE_MAX_LENGTH}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">{t("omnichannel.automationFlow.editor.manualMessageWindowHint")}</p>
        </div>

        <div className="space-y-2">
          <Label>{t("omnichannel.automationFlow.editor.buttonLabel")}</Label>
          <Select value={sendData.buttonType} onValueChange={handleButtonTypeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("omnichannel.automationFlow.editor.buttonType.none")}</SelectItem>
              <SelectItem value="list_message">{t("omnichannel.automationFlow.editor.buttonType.listMessage")}</SelectItem>
              <SelectItem value="quick_reply">{t("omnichannel.automationFlow.editor.buttonType.quickReply")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {sendData.buttonType === "list_message" ? (
          <ListMessageOptionsEditor
            listButtonText={sendData.listButtonText ?? ""}
            options={sendData.listOptions ?? []}
            onChange={(listPatch) => patch({ ...listPatch, buttonAsBranch: true })}
          />
        ) : null}

        {sendData.buttonType === "quick_reply" ? (
          <QuickReplyButtonsEditor
            options={sendData.listOptions ?? []}
            onChange={(listPatch) => patch({ ...listPatch, buttonAsBranch: true })}
          />
        ) : null}
      </div>
    );
  }

  if (node.type === "time_delay") {
    const duration = Number((node.data as { duration?: number }).duration ?? 5);
    const unit = String((node.data as { unit?: string }).unit ?? "minutes");
    return (
      <div className="space-y-4 rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">{t("omnichannel.automationFlow.editor.delayTitle")}</h3>
        <div className="flex gap-2">
          <Input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => patch({ duration: Number(e.target.value) })}
          />
          <Select value={unit} onValueChange={(v) => patch({ unit: v })}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minutes">{t("omnichannel.automationFlow.editor.delayMinutes")}</SelectItem>
              <SelectItem value="hours">{t("omnichannel.automationFlow.editor.delayHours")}</SelectItem>
              <SelectItem value="days">{t("omnichannel.automationFlow.editor.delayDays")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  if (node.type === "condition") {
    const rules = (node.data as { rules?: Array<Record<string, string>> }).rules ?? [];
    const matchMode = (node.data as { matchMode?: string }).matchMode ?? "all";
    const firstRule = rules[0] ?? { id: "r1", field: "keyword", operator: "contains", value: "" };
    return (
      <div className="space-y-4 rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">{t("omnichannel.automationFlow.editor.conditionTitle")}</h3>
        <Select value={matchMode} onValueChange={(v) => patch({ matchMode: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("omnichannel.automationFlow.editor.matchAll")}</SelectItem>
            <SelectItem value="any">{t("omnichannel.automationFlow.editor.matchAny")}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={firstRule.field}
          onValueChange={(v) => patch({ rules: [{ ...firstRule, field: v }] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="keyword">{t("omnichannel.automationFlow.editor.fieldKeyword")}</SelectItem>
            <SelectItem value="label">{t("omnichannel.automationFlow.editor.fieldLabel")}</SelectItem>
            <SelectItem value="conversation_status">{t("omnichannel.automationFlow.editor.fieldStatus")}</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={firstRule.value}
          onChange={(e) => patch({ rules: [{ ...firstRule, value: e.target.value }] })}
          placeholder={t("omnichannel.automationFlow.editor.conditionValuePlaceholder")}
        />
      </div>
    );
  }

  if (node.type === "action_wait_reply") {
    return (
      <div className="space-y-4 rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">{t("omnichannel.automationFlow.editor.waitReplyTitle")}</h3>
        <p className="text-xs text-muted-foreground">{t("omnichannel.automationFlow.editor.waitReplyHint")}</p>
        <Input
          value={String((node.data as { saveAsVariable?: string }).saveAsVariable ?? "last_customer_reply")}
          onChange={(e) => patch({ saveAsVariable: e.target.value })}
        />
      </div>
    );
  }

  if (node.type === "action_update_contact") {
    return (
      <div className="space-y-4 rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">{t("omnichannel.automationFlow.editor.updateContactTitle")}</h3>
        <Input
          placeholder={t("omnichannel.automationFlow.editor.categoryPlaceholder")}
          value={String((node.data as { category?: string }).category ?? "")}
          onChange={(e) => patch({ category: e.target.value })}
        />
        <Input
          placeholder={t("omnichannel.automationFlow.editor.servicesPlaceholder")}
          value={String((node.data as { services?: string }).services ?? "")}
          onChange={(e) => patch({ services: e.target.value })}
        />
      </div>
    );
  }

  if (node.type === "action_assign_to") {
    const assignData = node.data as {
      assignMode?: AssignToMode;
      employeeId?: string | null;
      departmentId?: string | null;
    };
    const assignMode = assignData.assignMode ?? "specific_user";
    const employeeId = assignData.employeeId ?? "";
    const departmentId = assignData.departmentId ?? "";

    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <SectionLabel>{t("omnichannel.automationFlow.editor.sectionAction")}</SectionLabel>
          <Select value="action_assign_to" disabled>
            <SelectTrigger>
              <SelectValue>{t("omnichannel.automationFlow.editor.action.assignTo")}</SelectValue>
            </SelectTrigger>
          </Select>
        </div>

        <div className="space-y-2">
          <SectionLabel>{t("omnichannel.automationFlow.editor.assignToLabel")}</SectionLabel>
          <Select
            value={assignMode}
            onValueChange={(value: AssignToMode) =>
              patch({
                assignMode: value,
                employeeId: value === "specific_user" ? employeeId || null : null,
                departmentId: value === "specific_team" ? departmentId || null : null,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">{t("omnichannel.automationFlow.editor.assignMode.unassigned")}</SelectItem>
              <SelectItem value="specific_user">{t("omnichannel.automationFlow.editor.assignMode.specificUser")}</SelectItem>
              <SelectItem value="specific_team">{t("omnichannel.automationFlow.editor.assignMode.specificTeam")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {assignMode === "specific_user" ? (
          <div className="space-y-2">
            <SectionLabel>{t("omnichannel.automationFlow.editor.assignUserLabel")}</SectionLabel>
            <Select
              value={employeeId || undefined}
              onValueChange={(value) => patch({ employeeId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("omnichannel.automationFlow.editor.assignSelectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {employees.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    {t("omnichannel.automationFlow.editor.assignNoStaff")}
                  </SelectItem>
                ) : (
                  employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name || emp.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {assignMode === "specific_team" ? (
          <div className="space-y-2">
            <SectionLabel>{t("omnichannel.automationFlow.editor.assignTeamLabel")}</SectionLabel>
            <Select
              value={departmentId || undefined}
              onValueChange={(value) => patch({ departmentId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("omnichannel.automationFlow.editor.assignSelectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {departments.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    {t("omnichannel.automationFlow.editor.assignNoDepartments")}
                  </SelectItem>
                ) : (
                  departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("omnichannel.automationFlow.editor.assignTeamHint")}</p>
          </div>
        ) : null}
      </div>
    );
  }

  if (node.type === "action_http_request") {
    return (
      <div className="space-y-4 rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">{t("omnichannel.automationFlow.editor.httpTitle")}</h3>
        <Input
          value={String((node.data as { url?: string }).url ?? "")}
          onChange={(e) => patch({ url: e.target.value })}
          placeholder="https://"
        />
        <Textarea
          value={String((node.data as { bodyTemplate?: string }).bodyTemplate ?? "")}
          onChange={(e) => patch({ bodyTemplate: e.target.value })}
          rows={4}
        />
      </div>
    );
  }

  if (node.type === "end") {
    return (
      <EndNodeInspectorPanel graph={graph} node={node} onUpdateNode={onUpdateNode} />
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
      {node.type}
    </div>
  );
}

export function createFlowNode(type: AutomationFlowNodeType, index: number): AutomationFlowGraphNode {
  const id = `${type}-${Date.now()}-${index}`;
  const base = { id, type, position: { x: 0, y: index * 120 }, data: {} as Record<string, unknown> };
  if (type === "start") {
    base.data = { triggerType: "incoming_message_received", phoneNumberIds: [], enrollmentFilters: [] };
  }
  if (type === "condition") {
    base.data = { matchMode: "all", rules: [{ id: "r1", field: "keyword", operator: "contains", value: "" }] };
  }
  if (type === "action_send_message") {
    base.data = {
      body: "",
      buttonType: "none",
      listOptions: [],
      buttonAsBranch: false,
    };
  }
  if (type === "time_delay") base.data = { duration: 5, unit: "minutes" };
  if (type === "action_wait_reply") base.data = { saveAsVariable: "last_customer_reply" };
  if (type === "action_update_contact") base.data = {};
  if (type === "action_assign_to") base.data = { assignMode: "specific_user", employeeId: null, departmentId: null };
  if (type === "action_http_request") base.data = { url: "", method: "POST", bodyTemplate: "{}" };
  return base;
}

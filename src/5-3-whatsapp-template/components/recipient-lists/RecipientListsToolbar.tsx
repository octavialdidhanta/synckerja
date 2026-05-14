import { Search, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

export type RecipientListStatusFilter = "all" | "draft" | "completed" | "processing" | "failed";
export type RecipientListSourceFilter = "all" | "file_upload" | "contacts";

type RecipientListsToolbarProps = {
  search: string;
  onSearchChange: (v: string) => void;
  status: RecipientListStatusFilter;
  onStatusChange: (v: RecipientListStatusFilter) => void;
  source: RecipientListSourceFilter;
  onSourceChange: (v: RecipientListSourceFilter) => void;
  onCreateUploadFile: () => void;
  onCreateSelectContacts: () => void;
};

export function RecipientListsToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  source,
  onSourceChange,
  onCreateUploadFile,
  onCreateSelectContacts,
}: RecipientListsToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex-shrink-0">
      <div className="rounded-md border border-border bg-card p-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative min-w-[150px] flex-1">
            <Search className="absolute right-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
            <Input
              type="text"
              placeholder={t("whatsappTemplates.recipientLists.searchPlaceholder")}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 w-full rounded-md border border-border pl-4 pr-10 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-blue"
            />
          </div>

          <Select value={status} onValueChange={(v) => onStatusChange(v as RecipientListStatusFilter)}>
            <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-36 lg:w-40">
              <SelectValue placeholder={t("whatsappTemplates.recipientLists.filterStatus")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("whatsappTemplates.recipientLists.status.all")}</SelectItem>
              <SelectItem value="draft">{t("whatsappTemplates.recipientLists.status.draft")}</SelectItem>
              <SelectItem value="completed">{t("whatsappTemplates.recipientLists.status.completed")}</SelectItem>
              <SelectItem value="processing">{t("whatsappTemplates.recipientLists.status.processing")}</SelectItem>
              <SelectItem value="failed">{t("whatsappTemplates.recipientLists.status.failed")}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={source} onValueChange={(v) => onSourceChange(v as RecipientListSourceFilter)}>
            <SelectTrigger className="h-9 w-full text-left text-sm text-foreground sm:w-36 lg:w-40">
              <SelectValue placeholder={t("whatsappTemplates.recipientLists.filterSource")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("whatsappTemplates.recipientLists.source.all")}</SelectItem>
              <SelectItem value="file_upload">{t("whatsappTemplates.recipientLists.source.fileUpload")}</SelectItem>
              <SelectItem value="contacts">{t("whatsappTemplates.recipientLists.source.contacts")}</SelectItem>
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="ml-auto h-9 gap-1.5 whitespace-nowrap border-border bg-background text-sm font-normal text-foreground hover:bg-muted/60 sm:ml-0"
              >
                {t("whatsappTemplates.recipientLists.createMenu.trigger")}
                <ChevronDown className="h-4 w-4 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              <DropdownMenuItem className="text-sm" onSelect={onCreateUploadFile}>
                {t("whatsappTemplates.recipientLists.createMenu.uploadFile")}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-sm" onSelect={onCreateSelectContacts}>
                {t("whatsappTemplates.recipientLists.createMenu.selectContacts")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

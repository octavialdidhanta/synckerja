import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Loader2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useToast } from "@/shared/hooks/use-toast";
import { cn } from "@/shared/lib/utils";
import { useCreateRecipientListFromFileUpload } from "@/5-3-whatsapp-template/hooks/useWhatsappRecipientLists";
import {
  parseRecipientImportFile,
  RECIPIENT_IMPORT_MAX_DATA_ROWS,
  RECIPIENT_IMPORT_MAX_FILE_BYTES,
  RECIPIENT_LIST_NAME_MAX_LEN,
} from "@/5-3-whatsapp-template/utils/parseRecipientImportFile";
import { downloadRecipientImportTemplateXls } from "@/5-3-whatsapp-template/utils/downloadRecipientImportTemplate";

const TEMPLATE_PATH = "/templates/whatsapp-recipient-import.csv";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

type ImportRecipientListFileModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null | undefined;
};

export function ImportRecipientListFileModal({ open, onOpenChange, organizationId }: ImportRecipientListFileModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createFromFile = useCreateRecipientListFromFileUpload(organizationId);

  const [step, setStep] = useState(1);
  const [listName, setListName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setListName("");
      setFile(null);
      setIsDragging(false);
    }
  }, [open]);

  const maxMb = Math.round(RECIPIENT_IMPORT_MAX_FILE_BYTES / (1024 * 1024));

  const parseErrorToast = useCallback(
    (code: string) => {
      const key = `whatsappTemplates.recipientLists.import.parseError.${code}`;
      const msg = t(key, {
        mb: maxMb,
        max: RECIPIENT_IMPORT_MAX_DATA_ROWS.toLocaleString(),
      });
      toast({ variant: "destructive", title: t("whatsappTemplates.recipientLists.import.toastError"), description: msg });
    },
    [maxMb, t, toast],
  );

  const onPickFile = useCallback((f: File | null) => {
    if (!f) {
      setFile(null);
      return;
    }
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".csv") && !lower.endsWith(".xls")) {
      toast({
        variant: "destructive",
        title: t("whatsappTemplates.recipientLists.import.toastError"),
        description: t("whatsappTemplates.recipientLists.import.parseError.FILE_TYPE"),
      });
      return;
    }
    if (f.size > RECIPIENT_IMPORT_MAX_FILE_BYTES) {
      toast({
        variant: "destructive",
        title: t("whatsappTemplates.recipientLists.import.toastError"),
        description: t("whatsappTemplates.recipientLists.import.parseError.FILE_TOO_LARGE", { mb: maxMb }),
      });
      return;
    }
    setFile(f);
  }, [maxMb, t, toast]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) onPickFile(f);
    },
    [onPickFile],
  );

  const handleImport = useCallback(async () => {
    if (!file || !organizationId) {
      toast({
        variant: "destructive",
        description: t("whatsappTemplates.recipientLists.import.noFile"),
      });
      return;
    }
    const name = listName.trim();
    if (!name) {
      toast({ variant: "destructive", description: t("whatsappTemplates.recipientLists.import.step1Required") });
      return;
    }

    const parsed = await parseRecipientImportFile(file);
    if (!parsed.ok) {
      parseErrorToast(parsed.code);
      return;
    }
    if (!parsed.validRows.length) {
      toast({
        variant: "destructive",
        description: t("whatsappTemplates.recipientLists.import.noValidRows"),
      });
      return;
    }

    try {
      const result = await createFromFile.mutateAsync({
        name,
        originalFileName: file.name,
        rowCountExpected: parsed.rowCountExpected,
        validRows: parsed.validRows,
        failures: parsed.failures,
      });
      const failedPart =
        result.failed > 0
          ? t("whatsappTemplates.recipientLists.import.toastSuccessFailedPart", { failed: result.failed })
          : "";
      toast({
        title: t("whatsappTemplates.recipientLists.toast.listCreatedTitle"),
        description: t("whatsappTemplates.recipientLists.import.toastSuccess", {
          imported: result.imported,
          failedPart,
        }),
      });
      onOpenChange(false);
      navigate(`/omnichannel/campaign/recipient-lists/${result.listId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "NO_VALID_ROWS") {
        toast({ variant: "destructive", description: t("whatsappTemplates.recipientLists.import.noValidRows") });
        return;
      }
      toast({
        variant: "destructive",
        title: t("whatsappTemplates.recipientLists.import.toastError"),
        description: msg,
      });
    }
  }, [
    createFromFile,
    file,
    listName,
    navigate,
    onOpenChange,
    organizationId,
    parseErrorToast,
    t,
    toast,
  ]);

  const canNextFromStep1 = listName.trim().length > 0;
  const nameLen = listName.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <p className="text-xs font-medium text-brand-blue">{t("whatsappTemplates.recipientLists.import.kicker")}</p>
          <DialogTitle className="text-xl">{t("whatsappTemplates.recipientLists.import.title")}</DialogTitle>
          <p className="text-sm text-muted-foreground">{t("whatsappTemplates.recipientLists.import.subtitle")}</p>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-center gap-2 py-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold",
                step >= s ? "bg-brand-blue text-white" : "bg-muted text-muted-foreground",
              )}
            >
              {s}
            </div>
          ))}
        </div>

        <div className="min-h-[12rem] space-y-4 border-t border-border pt-4">
          {step === 1 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{t("whatsappTemplates.recipientLists.import.step1Title")}</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="import-list-name">{t("whatsappTemplates.recipientLists.import.step1Label")}</Label>
                  <span className="text-xs text-muted-foreground">
                    {nameLen}/{RECIPIENT_LIST_NAME_MAX_LEN}
                  </span>
                </div>
                <Input
                  id="import-list-name"
                  maxLength={RECIPIENT_LIST_NAME_MAX_LEN}
                  placeholder={t("whatsappTemplates.recipientLists.import.step1Placeholder")}
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{t("whatsappTemplates.recipientLists.import.step2Title")}</h3>
              <p className="text-sm text-muted-foreground">{t("whatsappTemplates.recipientLists.import.step2Body")}</p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-brand-blue text-brand-blue hover:bg-brand-blue/10"
                  >
                    {t("whatsappTemplates.recipientLists.import.downloadTemplateTrigger")}
                    <ChevronDown className="ml-1 h-4 w-4 opacity-70" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[12rem]">
                  <DropdownMenuItem className="cursor-pointer p-0 focus:bg-transparent" asChild>
                    <a className="block w-full px-2 py-1.5 text-sm" href={TEMPLATE_PATH} download="whatsapp-recipient-import.csv">
                      {t("whatsappTemplates.recipientLists.import.downloadTemplateCsv")}
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer text-sm"
                    onSelect={() => {
                      setTimeout(() => {
                        try {
                          downloadRecipientImportTemplateXls();
                        } catch {
                          toast({
                            variant: "destructive",
                            title: t("whatsappTemplates.recipientLists.import.toastError"),
                            description: t("whatsappTemplates.recipientLists.import.downloadXlsFailed"),
                          });
                        }
                      }, 0);
                    }}
                  >
                    {t("whatsappTemplates.recipientLists.import.downloadTemplateXls")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{t("whatsappTemplates.recipientLists.import.step3Title")}</h3>
              <p className="text-sm font-medium text-foreground">{t("whatsappTemplates.recipientLists.import.step3Intro")}</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>{t("whatsappTemplates.recipientLists.import.step3Bullet1")}</li>
                <li>{t("whatsappTemplates.recipientLists.import.step3Bullet2")}</li>
                <li>{t("whatsappTemplates.recipientLists.import.step3Bullet3")}</li>
              </ul>
              <p className="text-sm text-muted-foreground">{t("whatsappTemplates.recipientLists.import.step3Footer")}</p>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{t("whatsappTemplates.recipientLists.import.step4Title")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("whatsappTemplates.recipientLists.import.step4LimitRows", {
                  max: RECIPIENT_IMPORT_MAX_DATA_ROWS.toLocaleString(),
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("whatsappTemplates.recipientLists.import.step4LimitSize", { mb: maxMb })}
              </p>
              <div
                role="button"
                tabIndex={0}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-10 transition-colors",
                  isDragging ? "border-brand-blue bg-brand-blue/5" : "border-muted-foreground/30 bg-muted/20 hover:bg-muted/40",
                )}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <Upload className="mb-2 h-10 w-10 text-muted-foreground" aria-hidden />
                <p className="text-center text-sm text-foreground">
                  {t("whatsappTemplates.recipientLists.import.dropHint")}{" "}
                  <span className="font-medium text-brand-blue">{t("whatsappTemplates.recipientLists.import.browse")}</span>
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xls"
                  className="sr-only"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                />
              </div>
              {file ? (
                <p className="text-xs text-muted-foreground">
                  {t("whatsappTemplates.recipientLists.import.selectedFile", {
                    name: file.name,
                    size: formatFileSize(file.size),
                  })}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={createFromFile.isPending}>
            {t("whatsappTemplates.recipientLists.import.cancel")}
          </Button>
          <div className="flex flex-wrap justify-end gap-2">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)} disabled={createFromFile.isPending}>
                {t("whatsappTemplates.recipientLists.import.back")}
              </Button>
            ) : null}
            {step < 4 ? (
              <Button
                type="button"
                onClick={() => setStep((s) => Math.min(4, s + 1))}
                disabled={(step === 1 && !canNextFromStep1) || createFromFile.isPending}
              >
                {t("whatsappTemplates.recipientLists.import.next")}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => void handleImport()}
                disabled={!file || !organizationId || createFromFile.isPending}
              >
                {createFromFile.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    {t("whatsappTemplates.recipientLists.import.submitting")}
                  </>
                ) : (
                  t("whatsappTemplates.recipientLists.import.submit")
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

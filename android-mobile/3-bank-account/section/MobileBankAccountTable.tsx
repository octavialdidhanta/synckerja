import { useEffect, useRef, useState } from "react";
import { Copy, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { BankAccount } from "@/shared/hooks/finance/useBankAccounts";
import { formatBankInstitutionAccountLine } from "@/4-1-dashboard/utils/formatBankInstitutionAccountLine";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

type Props = {
  bankAccounts: BankAccount[];
  onEdit: (bankAccount: BankAccount) => void;
  onDelete: (id: string) => void;
};

export function MobileBankAccountTable({ bankAccounts, onEdit, onDelete }: Props) {
  const { t } = useAppTranslation();
  const [openedId, setOpenedId] = useState<string | null>(null);

  if (bankAccounts.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
        <div className="flex min-h-[10rem] flex-1 items-center justify-center rounded-lg bg-muted/40 px-4 text-center text-xs text-gray-500">
          {t(
            "incomes.noBankAccountsInTable",
            'No bank accounts found. Click "Add Bank Account" to create one.',
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="nested-scroll-touch-chain-xy seamless-scroll flex min-h-0 min-w-0 flex-1 touch-pan-x flex-col overflow-hidden scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="min-h-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto px-3 py-3 scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {bankAccounts.map((bankAccount) => (
        <SwipeBankAccountCard
          key={bankAccount.id}
          bankAccount={bankAccount}
          isOpened={openedId === bankAccount.id}
          onOpen={() => setOpenedId(bankAccount.id)}
          onClose={() => setOpenedId((prev) => (prev === bankAccount.id ? null : prev))}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
      </div>
    </div>
  );
}

const ACTION_STRIP_WIDTH = 96;
const SWIPE_THRESHOLD = 24;
const DIRECTION_LOCK_PX = 8;
const SNAP_TRANSITION = "transform 0.28s ease-in-out";

function SwipeBankAccountCard({
  bankAccount,
  isOpened,
  onOpen,
  onClose,
  onEdit,
  onDelete,
}: {
  bankAccount: BankAccount;
  isOpened: boolean;
  onOpen: () => void;
  onClose: () => void;
  onEdit: (bankAccount: BankAccount) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useAppTranslation();
  const [translateX, setTranslateX] = useState(isOpened ? -ACTION_STRIP_WIDTH : 0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartRef = useRef<{
    startX: number;
    startY: number;
    startTranslateX: number;
    lockHorizontal: boolean | null;
  } | null>(null);
  const translateXRef = useRef(translateX);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (touchStartRef.current) return;
    const next = isOpened ? -ACTION_STRIP_WIDTH : 0;
    setTranslateX(next);
    translateXRef.current = next;
  }, [isOpened]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      startTranslateX: translateXRef.current,
      lockHorizontal: null,
    };
    setIsDragging(true);
    if (cardRef.current) {
      cardRef.current.style.transition = "none";
      cardRef.current.style.transform = `translateX(${translateXRef.current}px)`;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    if (!start) return;
    const deltaX = e.touches[0].clientX - start.startX;
    const deltaY = e.touches[0].clientY - start.startY;
    if (start.lockHorizontal === null) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      if (absX > DIRECTION_LOCK_PX || absY > DIRECTION_LOCK_PX) {
        start.lockHorizontal = absX >= absY;
      }
    }
    if (start.lockHorizontal !== true) return;
    const next = Math.min(0, Math.max(-ACTION_STRIP_WIDTH, start.startTranslateX + deltaX));
    translateXRef.current = next;
    if (cardRef.current) {
      cardRef.current.style.transform = `translateX(${next}px)`;
    }
  };

  const handleTouchEnd = () => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    setIsDragging(false);
    const current = translateXRef.current;
    const wasOpen = (start?.startTranslateX ?? 0) < -SWIPE_THRESHOLD;
    const openNow = current < -SWIPE_THRESHOLD && !wasOpen;
    const stayOpen = current < -SWIPE_THRESHOLD && wasOpen;
    const target = openNow || stayOpen ? -ACTION_STRIP_WIDTH : 0;
    translateXRef.current = target;
    setTranslateX(target);
    if (cardRef.current) {
      cardRef.current.style.transition = SNAP_TRANSITION;
      cardRef.current.style.transform = `translateX(${target}px)`;
    }
    if (target < 0) onOpen();
    else onClose();
  };

  const handleCopy = async () => {
    const bankLabel = bankAccount.bank_name?.trim()
      ? `Bank ${bankAccount.bank_name.trim()}`
      : bankAccount.name?.trim()
        ? `Bank ${bankAccount.name.trim()}`
        : "Bank -";
    const text = `${bankLabel} ${bankAccount.account_number || "-"} a.n ${bankAccount.account_holder || "-"}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("common.copied", "Copied"));
    } catch {
      toast.error(t("common.copyFailed", "Failed to copy"));
    }
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div
        className="absolute inset-y-0 right-0 flex overflow-hidden rounded-r-lg border-l border-slate-300 bg-slate-200"
        style={{ width: ACTION_STRIP_WIDTH }}
      >
        <button
          type="button"
          onClick={() => onEdit(bankAccount)}
          className="flex h-full w-1/2 items-center justify-center bg-blue-300 text-blue-900 transition-colors duration-200 ease-in-out active:bg-blue-400"
          aria-label={t("incomes.editBankAccount", "Edit bank account")}
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(bankAccount.id)}
          className="flex h-full w-1/2 items-center justify-center bg-red-300 text-red-900 transition-colors duration-200 ease-in-out active:bg-red-400"
          aria-label={t("common.delete", "Delete bank account")}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={cardRef}
        className="relative rounded-lg bg-gray-200 p-2.5"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? "none" : SNAP_TRANSITION,
          touchAction: "pan-y",
          willChange: isDragging ? "transform" : undefined,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div className="min-w-0 flex-1 pr-8">
          <p className="truncate text-sm font-semibold text-gray-900">{bankAccount.name}</p>
          <p className="truncate text-xs leading-snug text-gray-700">
            {formatBankInstitutionAccountLine(bankAccount) ?? "—"}
          </p>
          <p className="truncate text-xs text-gray-700">Holder: {bankAccount.account_holder || "-"}</p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded bg-slate-300/95 text-slate-900 transition-colors duration-200 ease-in-out active:bg-slate-400"
          aria-label={t("common.copy", "Copy bank account")}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

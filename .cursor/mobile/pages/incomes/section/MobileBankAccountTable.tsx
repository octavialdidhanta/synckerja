import { useEffect, useRef, useState } from "react";
import { Copy, Edit, Trash2 } from "lucide-react";
import type { BankAccount } from "@/hooks/organized/useBankAccounts";
import { toast } from "sonner";

interface MobileBankAccountTableProps {
  bankAccounts: BankAccount[];
  onEdit: (bankAccount: BankAccount) => void;
  onDelete: (id: string) => void;
}

export function MobileBankAccountTable({ bankAccounts, onEdit, onDelete }: MobileBankAccountTableProps) {
  const [openedId, setOpenedId] = useState<string | null>(null);

  if (bankAccounts.length === 0) {
    return (
      <div className="p-4">
        <div className="h-16 rounded-lg bg-muted/40 flex items-center justify-center text-xs text-gray-500">
          No bank accounts found. Click "Add Bank Account" to create one.
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain-xy max-h-[52vh] px-3 py-3 space-y-2">
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
      toast.success("Copied");
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Solid action background behind card (not transparent) */}
      <div
        className="absolute inset-y-0 right-0 flex rounded-r-lg overflow-hidden border-l border-slate-300 bg-slate-200"
        style={{ width: ACTION_STRIP_WIDTH }}
      >
        <button
          type="button"
          onClick={() => onEdit(bankAccount)}
          className="w-1/2 h-full flex items-center justify-center bg-blue-300 text-blue-900 active:bg-blue-400 transition-colors duration-200 ease-in-out"
          aria-label="Edit bank account"
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(bankAccount.id)}
          className="w-1/2 h-full flex items-center justify-center bg-red-300 text-red-900 active:bg-red-400 transition-colors duration-200 ease-in-out"
          aria-label="Delete bank account"
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
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{bankAccount.name}</p>
          <p className="text-xs text-gray-700 truncate">No. Rek: {bankAccount.account_number || "-"}</p>
          <p className="text-xs text-gray-700 truncate">Bank: {bankAccount.bank_name || "-"}</p>
          <p className="text-xs text-gray-700 truncate">Holder: {bankAccount.account_holder || "-"}</p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="absolute right-2 bottom-2 h-6 w-6 rounded bg-slate-300/95 text-slate-900 flex items-center justify-center active:bg-slate-400 transition-colors duration-200 ease-in-out"
          aria-label="Copy bank account"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

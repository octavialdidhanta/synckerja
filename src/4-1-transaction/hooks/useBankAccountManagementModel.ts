import { useCallback, useState } from "react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useBankAccounts, type BankAccount } from "@/shared/hooks/finance/useBankAccounts";

export type BankAccountFormData = {
  name: string;
  account_number: string;
  bank_name: string;
  account_holder: string;
};

export function useBankAccountManagementModel() {
  const { loading: orgLoading, organizationId } = useCurrentOrg();
  const {
    bankAccounts,
    loading,
    isPending,
    createBankAccount,
    updateBankAccount,
    deleteBankAccount,
  } = useBankAccounts();
  const dataPending = Boolean(organizationId) && (loading || isPending);
  const rawPendingLoad = orgLoading || dataPending;
  const [isEditing, setIsEditing] = useState(false);
  const [editingBankAccount, setEditingBankAccount] = useState<BankAccount | null>(null);
  const [formData, setFormData] = useState<BankAccountFormData>({
    name: "",
    account_number: "",
    bank_name: "",
    account_holder: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const handleAdd = useCallback(() => {
    setFormData({ name: "", account_number: "", bank_name: "", account_holder: "" });
    setEditingBankAccount(null);
    setIsEditing(true);
  }, []);

  const handleEdit = useCallback((bankAccount: BankAccount) => {
    setFormData({
      name: bankAccount.name,
      account_number: bankAccount.account_number || "",
      bank_name: bankAccount.bank_name || "",
      account_holder: bankAccount.account_holder || "",
    });
    setEditingBankAccount(bankAccount);
    setIsEditing(true);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name.trim()) return;

      setSubmitting(true);
      try {
        if (editingBankAccount) {
          await updateBankAccount(editingBankAccount.id, formData);
        } else {
          await createBankAccount(formData);
        }
        setIsEditing(false);
        setFormData({ name: "", account_number: "", bank_name: "", account_holder: "" });
        setEditingBankAccount(null);
      } catch {
        // Errors surfaced via useBankAccounts toasts
      } finally {
        setSubmitting(false);
      }
    },
    [createBankAccount, editingBankAccount, formData, updateBankAccount],
  );

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setFormData({ name: "", account_number: "", bank_name: "", account_holder: "" });
    setEditingBankAccount(null);
  }, []);

  const handleDeleteRequest = useCallback((id: string) => {
    setDeleteTargetId(id);
  }, []);

  const cancelDeleteDialog = useCallback(() => {
    setDeleteTargetId(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTargetId) return;
    try {
      await deleteBankAccount(deleteTargetId);
      setDeleteTargetId(null);
    } catch {
      // Errors surfaced via useBankAccounts
    }
  }, [deleteBankAccount, deleteTargetId]);

  return {
    bankAccounts,
    loading,
    rawPendingLoad,
    isEditing,
    editingBankAccount,
    formData,
    setFormData,
    submitting,
    handleAdd,
    handleEdit,
    handleSubmit,
    handleCancel,
    handleDeleteRequest,
    deleteTargetId,
    cancelDeleteDialog,
    confirmDelete,
  };
}

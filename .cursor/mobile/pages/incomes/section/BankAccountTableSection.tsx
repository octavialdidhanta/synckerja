import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Card, CardContent } from "@/mobile/components/ui/card";
import { Button } from "@/mobile/components/ui/button";
import { Input } from "@/mobile/components/ui/input";
import { Label } from "@/mobile/components/ui/label";
import { useBankAccounts, type BankAccount } from "@/hooks/organized/useBankAccounts";
import { MobileBankAccountTable } from "./MobileBankAccountTable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/mobile/components/ui/alert-dialog";

export function BankAccountTableSection() {
  const { bankAccounts, loading, createBankAccount, updateBankAccount, deleteBankAccount } = useBankAccounts();
  const [isEditing, setIsEditing] = useState(false);
  const [editingBankAccount, setEditingBankAccount] = useState<BankAccount | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    account_number: "",
    bank_name: "",
    account_holder: "",
  });

  const handleAdd = () => {
    setFormData({ name: "", account_number: "", bank_name: "", account_holder: "" });
    setEditingBankAccount(null);
    setIsEditing(true);
  };

  const handleEdit = (bankAccount: BankAccount) => {
    setFormData({
      name: bankAccount.name,
      account_number: bankAccount.account_number || "",
      bank_name: bankAccount.bank_name || "",
      account_holder: bankAccount.account_holder || "",
    });
    setEditingBankAccount(bankAccount);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({ name: "", account_number: "", bank_name: "", account_holder: "" });
    setEditingBankAccount(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setSubmitting(true);
    try {
      if (editingBankAccount) {
        await updateBankAccount(editingBankAccount.id, formData);
      } else {
        await createBankAccount(formData);
      }
      handleCancel();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    await deleteBankAccount(deleteTargetId);
    setDeleteTargetId(null);
  };

  return (
    <div className="px-2 pt-2 pb-2">
      <Card className="w-full min-w-0 border border-border bg-card overflow-hidden">
        <CardContent className="p-0 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50 flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-900">Bank Accounts</h2>
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={handleAdd} className="h-8 px-2 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Bank Account
              </Button>
            ) : null}
          </div>

          {isEditing ? (
            <form onSubmit={handleSubmit} className="p-3 border-b bg-gray-50 space-y-3 flex-shrink-0">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs">Account Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter account name"
                    required
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bank_name" className="text-xs">Bank Name</Label>
                  <Input
                    id="bank_name"
                    value={formData.bank_name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, bank_name: e.target.value }))}
                    placeholder="Enter bank name"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="account_number" className="text-xs">Account Number</Label>
                  <Input
                    id="account_number"
                    value={formData.account_number}
                    onChange={(e) => setFormData((prev) => ({ ...prev, account_number: e.target.value }))}
                    placeholder="Enter account number"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="account_holder" className="text-xs">Account Holder</Label>
                  <Input
                    id="account_holder"
                    value={formData.account_holder}
                    onChange={(e) => setFormData((prev) => ({ ...prev, account_holder: e.target.value }))}
                    placeholder="Enter account holder name"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" className="h-8 text-xs" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      {editingBankAccount ? "Updating..." : "Creating..."}
                    </>
                  ) : editingBankAccount ? (
                    "Update"
                  ) : (
                    "Create"
                  )}
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={handleCancel} disabled={submitting}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center py-8 flex-shrink-0">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="ml-2 text-sm text-gray-500">Loading bank accounts...</span>
            </div>
          ) : (
            <div className="min-h-0 flex-1">
              <MobileBankAccountTable
                bankAccounts={bankAccounts}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent className="z-[100]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bank account?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this bank account? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

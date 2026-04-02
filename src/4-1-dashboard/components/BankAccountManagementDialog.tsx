import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { useBankAccounts, BankAccount } from '@/shared/hooks/finance/useBankAccounts';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';

interface BankAccountManagementDialogProps {
  open: boolean;
  onClose: () => void;
  onBankAccountSelect?: (bankAccountId: string) => void;
  onBankAccountAdded?: () => void;
}

export const BankAccountManagementDialog: React.FC<BankAccountManagementDialogProps> = ({
  open,
  onClose,
  onBankAccountSelect,
  onBankAccountAdded
}) => {
  const { bankAccounts, loading, createBankAccount, updateBankAccount, deleteBankAccount } = useBankAccounts();
  const [isEditing, setIsEditing] = useState(false);
  const [editingBankAccount, setEditingBankAccount] = useState<BankAccount | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    account_number: '', 
    bank_name: '', 
    account_holder: '' 
  });
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = () => {
    setFormData({ name: '', account_number: '', bank_name: '', account_holder: '' });
    setEditingBankAccount(null);
    setIsEditing(true);
  };

  const handleEdit = (bankAccount: BankAccount) => {
    setFormData({ 
      name: bankAccount.name, 
      account_number: bankAccount.account_number || '', 
      bank_name: bankAccount.bank_name || '',
      account_holder: bankAccount.account_holder || ''
    });
    setEditingBankAccount(bankAccount);
    setIsEditing(true);
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
        // Notify parent that a new bank account was added
        if (onBankAccountAdded) {
          onBankAccountAdded();
        }
      }
      setIsEditing(false);
      setFormData({ name: '', account_number: '', bank_name: '', account_holder: '' });
      setEditingBankAccount(null);
    } catch (error) {
      // Error handled in hook
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this bank account?')) {
      await deleteBankAccount(id);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({ name: '', account_number: '', bank_name: '', account_holder: '' });
    setEditingBankAccount(null);
  };

  const handleSelectBankAccount = (bankAccountId: string) => {
    if (onBankAccountSelect) {
      onBankAccountSelect(bankAccountId);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Manage Bank Accounts</span>
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAdd}
                className="ml-2"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Bank Account
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isEditing && (
            <form onSubmit={handleSubmit} className="p-4 border rounded-lg bg-gray-50 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="name">Account Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter account name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_name">Bank Name</Label>
                  <Input
                    id="bank_name"
                    value={formData.bank_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, bank_name: e.target.value }))}
                    placeholder="Enter bank name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="account_number">Account Number</Label>
                  <Input
                    id="account_number"
                    value={formData.account_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, account_number: e.target.value }))}
                    placeholder="Enter account number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account_holder">Account Holder</Label>
                  <Input
                    id="account_holder"
                    value={formData.account_holder}
                    onChange={(e) => setFormData(prev => ({ ...prev, account_holder: e.target.value }))}
                    placeholder="Enter account holder name"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting} size="sm">
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      {editingBankAccount ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    editingBankAccount ? 'Update' : 'Create'
                  )}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleCancel}
                  disabled={submitting}
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading bank accounts...</span>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Bank Name</TableHead>
                    <TableHead>Account Number</TableHead>
                    <TableHead>Account Holder</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bankAccounts.map((bankAccount) => (
                    <TableRow key={bankAccount.id}>
                      <TableCell>
                        <button
                          onClick={() => handleSelectBankAccount(bankAccount.id)}
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left"
                        >
                          {bankAccount.name}
                        </button>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {bankAccount.bank_name || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {bankAccount.account_number || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {bankAccount.account_holder || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(bankAccount)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(bankAccount.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {bankAccounts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-gray-500">
                        No bank accounts found. Click "Add Bank Account" to create one.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

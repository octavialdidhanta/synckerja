import React, { useState } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { useBankAccounts, BankAccount } from '@/shared/hooks/finance/useBankAccounts';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';

export const BankAccountManagement: React.FC = () => {
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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Bank Accounts</h4>
        </div>
        {!isEditing && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAdd}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Bank Account
          </Button>
        )}
      </div>

      {isEditing && (
        <form onSubmit={handleSubmit} className="p-3 border rounded-lg bg-gray-50 space-y-3 flex-shrink-0">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs">Account Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
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
                onChange={(e) => setFormData(prev => ({ ...prev, bank_name: e.target.value }))}
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
                onChange={(e) => setFormData(prev => ({ ...prev, account_number: e.target.value }))}
                placeholder="Enter account number"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account_holder" className="text-xs">Account Holder</Label>
              <Input
                id="account_holder"
                value={formData.account_holder}
                onChange={(e) => setFormData(prev => ({ ...prev, account_holder: e.target.value }))}
                placeholder="Enter account holder name"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting} size="sm" className="h-8 text-xs">
              {submitting ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
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
              className="h-8 text-xs"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8 flex-shrink-0">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="ml-2 text-sm text-gray-500">Loading bank accounts...</span>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="overflow-x-auto overflow-y-auto seamless-scroll nested-scroll-touch-chain min-h-0 flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Bank Name</TableHead>
                  <TableHead className="text-xs">Account Number</TableHead>
                  <TableHead className="text-xs">Account Holder</TableHead>
                  <TableHead className="text-xs w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bankAccounts.map((bankAccount) => (
                  <TableRow key={bankAccount.id}>
                    <TableCell className="text-xs font-medium">
                      {bankAccount.name}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      {bankAccount.bank_name || '-'}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      {bankAccount.account_number || '-'}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      {bankAccount.account_holder || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(bankAccount)}
                          className="h-7 w-7 p-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(bankAccount.id)}
                          className="h-7 w-7 p-0 text-brand-red hover:text-brand-red/90"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {bankAccounts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4 text-xs text-gray-500">
                      No bank accounts found. Click "Add Bank Account" to create one.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};

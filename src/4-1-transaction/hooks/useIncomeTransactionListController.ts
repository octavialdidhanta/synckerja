import { useCallback, useState } from "react";
import { useIncomeTransactions } from "@/4-1-dashboard/hooks";
import type { IncomeTransactionWithRelations } from "@/4-1-dashboard/types";

/**
 * View / edit / delete / add dialog state for income transaction lists (desktop table + mobile sections).
 * Mirrors `IncomeTransactionTable` handlers.
 */
export function useIncomeTransactionListController(onRefresh?: () => void) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<IncomeTransactionWithRelations | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { deleteIncomeTransaction, isDeleting } = useIncomeTransactions();

  const getStatusBadgeVariant = useCallback((status: string) => {
    switch (status) {
      case "completed":
        return "default" as const;
      case "pending":
        return "secondary" as const;
      case "cancelled":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  }, []);

  const handleViewDetails = useCallback((transaction: IncomeTransactionWithRelations) => {
    setSelectedTransaction(transaction);
    setIsViewDialogOpen(true);
  }, []);

  const handleEdit = useCallback((transaction: IncomeTransactionWithRelations) => {
    setSelectedTransaction(transaction);
    setIsEditDialogOpen(true);
  }, []);

  const handleDelete = useCallback((transaction: IncomeTransactionWithRelations) => {
    setSelectedTransaction(transaction);
    setIsDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!selectedTransaction) return;
    deleteIncomeTransaction(selectedTransaction.id, {
      onSuccess: () => {
        setIsDeleteDialogOpen(false);
        setSelectedTransaction(null);
        onRefresh?.();
      },
    });
  }, [deleteIncomeTransaction, onRefresh, selectedTransaction]);

  return {
    getStatusBadgeVariant,
    handleViewDetails,
    handleEdit,
    handleDelete,
    isAddDialogOpen,
    setIsAddDialogOpen,
    selectedTransaction,
    setSelectedTransaction,
    isViewDialogOpen,
    setIsViewDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    confirmDelete,
    isDeleting,
  };
}

export type IncomeTransactionListController = ReturnType<typeof useIncomeTransactionListController>;

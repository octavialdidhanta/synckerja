import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';

/** Owner and Admin may allocate income type, category, and bank account on transactions. */
export function useCanAllocateIncome() {
  const { isOwner, isAdmin } = useCentralizedUserData();
  const canAllocateIncome = isOwner || isAdmin;
  return { canAllocateIncome, isOwner, isAdmin };
}

import { createContext, useContext, type ReactNode } from "react";

const ManageCommentsMobileLayoutContext = createContext(false);

export function ManageCommentsMobileLayoutProvider({ children }: { children: ReactNode }) {
  return (
    <ManageCommentsMobileLayoutContext.Provider value>
      {children}
    </ManageCommentsMobileLayoutContext.Provider>
  );
}

export function useManageCommentsMobileLayout() {
  return useContext(ManageCommentsMobileLayoutContext);
}

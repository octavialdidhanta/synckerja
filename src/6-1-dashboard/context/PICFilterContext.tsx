
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface PICFilterContextType {
  // Digital Marketing filters (for PIC column 4)
  selectedJobPositionId: string | null;
  setSelectedJobPositionId: (id: string | null) => void;
  
  // Creative filters (for PIC Production column 14)
  selectedCreativeJobPositionId: string | null;
  setSelectedCreativeJobPositionId: (id: string | null) => void;
  
  // Filter lock state
  isFilterLocked: boolean;
  setIsFilterLocked: (locked: boolean) => void;
  
  // Reset functions
  resetDigitalMarketingFilter: () => void;
  resetCreativeFilter: () => void;
  resetAllFilters: () => void;
}

const PICFilterContext = createContext<PICFilterContextType | undefined>(undefined);

export const PICFilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedJobPositionId, setSelectedJobPositionId] = useState<string | null>(null);
  const [selectedCreativeJobPositionId, setSelectedCreativeJobPositionId] = useState<string | null>(null);
  const [isFilterLocked, setIsFilterLocked] = useState(false);

  const resetDigitalMarketingFilter = () => {
    if (!isFilterLocked) {
      setSelectedJobPositionId(null);
    }
  };

  const resetCreativeFilter = () => {
    if (!isFilterLocked) {
      setSelectedCreativeJobPositionId(null);
    }
  };

  const resetAllFilters = () => {
    if (!isFilterLocked) {
      setSelectedJobPositionId(null);
      setSelectedCreativeJobPositionId(null);
    }
  };

  return (
    <PICFilterContext.Provider value={{
      selectedJobPositionId,
      setSelectedJobPositionId,
      selectedCreativeJobPositionId,
      setSelectedCreativeJobPositionId,
      isFilterLocked,
      setIsFilterLocked,
      resetDigitalMarketingFilter,
      resetCreativeFilter,
      resetAllFilters
    }}>
      {children}
    </PICFilterContext.Provider>
  );
};

export const usePICFilter = () => {
  const context = useContext(PICFilterContext);
  if (context === undefined) {
    throw new Error('usePICFilter must be used within a PICFilterProvider');
  }
  return context;
};

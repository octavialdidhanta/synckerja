
import { useState, useEffect } from 'react';
import { ContentManager } from '../types/social-media';

export const useCreativeProductionEmployees = () => {
  const [creativeProductionMembers, setCreativeProductionMembers] = useState<ContentManager[]>([]);

  useEffect(() => {
    // Mock data for creative production members
    setCreativeProductionMembers([
      {
        id: '1',
        name: 'Jane Smith',
        pic: 'JS',
        target: 90,
        actual: 85,
        percentage: 94,
        dailyTarget: 3,
        monthlyTarget: 90,
        targetAdjusted: 85,
        progress: 78,
        onTimeRate: 85,
        effectiveRate: 82,
        score: 82
      }
    ]);
  }, []);

  return { creativeProductionMembers };
};


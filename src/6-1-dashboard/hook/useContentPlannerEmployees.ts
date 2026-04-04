import { useState, useEffect } from 'react';
import { ContentManager } from '../types/social-media';

export const useContentPlannerEmployees = () => {
  const [contentPlanners, setContentPlanners] = useState<ContentManager[]>([]);

  useEffect(() => {
    // Mock data for content planners
    setContentPlanners([
      {
        id: '1',
        name: 'John Doe',
        pic: 'JD',
        target: 150,
        actual: 140,
        percentage: 93,
        dailyTarget: 5,
        monthlyTarget: 150,
        targetAdjusted: 140,
        progress: 85,
        onTimeRate: 92,
        effectiveRate: 88,
        score: 87
      }
    ]);
  }, []);

  return { contentPlanners };
};


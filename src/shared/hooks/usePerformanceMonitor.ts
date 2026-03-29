
import { useEffect, useRef } from 'react';

interface PerformanceTimer {
  start: (label: string) => void;
  end: (label: string) => void;
  log: (message: string) => void;
  measure: (label: string, startMark: string, endMark?: string) => void;
}

export const usePerformanceMonitor = (componentName: string): PerformanceTimer => {
  const timers = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    console.log(`🚀 [${componentName}] Component mounted at:`, new Date().toISOString());
    return () => {
      console.log(`🏁 [${componentName}] Component unmounted at:`, new Date().toISOString());
    };
  }, [componentName]);

  const start = (label: string) => {
    const timestamp = performance.now();
    timers.current.set(label, timestamp);
    console.log(`⏱️ [${componentName}] ${label} - START:`, timestamp.toFixed(2), 'ms');
    
    // Also use Performance API marks for more detailed analysis
    performance.mark(`${componentName}-${label}-start`);
  };

  const end = (label: string) => {
    const endTime = performance.now();
    const startTime = timers.current.get(label);
    
    if (startTime) {
      const duration = endTime - startTime;
      console.log(`✅ [${componentName}] ${label} - END:`, endTime.toFixed(2), 'ms', `(Duration: ${duration.toFixed(2)}ms)`);
      timers.current.delete(label);
      
      // Create performance mark and measure
      performance.mark(`${componentName}-${label}-end`);
      try {
        performance.measure(`${componentName}-${label}`, `${componentName}-${label}-start`, `${componentName}-${label}-end`);
      } catch (error) {
        console.warn('Performance measure failed:', error);
      }
    } else {
      console.warn(`⚠️ [${componentName}] No start time found for: ${label}`);
    }
  };

  const log = (message: string) => {
    console.log(`📝 [${componentName}] ${message}`, new Date().toISOString());
  };

  const measure = (label: string, startMark: string, endMark?: string) => {
    try {
      performance.measure(label, startMark, endMark);
      const measures = performance.getEntriesByName(label);
      const lastMeasure = measures[measures.length - 1];
      console.log(`📊 [${componentName}] ${label}:`, lastMeasure.duration.toFixed(2), 'ms');
    } catch (error) {
      console.warn('Performance measure failed:', error);
    }
  };

  return { start, end, log, measure };
};

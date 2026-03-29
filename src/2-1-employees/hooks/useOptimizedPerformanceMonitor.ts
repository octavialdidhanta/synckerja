
import { useEffect, useRef, useCallback } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  mountTime: number;
  updateCount: number;
}

// Enhanced performance monitoring with better memory management
export const useOptimizedPerformanceMonitor = (componentName: string) => {
  const metricsRef = useRef<PerformanceMetrics>({
    renderTime: 0,
    mountTime: 0,
    updateCount: 0,
  });
  
  const startTimeRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(false);

  // Ultra-fast performance measurement with minimal overhead
  const measurePerformance = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
      const now = performance.now();
      
      if (!isMountedRef.current) {
        // First mount
        metricsRef.current.mountTime = now;
        isMountedRef.current = true;
      } else {
        // Update
        metricsRef.current.updateCount++;
      }
      
      if (startTimeRef.current > 0) {
        metricsRef.current.renderTime = now - startTimeRef.current;
        
        // Only log slow renders to reduce console noise
        if (metricsRef.current.renderTime > 50) { // Increased threshold to 50ms
          console.warn(`⚠️ ${componentName} SLOW RENDER: ${metricsRef.current.renderTime.toFixed(2)}ms`);
        }
      }
    }
  }, [componentName]);

  useEffect(() => {
    startTimeRef.current = performance.now();
    
    // Use requestAnimationFrame for more accurate measurement
    const rafId = requestAnimationFrame(() => {
      measurePerformance();
    });
    
    return () => {
      cancelAnimationFrame(rafId);
    };
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`📊 ${componentName} Final Stats:`, {
          totalUpdates: metricsRef.current.updateCount,
          avgRenderTime: `${metricsRef.current.renderTime.toFixed(2)}ms`,
          lifespan: `${(performance.now() - metricsRef.current.mountTime).toFixed(2)}ms`
        });
      }
    };
  }, [componentName]);

  return metricsRef.current;
};

// Enhanced query configuration with better performance
export const createOptimizedQueryConfig = () => ({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 15 * 60 * 1000, // 15 minutes
      retry: (failureCount: number, error: any) => {
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 2; // Reduced retries for better UX
      },
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 10000),
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: false,
      // Enhanced performance settings
      networkMode: 'online' as const,
      notifyOnChangeProps: ['data', 'error', 'isLoading'] as const,
    },
    mutations: {
      retry: 1,
      networkMode: 'online' as const,
      gcTime: 5 * 60 * 1000, // 5 minutes for mutations
    },
  },
});

// Memory usage monitor for development
export const useMemoryMonitor = (componentName: string) => {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && 'memory' in performance) {
      const checkMemory = () => {
        const memory = (performance as any).memory;
        if (memory.usedJSHeapSize > 50 * 1024 * 1024) { // 50MB threshold
          console.warn(`🧠 ${componentName} High Memory Usage:`, {
            used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
            total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
            limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`
          });
        }
      };
      
      const intervalId = setInterval(checkMemory, 10000); // Check every 10s
      return () => clearInterval(intervalId);
    }
  }, [componentName]);
};

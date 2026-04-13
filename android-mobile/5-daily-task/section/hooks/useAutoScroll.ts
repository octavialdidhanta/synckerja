import { useEffect, useRef } from 'react';

const HEADER_HEIGHT = 80;

interface UseAutoScrollProps {
  highlightedTaskId: string | null;
}

/**
 * Custom hook for auto-scrolling to highlighted task
 */
export const useAutoScroll = ({ highlightedTaskId }: UseAutoScrollProps) => {
  const taskRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    if (highlightedTaskId && taskRefs.current[highlightedTaskId]) {
      const taskElement = taskRefs.current[highlightedTaskId];
      
      if (taskElement) {
        // Add a small delay to ensure the DOM has updated
        setTimeout(() => {
          const taskRect = taskElement.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          
          // Check if task is visible in the viewport (accounting for header)
          const isVisible = taskRect.top >= HEADER_HEIGHT && 
                           taskRect.bottom <= viewportHeight;
          
          if (!isVisible) {
            // Calculate scroll position to center the task in viewport
            const scrollTop = window.pageYOffset + 
                            (taskRect.top - HEADER_HEIGHT) - 
                            ((viewportHeight - HEADER_HEIGHT) / 2) + 
                            (taskRect.height / 2);
            
            window.scrollTo({
              top: Math.max(0, scrollTop),
              behavior: 'smooth'
            });
          }
        }, 150);
      }
    }
  }, [highlightedTaskId]);

  return { taskRefs };
};


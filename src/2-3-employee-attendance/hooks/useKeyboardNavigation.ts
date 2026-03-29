import { useCallback, useEffect, useRef } from 'react';

interface KeyboardNavigationItem {
  id: string;
}

interface KeyboardNavigationOptions<T extends KeyboardNavigationItem> {
  data: T[];
  selectedRows: string[];
  expandedRows: string[];
  onToggleSelection: (id: string) => void;
  onToggleExpansion: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onExport: () => void;
  onBulkAction: () => void;
}

interface KeyboardShortcutDescription {
  key: string;
  description: string;
}

export const useKeyboardNavigation = <T extends KeyboardNavigationItem>(
  options: KeyboardNavigationOptions<T>
) => {
  const {
    data,
    selectedRows,
    onToggleSelection,
    onToggleExpansion,
    onSelectAll,
    onDeselectAll,
    onExport,
    onBulkAction,
  } = options;

  const activeIndexRef = useRef<number>(0);
  const tableRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedRows.length > 0) {
      const firstSelectedId = selectedRows[0];
      const index = data.findIndex((item) => item.id === firstSelectedId);
      if (index >= 0) {
        activeIndexRef.current = index;
      }
    }
  }, [data, selectedRows]);

  useEffect(() => {
    const node = tableRef.current;
    if (!node) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (data.length === 0) return;

      const focusRow = (index: number, shouldToggle = true) => {
        const clampedIndex = Math.max(0, Math.min(data.length - 1, index));
        activeIndexRef.current = clampedIndex;

        if (shouldToggle) {
          onDeselectAll();
          const target = data[clampedIndex];
          if (target) {
            onToggleSelection(target.id);
          }
        }
      };

      if (event.ctrlKey && (event.key === 'a' || event.key === 'A')) {
        event.preventDefault();
        onSelectAll();
        return;
      }

      if (event.ctrlKey && (event.key === 'e' || event.key === 'E')) {
        event.preventDefault();
        onExport();
        return;
      }

      if (event.ctrlKey && (event.key === 'b' || event.key === 'B')) {
        event.preventDefault();
        onBulkAction();
        return;
      }

      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault();
          focusRow(activeIndexRef.current + 1);
          break;
        }
        case 'ArrowUp': {
          event.preventDefault();
          focusRow(activeIndexRef.current - 1);
          break;
        }
        case 'Home': {
          event.preventDefault();
          focusRow(0);
          break;
        }
        case 'End': {
          event.preventDefault();
          focusRow(data.length - 1);
          break;
        }
        case ' ': // Space
        case 'Spacebar': {
          event.preventDefault();
          const current = data[activeIndexRef.current];
          if (current) {
            onToggleSelection(current.id);
          }
          break;
        }
        case 'Enter': {
          event.preventDefault();
          const current = data[activeIndexRef.current];
          if (current) {
            onToggleExpansion(current.id);
          }
          break;
        }
        case 'Escape': {
          onDeselectAll();
          break;
        }
        default:
          break;
      }
    };

    node.addEventListener('keydown', handleKeyDown);
    return () => {
      node.removeEventListener('keydown', handleKeyDown);
    };
  }, [data, onBulkAction, onDeselectAll, onExport, onSelectAll, onToggleExpansion, onToggleSelection]);

  const getKeyboardShortcuts = useCallback((): KeyboardShortcutDescription[] => [
    { key: '↑/↓', description: 'Navigate rows' },
    { key: 'Home/End', description: 'Jump to first/last row' },
    { key: 'Space', description: 'Toggle row selection' },
    { key: 'Enter', description: 'Expand or collapse row' },
    { key: 'Ctrl+A', description: 'Select all rows' },
    { key: 'Ctrl+B', description: 'Run bulk action' },
    { key: 'Ctrl+E', description: 'Export data' },
    { key: 'Esc', description: 'Clear selection' },
  ], []);

  return {
    tableRef,
    getKeyboardShortcuts,
  };
};



































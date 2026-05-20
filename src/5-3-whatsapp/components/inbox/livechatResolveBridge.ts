import { useEffect, useState, useSyncExternalStore } from 'react';

export type LivechatResolveActionsSnapshot = {
  conversationId: string;
  resolveButtonLabel: string;
  resolveButtonDisabled: boolean;
  isResolved: boolean;
  sessionLockedTitle: string | null;
  handleResolveClick: () => void;
};

let snapshot: LivechatResolveActionsSnapshot | null = null;
const listeners = new Set<() => void>();

export function setLivechatResolveActions(next: LivechatResolveActionsSnapshot | null) {
  snapshot = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

/** Resolve actions published by `LivechatQuickActionPanel` (header button on desktop). */
export function useLivechatResolveActionsBridge(): LivechatResolveActionsSnapshot | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Publish resolve actions while the quick-action panel is mounted. */
export function usePublishLivechatResolveActions(
  actions: LivechatResolveActionsSnapshot | null,
) {
  useEffect(() => {
    setLivechatResolveActions(actions);
    return () => setLivechatResolveActions(null);
  }, [actions]);
}

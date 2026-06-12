import { useCallback, useMemo, useSyncExternalStore } from "react";

import {

  bumpPostInboundHighlight,

  dismissPostInboundHighlight,

  getManageCommentsInboundHighlightsVersion,

  getPostHighlightStoreView,

  subscribeManageCommentsInboundHighlights,

} from "@/6-0-social-media-manage-comments/lib/manageCommentsInboundHighlightStore";



/**

 * Reads post highlight state from the local store mirror (hydrated from server).

 * Detection and persistence are handled by useManageCommentsInboxState.

 */

export function useNewInboundPostHighlights(

  selectedPostId: string | null,

  openId?: string | null,

) {

  const accountOpenId = openId?.trim() ?? "";



  const version = useSyncExternalStore(

    subscribeManageCommentsInboundHighlights,

    getManageCommentsInboundHighlightsVersion,

    getManageCommentsInboundHighlightsVersion,

  );



  const storeView = useMemo(

    () => getPostHighlightStoreView(accountOpenId),

    [accountOpenId, version],

  );



  const dismissPostHighlight = useCallback(

    (postId: string) => {

      if (!accountOpenId) return;

      dismissPostInboundHighlight(accountOpenId, postId);

    },

    [accountOpenId],

  );



  const markPostWithNewActivity = useCallback(

    (postId: string) => {

      if (!accountOpenId || !postId) return;

      bumpPostInboundHighlight(accountOpenId, postId, postId !== selectedPostId);

    },

    [accountOpenId, selectedPostId],

  );



  return {

    pinnedPostIds: storeView.pinnedPostIds,

    highlightedPostIds: storeView.highlightedPostIds,

    pinnedAtMs: storeView.pinnedAtMs,

    pinnedAtVersion: storeView.version,

    markPostWithNewActivity,

    dismissPostHighlight,

  };

}


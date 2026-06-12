import { useCallback, useMemo, useSyncExternalStore } from "react";

import {

  dismissCommentInboundHighlight,

  removeCommentFromHighlightStore,

  getCommentHighlightStoreView,

  getManageCommentsInboundHighlightsVersion,

  subscribeManageCommentsInboundHighlights,

} from "@/6-0-social-media-manage-comments/lib/manageCommentsInboundHighlightStore";



/**

 * Reads comment highlight state from the local store mirror (hydrated from server).

 * Inbound detection is handled by useSyncManageCommentsInboundComments.

 */

export function useNewInboundCommentHighlights(

  openId: string,

  videoId: string | null,

) {

  const accountOpenId = openId.trim();

  const activeVideoId = videoId?.trim() ?? "";



  const version = useSyncExternalStore(

    subscribeManageCommentsInboundHighlights,

    getManageCommentsInboundHighlightsVersion,

    getManageCommentsInboundHighlightsVersion,

  );



  const storeView = useMemo(

    () => getCommentHighlightStoreView(accountOpenId, activeVideoId),

    [accountOpenId, activeVideoId, version],

  );



  const dismissHighlight = useCallback(

    (commentId: string) => {

      if (!activeVideoId || !accountOpenId) return;

      dismissCommentInboundHighlight(accountOpenId, activeVideoId, commentId);

    },

    [accountOpenId, activeVideoId],

  );

  const removeComment = useCallback(

    (commentId: string) => {

      if (!activeVideoId || !accountOpenId) return;

      removeCommentFromHighlightStore(accountOpenId, activeVideoId, commentId);

    },

    [accountOpenId, activeVideoId],

  );



  return {

    pinnedIds: storeView.pinnedCommentIds,

    highlightedIds: storeView.highlightedCommentIds,

    dismissHighlight,

    removeComment,

  };

}


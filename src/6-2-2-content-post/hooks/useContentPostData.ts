import { useMemo } from "react";
import { useContentPosts } from "@/shared/hooks/content-post/useContentPosts";
import { useContentPostMilestones } from "@/shared/hooks/content-post/useContentPostMilestones";
import { useContentPostPerformance } from "@/shared/hooks/content-post/useContentPostPerformance";

export const useContentPostData = () => {
  const {
    contentPosts,
    assignments,
    isPending: postsAssignmentsPending,
    isLoading: basePostsLoading,
    ...restFromPosts
  } = useContentPosts();
  const postIds = useMemo(() => contentPosts.map((post) => post.id), [contentPosts]);
  const {
    milestonesByPost,
    getMilestonesForPost,
    isLoading: isMilestonesLoading,
    awaitingInitialFetch: milestonesAwaiting,
  } = useContentPostMilestones(postIds);
  const {
    metricsByPostId,
    conversionByPostId,
    isLoading: isPerformanceLoading,
    awaitingInitialFetch: performanceAwaiting,
  } = useContentPostPerformance(postIds);

  /** `awaitingInitialFetch` memakai `status === 'pending'` agar tidak ada frame kosong antara selesai posts dan mulai milestones/performance. */
  const isPending = postsAssignmentsPending || milestonesAwaiting || performanceAwaiting;

  return {
    contentPosts,
    assignments,
    milestonesByPost,
    getMilestonesForPost,
    metricsByPostId,
    conversionByPostId,
    isLoading: basePostsLoading || isMilestonesLoading || isPerformanceLoading,
    isPending,
    ...restFromPosts,
  };
};

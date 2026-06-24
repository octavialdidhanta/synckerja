import { parseYouTubeOAuthScopes } from "../youtubeContentAuth.ts";

export function youtubeContentScopesIncludeDelete(scopes: unknown): boolean {
  const list = parseYouTubeOAuthScopes(scopes);
  return list.some(
    (scope) =>
      scope.includes("youtube.force-ssl")
      || scope === "https://www.googleapis.com/auth/youtube",
  );
}

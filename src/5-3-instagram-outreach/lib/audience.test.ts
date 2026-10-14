import { describe, expect, it } from "vitest";
import {
  applyManualPaste,
  collectDiscoveredComments,
  interpolateOutreachBody,
  jakartaDayStartIso,
  mergeDiscoveredComments,
  normalizeInstagramUsername,
  parseManualUsernames,
  type ExistingAudienceRow,
} from "@/5-3-instagram-outreach/lib/audience";

describe("normalizeInstagramUsername", () => {
  it("strips @ and lowercases a valid handle", () => {
    expect(normalizeInstagramUsername("  @Sate.Sultan ")).toBe("sate.sultan");
  });

  it("rejects spaces, one-character names, and empty input", () => {
    expect(normalizeInstagramUsername("@a")).toBeNull();
    expect(normalizeInstagramUsername("has space")).toBeNull();
    expect(normalizeInstagramUsername("")).toBeNull();
  });
});

describe("parseManualUsernames", () => {
  it("splits separators, drops duplicates, and reports invalid tokens", () => {
    const parsed = parseManualUsernames("@Alpha, beta\n@alpha; x; @ok_1 bad!name");
    expect(parsed.valid).toEqual(["alpha", "beta", "ok_1"]);
    expect(parsed.invalid).toEqual(["x", "bad!name"]);
  });
});

describe("interpolateOutreachBody", () => {
  it("replaces every {username} token", () => {
    expect(interpolateOutreachBody("Hai {username}, dari {username}.", "sultan")).toBe(
      "Hai @sultan, dari @sultan.",
    );
  });
});

describe("collectDiscoveredComments", () => {
  it("skips blank usernames and the competitor, keeps the newer comment, and stops at the cap", () => {
    const collected = collectDiscoveredComments({
      competitorUsername: "@resto.lawan",
      maxComments: 4,
      media: [
        {
          permalink: "https://instagram.com/p/old",
          like_count: 10,
          comments: {
            data: [
              { id: "1", username: "", text: "no name", timestamp: "2026-01-01T00:00:00+0000" },
              { id: "2", username: "@Resto.Lawan", text: "owner", timestamp: "2026-01-02T00:00:00+0000" },
              { id: "3", username: "@Tamu", text: "lama", timestamp: "2026-01-03T00:00:00+0000" },
            ],
          },
        },
        {
          permalink: "https://instagram.com/p/new",
          like_count: 4,
          comments: {
            data: [
              { id: "4", username: "tamu", text: "baru", timestamp: "2026-02-01T00:00:00+0000" },
              { id: "5", username: "lain", text: "melewati batas", timestamp: "2026-02-02T00:00:00+0000" },
            ],
          },
        },
      ],
    });

    expect(collected.commentsSeen).toBe(4);
    expect(collected.skippedNoUsername).toBe(1);
    expect(collected.postsScanned).toBe(2);
    expect(collected.likeCountTotal).toBe(14);
    expect(collected.comments).toEqual([
      {
        username: "tamu",
        commentText: "baru",
        commentId: "4",
        mediaPermalink: "https://instagram.com/p/new",
        commentedAt: "2026-02-01T00:00:00+0000",
      },
    ]);
  });
});

describe("mergeDiscoveredComments", () => {
  it("inserts a new commenter and keeps status plus manual source on an existing row", () => {
    const existing: ExistingAudienceRow[] = [
      {
        username: "manual.user",
        source: "manual",
        manualKind: "like",
        status: "copied",
        commentText: null,
        commentId: null,
        mediaPermalink: null,
      },
    ];
    const changes = mergeDiscoveredComments(existing, [
      {
        username: "manual.user",
        commentText: "komen baru",
        commentId: "c1",
        mediaPermalink: "https://instagram.com/p/1",
        commentedAt: "2026-03-01T00:00:00+0000",
      },
      {
        username: "baru",
        commentText: "halo",
        commentId: "c2",
        mediaPermalink: "https://instagram.com/p/2",
        commentedAt: null,
      },
    ]);

    expect(changes).toEqual([
      {
        action: "update",
        username: "manual.user",
        source: "manual",
        manualKind: "like",
        status: "copied",
        commentText: "komen baru",
        commentId: "c1",
        mediaPermalink: "https://instagram.com/p/1",
      },
      {
        action: "insert",
        username: "baru",
        source: "comment",
        manualKind: null,
        status: "new",
        commentText: "halo",
        commentId: "c2",
        mediaPermalink: "https://instagram.com/p/2",
      },
    ]);
  });
});

describe("applyManualPaste", () => {
  it("keeps a comment row as comment and records the pasted kind", () => {
    const next = applyManualPaste({
      username: "tamu",
      manualKind: "repost",
      existing: {
        username: "tamu",
        source: "comment",
        manualKind: null,
        status: "sent",
        commentText: "halo",
        commentId: "c1",
        mediaPermalink: null,
      },
    });
    expect(next).toEqual({
      action: "update",
      username: "tamu",
      source: "comment",
      manualKind: "repost",
      status: "sent",
    });
  });

  it("inserts a manual row when the username is new", () => {
    expect(applyManualPaste({
      username: "baru",
      manualKind: "like",
      existing: null,
    })).toEqual({
      action: "insert",
      username: "baru",
      source: "manual",
      manualKind: "like",
      status: "new",
    });
  });
});

describe("jakartaDayStartIso", () => {
  it("uses the Asia/Jakarta calendar day", () => {
    expect(jakartaDayStartIso(new Date("2026-10-14T16:30:00.000Z"))).toBe("2026-10-13T17:00:00.000Z");
    expect(jakartaDayStartIso(new Date("2026-10-14T17:30:00.000Z"))).toBe("2026-10-14T17:00:00.000Z");
  });
});

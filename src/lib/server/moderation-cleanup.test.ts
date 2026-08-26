import { describe, expect, it, vi } from "vitest";

import {
  drainClaimedModerationJobs,
  isModerationStoragePath,
} from "@/lib/server/moderation-cleanup";

const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("moderation storage cleanup", () => {
  it("accepts only owner-scoped object keys", () => {
    expect(isModerationStoragePath(`${owner}/avatar.png`)).toBe(true);
    expect(isModerationStoragePath(`${owner}/../avatar.png`)).toBe(false);
    expect(isModerationStoragePath(`not-a-user/avatar.png`)).toBe(false);
  });

  it("groups idempotent provider deletes by bucket and completes receipts", async () => {
    const remove = vi.fn(async () => ({}));
    const finish = vi.fn(async () => ({ dead: 0 }));
    const result = await drainClaimedModerationJobs([
      { id: "1", bucket: "avatars", objectPath: `${owner}/avatar.png`, attemptCount: 1 },
      { id: "2", bucket: "delivery-share", objectPath: `${owner}/take/share.mp4`, attemptCount: 1 },
    ], { remove, finish });
    expect(result).toEqual({ completed: 2, retrying: 0, dead: 0 });
    expect(remove).toHaveBeenCalledTimes(2);
    expect(finish).toHaveBeenCalledWith(["1"], true, undefined);
    expect(finish).toHaveBeenCalledWith(["2"], true, undefined);
  });

  it("records provider failure for retry instead of losing the cleanup task", async () => {
    const finish = vi.fn(async () => ({ dead: 0 }));
    const result = await drainClaimedModerationJobs([
      { id: "1", bucket: "avatars", objectPath: `${owner}/avatar.png`, attemptCount: 1 },
    ], {
      remove: async () => ({ error: new Error("offline") }),
      finish,
    });
    expect(result).toEqual({ completed: 0, retrying: 1, dead: 0 });
    expect(finish).toHaveBeenCalledWith(["1"], false, "STORAGE_REMOVE_FAILED");
  });
});

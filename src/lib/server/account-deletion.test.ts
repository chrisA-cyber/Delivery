import { describe, expect, it, vi } from "vitest";

import {
  deleteAllDeliveryMedia,
  isOwnerStoragePath,
  isStripeResourceMissing,
  safeDeletionErrorCode,
} from "@/lib/server/account-deletion";

const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("account deletion media cleanup", () => {
  it("keyset-paginates every delivery and keeps provider deletes at 100 objects", async () => {
    const rows = Array.from({ length: 1_205 }, (_, index) => {
      const id = String(index + 1).padStart(8, "0");
      return {
        id,
        recording_path: `${ownerId}/${id}.wav`,
        share_asset_path: `${ownerId}/${id}/share.mp4`,
      };
    });
    const cursors: Array<string | null> = [];
    const calls: Array<{ bucket: string; paths: string[] }> = [];

    const result = await deleteAllDeliveryMedia({
      ownerId,
      loadPage: async (afterId, limit) => {
        cursors.push(afterId);
        const start = afterId ? rows.findIndex((row) => row.id === afterId) + 1 : 0;
        return { rows: rows.slice(start, start + limit) };
      },
      remove: async (bucket, paths) => {
        calls.push({ bucket, paths });
        return {};
      },
    });

    expect(cursors).toEqual([null, "00000500", "00001000"]);
    expect(result).toEqual({ rowsVisited: 1_205, objectsRequested: 2_410 });
    expect(calls.every((call) => call.paths.length > 0 && call.paths.length <= 100)).toBe(true);
    expect(calls.filter((call) => call.bucket === "delivery-audio").flatMap((call) => call.paths)).toHaveLength(1_205);
    expect(calls.filter((call) => call.bucket === "delivery-share").flatMap((call) => call.paths)).toHaveLength(1_205);
  });

  it("fails closed instead of skipping a foreign or traversal path", async () => {
    const remove = vi.fn(async () => ({}));
    await expect(deleteAllDeliveryMedia({
      ownerId,
      loadPage: async () => ({
        rows: [{ id: "00000001", recording_path: `${ownerId}/../other.wav` }],
      }),
      remove,
    })).rejects.toMatchObject({ code: "ACCOUNT_MEDIA_PATH_INVALID", status: 503 });
    expect(remove).not.toHaveBeenCalled();
  });

  it("propagates storage failures so identity deletion cannot run early", async () => {
    await expect(deleteAllDeliveryMedia({
      ownerId,
      loadPage: async () => ({
        rows: [{ id: "00000001", recording_path: `${ownerId}/take.wav` }],
      }),
      remove: async () => ({ error: new Error("offline") }),
    })).rejects.toMatchObject({ code: "SUPABASE ACCOUNT MEDIA DELETION_UNAVAILABLE" });
  });
});

describe("account deletion provider helpers", () => {
  it("accepts only owner-prefixed, traversal-free storage keys", () => {
    expect(isOwnerStoragePath(`${ownerId}/take.wav`, ownerId)).toBe(true);
    expect(isOwnerStoragePath(`bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/take.wav`, ownerId)).toBe(false);
    expect(isOwnerStoragePath(`${ownerId}/folder//take.wav`, ownerId)).toBe(false);
    expect(isOwnerStoragePath(`${ownerId}/folder\\take.wav`, ownerId)).toBe(false);
  });

  it("treats Stripe's already-deleted response as idempotent", () => {
    expect(isStripeResourceMissing({ code: "resource_missing" })).toBe(true);
    expect(isStripeResourceMissing({ statusCode: 404 })).toBe(true);
    expect(isStripeResourceMissing({ code: "rate_limit" })).toBe(false);
  });

  it("stores only bounded error classes in the durable saga", () => {
    expect(safeDeletionErrorCode(new TypeError("secret provider body"))).toBe("TypeError");
    expect(safeDeletionErrorCode("secret provider body")).toBe("PROVIDER_FAILURE");
  });
});

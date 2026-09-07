// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ redis: vi.fn() }));
vi.mock("@/lib/server/redis", () => ({ redisCommand: mocks.redis }));
import { createRoom } from "@/lib/roast/engine";
import { roastWorkerAlive, withRoastLease, type StoredRoastRoom } from "@/lib/server/roast-store";

const room = (): StoredRoastRoom => ({
  state: createRoom({ id: "main", visibility: "public", name: "Stage", host: { id: "host", name: "Host", signedIn: true, adultAcknowledged: true } }, Date.now()),
  owners: { host: { ownerKey: "user:host", userId: "host" } }, inviteHash: null,
  mediaRoom: "media-main", mediaCreated: true, archivedResults: [], creationKey: "created", updatedAt: Date.now(),
});
beforeEach(() => { vi.clearAllMocks(); });

describe("Roast distributed write lease", () => {
  it("refuses a competing writer while a request owns the global room lease", async () => {
    mocks.redis.mockResolvedValueOnce("OK").mockResolvedValueOnce(null).mockResolvedValueOnce(1);
    let release!: () => void;
    const held = withRoastLease(async () => await new Promise<void>((resolve) => { release = resolve; }));
    await Promise.resolve();
    const competitor = vi.fn();
    await expect(withRoastLease(competitor)).rejects.toMatchObject({ code: "ROAST_BUSY", status: 409 });
    expect(competitor).not.toHaveBeenCalled();
    release(); await held;
  });

  it("permanently fences an expired holder before another save or media assertion", async () => {
    mocks.redis.mockResolvedValueOnce("OK").mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    await withRoastLease(async (lease) => {
      await expect(lease.assert()).rejects.toMatchObject({ code: "ROAST_BUSY" });
      const count = mocks.redis.mock.calls.length;
      await expect(lease.save(room())).rejects.toMatchObject({ code: "ROAST_BUSY" });
      expect(mocks.redis).toHaveBeenCalledTimes(count);
    });
  });

  it("does not accept a failed atomic write and releases the lease after callback errors", async () => {
    mocks.redis.mockResolvedValueOnce("OK").mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    await expect(withRoastLease(async (lease) => { await lease.save(room()); })).rejects.toMatchObject({ code: "ROAST_BUSY" });
    expect(mocks.redis).toHaveBeenCalledTimes(3);
    expect(mocks.redis.mock.calls[2]?.[0]?.[0]).toBe("EVAL");
    mocks.redis.mockReset();
    mocks.redis.mockResolvedValueOnce("OK").mockResolvedValueOnce(1);
    await expect(withRoastLease(async () => { throw new Error("callback failed"); })).rejects.toThrow("callback failed");
    expect(mocks.redis).toHaveBeenCalledTimes(2);
  });

  it("does not replace the original callback failure when Redis release fails", async () => {
    mocks.redis.mockResolvedValueOnce("OK").mockRejectedValueOnce(new Error("release offline"));
    await expect(withRoastLease(async () => { throw new Error("original failure"); })).rejects.toThrow("original failure");
  });

  it("treats absent, malformed and expired worker heartbeats as unavailable", async () => {
    for (const value of [null, "unreadable", String(Date.now() - 13_000)]) {
      mocks.redis.mockResolvedValueOnce(value);
      expect(await roastWorkerAlive()).toBe(false);
    }
    mocks.redis.mockResolvedValueOnce(String(Date.now()));
    expect(await roastWorkerAlive()).toBe(true);
  });
});

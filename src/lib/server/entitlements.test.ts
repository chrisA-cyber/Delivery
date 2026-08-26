import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/server/api-error";
import { releaseJudgedPlay, reserveJudgedPlay } from "@/lib/server/entitlements";

function guestScope(device: string, ip: string): string {
  return `${device.repeat(64)}.${ip.repeat(64)}`;
}

describe("guest judged-play reservations", () => {
  it("enforces both the signed device and IP daily counters", async () => {
    const original = guestScope("a", "b");
    for (let index = 0; index < 5; index += 1) {
      await expect(
        reserveJudgedPlay(null, `dual-${index}`, original),
      ).resolves.toMatchObject({ replayed: false });
    }

    await expect(
      reserveJudgedPlay(null, "new-ip", guestScope("a", "c")),
    ).rejects.toMatchObject({ code: "FREE_PLAY_LIMIT_REACHED" } satisfies Partial<AppError>);
    await expect(
      reserveJudgedPlay(null, "new-device", guestScope("d", "b")),
    ).rejects.toMatchObject({ code: "FREE_PLAY_LIMIT_REACHED" } satisfies Partial<AppError>);
  });

  it("refunds every guest counter after a pre-judgment failure", async () => {
    const scope = guestScope("e", "f");
    const reservations = [];
    for (let index = 0; index < 5; index += 1) {
      reservations.push(await reserveJudgedPlay(null, `refund-${index}`, scope));
    }
    await expect(
      releaseJudgedPlay(reservations[0]!, null, scope),
    ).resolves.toBe(true);
    await expect(
      reserveJudgedPlay(null, "refund-replacement", scope),
    ).resolves.toMatchObject({ usage: { used: 5, remaining: 0 } });
  });

  it("replays the same guest claim without double counting", async () => {
    const scope = guestScope("1", "2");
    const first = await reserveJudgedPlay(null, "same-attempt", scope);
    const replay = await reserveJudgedPlay(null, "same-attempt", scope);
    expect(replay).toMatchObject({ claimId: first.claimId, replayed: true });
  });
});

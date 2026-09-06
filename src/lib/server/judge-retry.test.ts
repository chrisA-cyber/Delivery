// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  roundAuthorize: vi.fn(), roundAttach: vi.fn(), resolve: vi.fn(), receiptAccess: vi.fn(), judge: vi.fn(), persist: vi.fn(),
  preflight: vi.fn(), reserve: vi.fn(), deletion: vi.fn(), user: { id: "player-a" } as { id: string } | null,
}));

vi.mock("@/lib/server/group-rounds", () => ({
  getRoundViewer: async () => ({ user: fixture.user, guest: fixture.user ? null : { scope: "guest", idempotencyScope: "guest" }, ownerKey: "test" }),
  authorizeClassicRoundJudge: fixture.roundAuthorize, attachClassicRoundJudge: fixture.roundAttach,
}));
vi.mock("@/lib/server/account-deletion", () => ({ assertAccountNotDeleting: fixture.deletion }));
vi.mock("@/lib/server/audio", () => ({ validateAudio: async (audio: File) => ({ durationMs: 2_000, contentHash: Buffer.from(await audio.arrayBuffer()).toString("hex") }) }));
vi.mock("@/lib/server/content", () => ({ resolveCanonicalDeliveryContent: fixture.resolve, assertChallengeReceiptAccess: fixture.receiptAccess }));
vi.mock("@/lib/server/deliveries", () => ({ persistDelivery: fixture.persist, getViewerDailyLeaderboardPosition: vi.fn(), setDeliveryVisibility: vi.fn() }));
vi.mock("@/lib/server/entitlements", () => ({ preflightJudgingUsage: fixture.preflight, reserveJudgedPlay: fixture.reserve, releaseJudgedPlay: vi.fn() }));
vi.mock("@/lib/server/guest", () => ({ getGuestIdentity: () => ({ scope: "guest", idempotencyScope: "guest" }) }));
vi.mock("@/lib/server/moderation", () => ({ moderateLine: vi.fn() }));
vi.mock("@/lib/server/openai", () => ({ judgeDelivery: fixture.judge }));
vi.mock("@/lib/server/rate-limit", () => ({ enforceRateLimit: vi.fn(), getClientKey: () => "test", rateLimitHeaders: () => ({}) }));
vi.mock("@/lib/server/request", () => ({ assertContentLength: vi.fn(), assertMultipartRequest: vi.fn(), assertSameOrigin: vi.fn() }));
vi.mock("@/lib/supabase/auth", () => ({ getOptionalUser: async () => fixture.user }));

import { POST } from "@/app/api/judge/route";
import { AppError } from "@/lib/server/api-error";
import { resetEnvCacheForTests } from "@/lib/server/env";

const challengeId = "00000000-0000-4000-8000-000000000001";
const canonical = {
  promptId: "canonical-line", promptText: "I regret absolutely nothing.", energyId: "canonical-energy",
  energy: "Whisper with impeccable manners.", category: "original", rating: "everyone", requiresPro: false,
  dailyDate: null, dailyMarket: null,
};

function request(key: string, changes: Record<string, string | undefined> = {}, audioByte = 1) {
  const form = new FormData();
  const fields = {
    promptId: "line-identifier", line: canonical.promptText, energy: canonical.energy,
    mode: "challenge", challengeId, challengeToken: "a-long-bound-invite-token", durationMs: "2000", attemptId: key,
    maxRating: "everyone", ...changes,
  };
  for (const [name, value] of Object.entries(fields)) if (value) form.set(name, value);
  form.set("audio", new File([new Uint8Array(1_024).fill(audioByte)], "take.wav", { type: "audio/wav" }));
  return new Request("http://localhost:3000/api/judge", { method: "POST", body: form });
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  resetEnvCacheForTests();
  for (const value of Object.values(fixture)) if (vi.isMockFunction(value)) value.mockReset();
  fixture.user = { id: "player-a" };
  fixture.roundAuthorize.mockResolvedValue(canonical);
  fixture.roundAttach.mockResolvedValue(undefined);
  fixture.resolve.mockResolvedValue(canonical);
  fixture.persist.mockResolvedValue({ id: "saved-receipt", persisted: true });
  fixture.preflight.mockResolvedValue({ tier: "free", tracked: true });
  fixture.reserve.mockResolvedValue({ replayed: false, usage: { tier: "free", tracked: true } });
  fixture.judge.mockResolvedValue({
    transcript: canonical.promptText, scores: { overall: 90, commitment: 92, comedy: 84, accuracy: 100, chaos: 82 },
    verdict: "That polite pause has an outstanding warrant.", verdictTag: "COMMITTED_TO_THE_BIT",
    highlights: ["Restrained emphasis on nothing"], coachNote: "Wait one beat before nothing.", source: "openai",
    rubricVersion: "delivery-voice-v1.1", scoringVersion: "delivery-voice-v1", model: "fixture",
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  resetEnvCacheForTests();
});

describe("judge completed-receipt retry admission", () => {
  it("recovers a lost successful challenge response without entering or scoring twice", async () => {
    const key = crypto.randomUUID();
    const first = await POST(request(key));
    expect(first.status).toBe(201);
    fixture.resolve.mockRejectedValue(new AppError("CHALLENGE_ALREADY_ENTERED", "Already entered", 409));
    const retry = await POST(request(key));
    expect(retry.status).toBe(201);
    expect(retry.headers.get("Idempotency-Replayed")).toBe("true");
    expect((await retry.json()).result.id).toBe("saved-receipt");
    expect(fixture.resolve).toHaveBeenCalledTimes(1);
    expect(fixture.preflight).toHaveBeenCalledTimes(1);
    expect(fixture.reserve).toHaveBeenCalledTimes(1);
    expect(fixture.judge).toHaveBeenCalledTimes(1);
    expect(fixture.persist).toHaveBeenCalledTimes(1);
    expect(fixture.receiptAccess).toHaveBeenCalledWith({ user: { id: "player-a" }, challengeId, challengeToken: "a-long-bound-invite-token" });
    const newAttempt = await POST(request(crypto.randomUUID()));
    expect(newAttempt.status).toBe(409);
    expect((await newAttempt.json()).error.code).toBe("CHALLENGE_ALREADY_ENTERED");
    expect(fixture.judge).toHaveBeenCalledTimes(1);
  });

  it("recovers the same Daily receipt across UTC midnight while rejecting new expired entries", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T23:59:30.000Z"));
    const key = crypto.randomUUID();
    const daily = { mode: "daily", challengeId: "", challengeToken: "", dailyDate: "2026-09-05", dailyMarket: "global" };
    fixture.resolve.mockResolvedValue({ ...canonical, dailyDate: daily.dailyDate, dailyMarket: "global" });
    expect((await POST(request(key, daily))).status).toBe(201);
    vi.setSystemTime(new Date("2026-09-06T00:00:30.000Z"));
    fixture.resolve.mockRejectedValue(new AppError("DAILY_CHALLENGE_EXPIRED", "Daily ended", 409));
    const retry = await POST(request(key, daily));
    expect(retry.status).toBe(201);
    expect(retry.headers.get("Idempotency-Replayed")).toBe("true");
    expect(fixture.resolve).toHaveBeenCalledTimes(1);
    expect((await POST(request(crypto.randomUUID(), daily))).status).toBe(409);
    expect(fixture.judge).toHaveBeenCalledTimes(1);
  });

  it.each([
    { line: "Changed line" }, { energy: "Changed direction" }, { category: "gaming" },
    { promptId: "different-line" }, { challengeToken: "different-bound-invite-token" },
    { dailyDate: "2026-09-04" }, { dailyMarket: "another" }, { maxRating: "mature" },
    { isPublic: "true" }, { durationMs: "2001" }, { mode: "classic" },
  ])("rejects a cached key with changed request fields %j", async (changes) => {
    const key = crypto.randomUUID();
    await POST(request(key));
    const changed = await POST(request(key, changes));
    expect(changed.status).toBe(409);
    expect((await changed.json()).error.code).toBe("IDEMPOTENCY_CONFLICT");
    expect(fixture.judge).toHaveBeenCalledTimes(1);
  });

  it("binds the audio bytes and authenticated account to the receipt", async () => {
    const key = crypto.randomUUID();
    await POST(request(key));
    const changedAudio = await POST(request(key, {}, 2));
    expect((await changedAudio.json()).error.code).toBe("IDEMPOTENCY_CONFLICT");
    fixture.user = { id: "another-player" };
    fixture.resolve.mockRejectedValue(new AppError("CHALLENGE_INVALID", "No access", 404));
    const otherAccount = await POST(request(key));
    expect(otherAccount.status).toBe(404);
    expect(otherAccount.headers.get("Idempotency-Replayed")).toBeNull();
    expect(fixture.judge).toHaveBeenCalledTimes(1);
  });

  it("keeps current account deletion and challenge privacy checks on completed retries", async () => {
    const key = crypto.randomUUID();
    await POST(request(key));
    fixture.receiptAccess.mockRejectedValue(new AppError("CHALLENGE_INVALID", "Access revoked", 404));
    expect((await POST(request(key))).status).toBe(404);
    fixture.deletion.mockRejectedValue(new AppError("ACCOUNT_DELETING", "Deletion underway", 403));
    expect((await POST(request(key))).status).toBe(403);
    expect(fixture.judge).toHaveBeenCalledTimes(1);
    expect(fixture.deletion).toHaveBeenCalledTimes(3);
  });

  it("still rejects a new client body that fails canonical validation before provider work", async () => {
    fixture.resolve.mockRejectedValue(new AppError("PROMPT_MISMATCH", "Wrong line", 409));
    const response = await POST(request(crypto.randomUUID(), { line: "Forged line" }));
    expect((await response.json()).error.code).toBe("PROMPT_MISMATCH");
    expect(fixture.reserve).not.toHaveBeenCalled();
    expect(fixture.judge).not.toHaveBeenCalled();
  });
});


describe("Classic group judging receipt", () => {
  const group = { mode: "classic", challengeId: "", challengeToken: "", roundToken: "r".repeat(43), roundTakeId: "00000000-0000-4000-8000-000000000010" };
  it("checks owned uploaded bytes before provider work and keeps scores out of ordinary history", async () => {
    const response = await POST(request(crypto.randomUUID(), group));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(fixture.roundAuthorize).toHaveBeenCalledWith(expect.objectContaining({ token: group.roundToken, takeId: group.roundTakeId, audioHash: expect.any(String), maxRating: "everyone" }), expect.anything());
    expect(fixture.roundAttach).toHaveBeenCalledOnce();
    expect(fixture.persist).not.toHaveBeenCalled();
    expect(fixture.resolve).not.toHaveBeenCalled();
    expect(body.roundJudgment).toBeUndefined();
    expect(body.delivery.id).toBe(group.roundTakeId);
  });
  it("retries saving a trusted group score from the paid receipt without another judgment", async () => {
    const key = crypto.randomUUID();
    fixture.roundAttach.mockRejectedValueOnce(new Error("temporary database outage"));
    const first = await POST(request(key, group));
    expect((await first.json()).warning).toContain("receipt");
    const second = await POST(request(key, group));
    expect(second.headers.get("Idempotency-Replayed")).toBe("true");
    expect(fixture.judge).toHaveBeenCalledOnce();
    expect(fixture.reserve).toHaveBeenCalledOnce();
    expect(fixture.roundAttach).toHaveBeenCalledTimes(2);
    expect((await second.json()).warning).toBeUndefined();
  });
  it("rejects forged ownership and mismatched group context before a paid dispatch", async () => {
    fixture.roundAuthorize.mockRejectedValue(new AppError("ROUND_TAKE_INVALID", "Wrong recording", 404));
    expect((await POST(request(crypto.randomUUID(), group))).status).toBe(404);
    expect((await POST(request(crypto.randomUUID(), { ...group, roundTakeId: "" }))).status).toBe(422);
    expect(fixture.judge).not.toHaveBeenCalled();
    expect(fixture.reserve).not.toHaveBeenCalled();
  });
});

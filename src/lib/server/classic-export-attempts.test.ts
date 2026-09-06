import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const state = vi.hoisted(() => ({ rows: [] as Row[], failInsert: false, cache: new Map<string, unknown>() }));
const mocks = vi.hoisted(() => ({ validate: vi.fn(), canonical: vi.fn(), account: vi.fn(), upload: vi.fn(), remove: vi.fn(), move: vi.fn(), sign: vi.fn(), usage: vi.fn(), guest: vi.fn() }));
vi.mock("@/lib/server/guest", () => ({ getGuestIdentity: mocks.guest }));
vi.mock("@/lib/server/audio", () => ({ validateAudio: mocks.validate }));
vi.mock("@/lib/server/content", () => ({
  resolveCanonicalDeliveryContent: mocks.canonical,
  assertContentRating: (rating: string, max: string) => { if (rating === "mature" && max !== "mature") throw Object.assign(new Error("restricted"), { status: 403 }); },
}));
vi.mock("@/lib/server/account-deletion", () => ({ assertAccountNotDeleting: mocks.account, isOwnerStoragePath: (path: string, owner: string) => path.startsWith(`${owner}/`) && !path.includes("..") }));
vi.mock("@/lib/server/entitlements", () => ({ preflightJudgingUsage: mocks.usage }));
vi.mock("@/lib/server/idempotency", () => ({
  createRequestFingerprint: (...parts: string[]) => JSON.stringify(parts),
  runIdempotent: async (namespace: string, scope: string, key: string, _fingerprint: string, _ttl: number, run: () => Promise<unknown>) => {
    const id = `${namespace}:${scope}:${key}`;
    if (state.cache.has(id)) return { value: state.cache.get(id), replayed: true };
    const value = await run(); state.cache.set(id, value); return { value, replayed: false };
  },
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({
  from: () => {
    const filters: Array<(row: Row) => boolean> = [];
    let insert: Row | undefined; let update: Row | undefined;
    const execute = () => {
      if (insert) {
        if (state.failInsert) return { data: null, error: { message: "write denied" } };
        const row = { created_at: "2026-09-06T12:00:00Z", deleted_at: null, ...insert };
        state.rows.push(row); insert = undefined; return { data: [row], error: null };
      }
      const rows = state.rows.filter((row) => filters.every((filter) => filter(row)));
      if (update) rows.forEach((row) => Object.assign(row, update));
      return { data: rows, error: null };
    };
    const query = {
      select: () => query, eq: (key: string, value: unknown) => { filters.push((row) => row[key] === value); return query; },
      is: (key: string, value: unknown) => { filters.push((row) => row[key] === value); return query; },
      insert: (value: Row) => { insert = value; return query; }, update: (value: Row) => { update = value; return query; },
      order: () => query, limit: () => query,
      single: async () => { const result = execute(); return { ...result, data: result.data?.[0] ?? null }; },
      maybeSingle: async () => { const result = execute(); return { ...result, data: result.data?.[0] ?? null }; },
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(execute()).then(resolve, reject),
    }; return query;
  },
  storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove, move: mocks.move, createSignedUrl: mocks.sign }) },
}) }));

import { AppError } from "@/lib/server/api-error";
import { claimClassicExportAttempt, createClassicExportAttempt, deleteClassicExportAttempt, getClassicExportAttemptRow, getClassicExportAudioResponse, type ClassicExportViewer } from "@/lib/server/classic-export-attempts";

const owner: ClassicExportViewer = { user: { id: "owner-id" } as User, guest: null, ownerKey: "user:owner-id" };
const guest: ClassicExportViewer = { user: null, guest: { idempotencyScope: "a".repeat(64), scope: "guest.network" }, ownerKey: `guest:${"a".repeat(64)}` };
const input = () => ({ audio: new File([new Uint8Array(1000)], "take.wav", { type: "audio/wav" }), durationMs: 5000,
  attemptId: "10000000-0000-4000-8000-000000000000", promptId: "line-one", promptText: "This is the phrase.", energy: "Very dramatically.", mode: "classic" as const, maxRating: "everyone" as const, displayName: "Player" });

beforeEach(() => {
  vi.clearAllMocks(); state.rows = []; state.cache.clear(); state.failInsert = false;
  mocks.validate.mockResolvedValue({ contentHash: "audio-hash", container: "wav", durationMs: 5000 });
  mocks.canonical.mockResolvedValue({ promptId: "canonical-line", promptSlug: "line-one", promptText: "This is the phrase.", energyId: "canonical-energy", energySlug: "dramatic", energy: "Very dramatically.", category: "original", difficulty: 1, rating: "everyone" });
  mocks.usage.mockResolvedValue({ tier: "free" }); mocks.account.mockResolvedValue(undefined);
  mocks.upload.mockResolvedValue({ error: null }); mocks.remove.mockResolvedValue({ error: null });
  mocks.move.mockResolvedValue({ error: null }); mocks.guest.mockReturnValue(guest.guest);
});

describe("Classic upload-only export attempts", () => {
  it("stores server-resolved immutable text and measured duration without a client score", async () => {
    const saved = await createClassicExportAttempt({ ...input(), durationMs: 5200, score: { overall: 100 } } as ReturnType<typeof input>, owner);
    expect(saved.attempt.assignment.promptId).toBe("canonical-line");
    expect(saved.attempt.durationMs).toBe(5000); expect(saved.attempt.score).toBeNull();
    expect(state.rows[0]).toMatchObject({ user_id: "owner-id", expires_at: null, audio_hash: "audio-hash" });
    expect(state.rows[0]).not.toHaveProperty("score");
    expect(mocks.upload).toHaveBeenCalledWith(expect.stringMatching(/^owner-id\/classic\/[a-f0-9-]+\.wav$/), expect.any(File), expect.objectContaining({ upsert: false }));
  });

  it("recovers durable exact retries without uploading or resolving current catalog again", async () => {
    const first = await createClassicExportAttempt(input(), owner); state.cache.clear();
    mocks.canonical.mockRejectedValue(new AppError("PROMPT_RETIRED", "retired", 409));
    const retry = await createClassicExportAttempt(input(), owner);
    expect(retry.attempt.id).toBe(first.attempt.id); expect(retry.replayed).toBe(true);
    expect(mocks.upload).toHaveBeenCalledTimes(1); expect(mocks.canonical).toHaveBeenCalledTimes(1);
    mocks.validate.mockResolvedValueOnce({ contentHash: "different-audio", container: "wav", durationMs: 5000 });
    await expect(createClassicExportAttempt(input(), owner)).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    await expect(createClassicExportAttempt({ ...input(), energy: "Another direction." }, owner)).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("gives guests private 24-hour attempts and rejects other owners before audio signing", async () => {
    const before = Date.now(); const saved = await createClassicExportAttempt(input(), guest);
    expect(saved.attempt.saved).toBe(false); expect(new Date(saved.attempt.expiresAt!).getTime() - before).toBeGreaterThanOrEqual(24 * 3600_000);
    await expect(getClassicExportAttemptRow(saved.attempt.id, owner)).rejects.toMatchObject({ status: 404 });
    await expect(getClassicExportAudioResponse(saved.attempt.id, owner, new Request("https://delivery.test/audio"))).rejects.toMatchObject({ status: 404 });
    expect(mocks.sign).not.toHaveBeenCalled();
    state.rows[0]!.expires_at = "2000-01-01T00:00:00Z";
    await expect(getClassicExportAttemptRow(saved.attempt.id, guest)).rejects.toMatchObject({ status: 404 });
    await expect(createClassicExportAttempt(input(), guest)).rejects.toMatchObject({ status: 404 });
  });

  it("tombstones before media deletion so late retries cannot recreate the take", async () => {
    const saved = await createClassicExportAttempt(input(), owner);
    mocks.remove.mockImplementationOnce(async () => { expect(state.rows[0]!.deleted_at).toEqual(expect.any(String)); return { error: { message: "retry cleanup" } }; });
    await expect(deleteClassicExportAttempt(saved.attempt.id, owner)).rejects.toMatchObject({ status: 503 });
    await expect(createClassicExportAttempt(input(), owner)).rejects.toMatchObject({ status: 404 });
    await expect(getClassicExportAttemptRow(saved.attempt.id, owner)).rejects.toMatchObject({ status: 404 });
    await deleteClassicExportAttempt(saved.attempt.id, owner);
    expect(mocks.upload).toHaveBeenCalledTimes(1); expect(mocks.remove).toHaveBeenCalledTimes(2);
  });

  it("removes staged audio when account deletion or database failure prevents persistence", async () => {
    state.failInsert = true;
    await expect(createClassicExportAttempt(input(), owner)).rejects.toMatchObject({ status: 503 });
    expect(mocks.remove).toHaveBeenCalledTimes(1); expect(state.rows).toHaveLength(0);
    state.failInsert = false; mocks.account.mockRejectedValueOnce(new AppError("ACCOUNT_DELETING", "deleting", 403));
    await expect(createClassicExportAttempt(input(), owner)).rejects.toMatchObject({ code: "ACCOUNT_DELETING" });
    expect(mocks.remove).toHaveBeenCalledTimes(2); expect(state.rows).toHaveLength(0);
  });

  it("blocks overlong media and canonical content restrictions before upload", async () => {
    mocks.validate.mockResolvedValueOnce({ contentHash: "audio-hash", container: "wav", durationMs: 20_001 });
    await expect(createClassicExportAttempt(input(), owner)).rejects.toMatchObject({ code: "AUDIO_DURATION_INVALID" });
    mocks.canonical.mockRejectedValueOnce(new AppError("CONTENT_OPT_IN_REQUIRED", "restricted", 403));
    await expect(createClassicExportAttempt(input(), owner)).rejects.toMatchObject({ status: 403 });
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("claims a guest take only with its established signed device and reuses account retries", async () => {
    const saved = await createClassicExportAttempt(input(), guest);
    const request = new Request("https://delivery.test/claim");
    mocks.guest.mockReturnValueOnce({ ...guest.guest, setCookie: "newly-minted" });
    await expect(claimClassicExportAttempt(saved.attempt.id, request, owner)).rejects.toMatchObject({ status: 404 });
    expect(mocks.move).not.toHaveBeenCalled();
    const claimed = await claimClassicExportAttempt(saved.attempt.id, request, owner);
    expect(claimed.saved).toBe(true); expect(claimed.expiresAt).toBeNull();
    expect(state.rows[0]).toMatchObject({ user_id: "owner-id", guest_owner_hash: null, owner_key: owner.ownerKey });
    await claimClassicExportAttempt(saved.attempt.id, request, owner);
    expect(mocks.move).toHaveBeenCalledTimes(1);
    await expect(getClassicExportAttemptRow(saved.attempt.id, guest)).rejects.toMatchObject({ status: 404 });
  });

  it("discards staged claim media when deletion wins during its move", async () => {
    const saved = await createClassicExportAttempt(input(), guest);
    mocks.move.mockImplementationOnce(async () => { state.rows[0]!.deleted_at = new Date().toISOString(); return { error: null }; });
    await expect(claimClassicExportAttempt(saved.attempt.id, new Request("https://delivery.test/claim"), owner)).rejects.toMatchObject({ status: 404 });
    expect(mocks.move).toHaveBeenCalledTimes(1);
    expect(mocks.remove).toHaveBeenCalledWith([expect.stringMatching(/^guests\//), expect.stringMatching(/^owner-id\//)]);
  });
});

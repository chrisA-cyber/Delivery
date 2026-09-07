import type { User } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SwitchViewer } from "@/lib/server/switch";

type Row = Record<string, unknown>;
const state = vi.hoisted(() => ({ rows: [] as Row[], queries: [] as string[] }));
const mocks = vi.hoisted(() => ({ source: vi.fn(), rpc: vi.fn(), sign: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/server/video-export-sources", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/server/video-export-sources")>(), resolveExportSource: mocks.source }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({
  rpc: mocks.rpc,
  from: (table: string) => {
    state.queries.push(table); const filters: Array<(row: Row) => boolean> = [];
    const execute = () => ({ data: state.rows.filter((row) => filters.every((filter) => filter(row))), error: null });
    const query = { select: () => query, eq: (key: string, value: unknown) => { filters.push((row) => row[key] === value); return query; },
      order: () => query, limit: () => query,
      maybeSingle: async () => { const result = execute(); return { ...result, data: result.data[0] ?? null }; },
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(execute()).then(resolve, reject),
    }; return query;
  },
  storage: { from: () => ({ createSignedUrl: mocks.sign }) },
}) }));

import { AppError } from "@/lib/server/api-error";
import { getVideoExportRow, listVideoExports, presentVideoExport, requestVideoExport, videoExportResponse } from "@/lib/server/video-exports";
import { defaultClipEditSettings } from "@/lib/video-composition";

const userId = "11111111-1111-4111-8111-111111111111";
const jobId = "22222222-2222-4222-8222-222222222222";
const attemptId = "33333333-3333-4333-8333-333333333333";
const owner: SwitchViewer = { user: { id: userId } as User, guest: null, ownerKey: `user:${userId}` };
const stranger: SwitchViewer = { user: { id: "another-account" } as User, guest: null, ownerKey: "user:another-account" };
function row(): Row { return { id: jobId, attempt_id: attemptId, owner_key: owner.ownerKey, mode: "classic", state: "ready", include_score: false, include_name: false, created_at: "2026-09-06T12:00:00Z", expires_at: "2099-01-01T00:00:00Z", storage_path: `exports/${jobId}/44444444-4444-4444-8444-444444444444.mp4`, failure_code: "INTERNAL_PROVIDER_SECRET", input: { recordingPath: "private-recording" } }; }
beforeEach(() => {
  vi.clearAllMocks(); state.rows = [row()]; state.queries = [];
  mocks.source.mockResolvedValue({ kind: "classic_video_attempt", ownerKey: owner.ownerKey, userId, input: { recordingPath: `${userId}/classic/${attemptId}.wav`, audioHash: "a".repeat(64), durationMs: 5000, recordingOffsetMs: 0, assignment: { mode: "classic", promptText: "Saved phrase." }, invitationUrl: "https://deliverygame.netlify.app/a/a123456789ab", displayName: null, avatarPath: null, score: null } });
  mocks.rpc.mockResolvedValue({ data: row(), error: null });
  mocks.sign.mockResolvedValue({ data: { signedUrl: "https://private-storage.test/signed-video?secret=yes" }, error: null });
  mocks.fetch.mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 206, headers: { "content-length": "3", "content-range": "bytes 0-2/100", "x-private-upstream": "hidden" } }));
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("private persistent video export API boundary", () => {
  it("rejects strangers and rechecks current source eligibility before signing any video bytes", async () => {
    await expect(getVideoExportRow(jobId, stranger)).rejects.toMatchObject({ status: 404 });
    expect(mocks.source).not.toHaveBeenCalled();
    mocks.source.mockRejectedValueOnce(new AppError("EXPORT_UNAVAILABLE", "source deleted", 404));
    await expect(videoExportResponse(jobId, owner, new Request("https://delivery.test/video"))).rejects.toMatchObject({ status: 404 });
    expect(mocks.sign).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("streams authenticated ranges with private headers and a usable attachment filename", async () => {
    const response = await videoExportResponse(jobId, owner, new Request("https://delivery.test/video?download=1", { headers: { Range: "bytes=0-2" } }));
    expect(response.status).toBe(206); expect(response.headers.get("content-range")).toBe("bytes 0-2/100");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toBe(`attachment; filename="delivery-classic-${jobId.slice(0, 8)}.mp4"`);
    expect(response.headers.get("x-private-upstream")).toBeNull();
    expect(mocks.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ headers: { Range: "bytes=0-2" }, cache: "no-store" }));
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("does not sign expired, unfinished, or invalid-path output", async () => {
    for (const invalid of [{ expires_at: "2000-01-01T00:00:00Z" }, { state: "rendering" }, { storage_path: "exports/another-person/private.mp4" }]) {
      state.rows = [{ ...row(), ...invalid }];
      await expect(videoExportResponse(jobId, owner, new Request("https://delivery.test/video"))).rejects.toBeInstanceOf(AppError);
    }
    expect(mocks.sign).not.toHaveBeenCalled();
  });

  it("binds immutable server inputs and visibility choices to stable idempotent request hashes", async () => {
    const request = { mode: "classic" as const, attemptId, includeName: false, includeScore: false, maxRating: "everyone" as const };
    await requestVideoExport(request, owner); await requestVideoExport(request, owner);
    const first = mocks.rpc.mock.calls[0]![1] as Row, retry = mocks.rpc.mock.calls[1]![1] as Row;
    expect(first.p_input_hash).toBe(retry.p_input_hash); expect(first.p_owner_key).toBe(owner.ownerKey);
    expect(first.p_source_kind).toBe("classic_video_attempt");
    await requestVideoExport({ ...request, includeName: true }, owner);
    expect((mocks.rpc.mock.calls[2]![1] as Row).p_input_hash).not.toBe(first.p_input_hash);
    expect(mocks.source).toHaveBeenCalledWith("classic", attemptId, owner, "everyone", expect.objectContaining({ invitation: true }));
  });

  it("returns a scene-specific eligibility explanation without listing jobs", async () => {
    mocks.source.mockRejectedValueOnce(new AppError("SCENE_EXPORT_UNAVAILABLE", "Choose a reusable scene.", 409));
    expect(await listVideoExports("say-it-back", attemptId, owner, "everyone")).toEqual({ exports: [], eligible: false, reason: "Choose a reusable scene." });
    expect(state.queries).toEqual([]);
  });

  it("binds trim, avatar, layout and placement to each immutable render version", async () => {
    const settings = defaultClipEditSettings("classic");
    const request = { mode: "classic" as const, attemptId, includeName: true, includeScore: true, maxRating: "everyone" as const, settings };
    await requestVideoExport(request, owner);
    const first = mocks.rpc.mock.calls[0]![1] as Row;
    for (const edit of [{ trimStart: 1, trimEnd: 4 }, { avatar: { kind: "builtin" as const, id: "robot" } }, { avatarX: 0.7 }, { layout: "duet" as const }, { captions: false }, { includeScore: false }, { includeName: false }]) {
      await requestVideoExport({ ...request, settings: { ...settings, ...edit } }, owner);
      expect((mocks.rpc.mock.calls.at(-1)![1] as Row).p_input_hash).not.toEqual(first.p_input_hash);
    }
    await requestVideoExport(request, owner);
    expect((mocks.rpc.mock.calls.at(-1)![1] as Row).p_input_hash).toEqual(first.p_input_hash);
    expect((first.p_input as Row).settings).toEqual(settings);
  });

  it("presents failure and expiry safely without storage paths, private inputs, or internal codes", () => {
    const failed = presentVideoExport({ ...row(), state: "failed" });
    expect(failed.videoUrl).toBeNull(); expect(failed.errorMessage).toContain("original take and score are safe");
    expect(JSON.stringify(failed)).not.toMatch(/private-recording|INTERNAL_PROVIDER_SECRET|storage_path/);
    const expired = presentVideoExport({ ...row(), expires_at: "2000-01-01T00:00:00Z" });
    expect(expired.status).toBe("expired"); expect(expired.videoUrl).toBeNull();
  });
});

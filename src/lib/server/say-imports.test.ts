// @vitest-environment node
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SayImportRow } from "./say-imports";
import type { SayViewer } from "./say-it-back";

const mocks = vi.hoisted(() => ({ from: vi.fn(), storage: vi.fn(), viewer: vi.fn(), limit: vi.fn(), backing: vi.fn(), deleting: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from: mocks.from, storage: { from: mocks.storage } }) }));
vi.mock("@/lib/server/say-it-back", () => ({ getSayViewer: mocks.viewer }));
vi.mock("@/lib/server/account-deletion", () => ({ assertAccountNotDeleting: mocks.deleting }));
vi.mock("@/lib/server/rate-limit", () => ({ enforceRateLimit: mocks.limit }));
vi.mock("@/lib/server/say-import-media", () => ({ validateSourceUrl: (url: string) => url, createImportedBacking: mocks.backing }));
import { createSayImport, getSayImportMedia, loadSayImport, publishSayImport, validateImportCues } from "./say-imports";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const key = "a".repeat(48);
const owner = `guest:${"b".repeat(64)}`;
const viewer = { ownerKey: owner, user: null, guest: null } as SayViewer;
function row(changes: Partial<SayImportRow> = {}): SayImportRow {
  return { id, owner_key: owner, user_id: null, request_key: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", status: "ready", source_url: null,
    title: "My scene", creator: "Player", source_duration: 30, source_mime: "video/mp4", media_key: key,
    excerpt_start: 5, excerpt_end: 10, cues: [{ id: "line-1", text: "Hello there.", start: 0, end: 3, selected: true }],
    assets: { source: `${id}/source`, video: `${id}/video.mp4` }, integrity: {}, error_message: null, published_clip_id: null,
    created_at: "2026-09-07T00:00:00Z", expires_at: new Date(Date.now() + 3600000).toISOString(), deleted_at: null,
    job_kind: null, lease_token: null, lease_expires_at: null, job_attempts: 1, ...changes };
}
function response(data: unknown) {
  const result = { data, error: null };
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "gt", "order", "limit", "in"]) chain[method] = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => result);
  chain.single = vi.fn(async () => result);
  return chain;
}
beforeEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); mocks.viewer.mockResolvedValue(viewer); });

describe("custom scene ownership and media", () => {
  it.each([
    row({ owner_key: `guest:${"d".repeat(64)}` }),
    row({ expires_at: "2000-01-01T00:00:00Z" }),
    row({ deleted_at: "2026-09-07T01:00:00Z" }),
  ])("rejects a foreign, expired, or deleted scene", async (data) => {
    mocks.from.mockReturnValue(response(data));
    await expect(loadSayImport(id, viewer)).rejects.toMatchObject({ code: "SCENE_NOT_FOUND" });
    expect(mocks.storage).not.toHaveBeenCalled();
  });

  it("rejects invalid media tokens before requesting a signed URL", async () => {
    mocks.from.mockReturnValue(response(row()));
    await expect(getSayImportMedia(id, "video", new Request(`https://delivery.test/media?key=${"f".repeat(48)}`))).rejects.toMatchObject({ code: "SCENE_NOT_FOUND" });
    expect(mocks.storage).not.toHaveBeenCalled();
  });

  it("a valid shared excerpt capability cannot reveal the original upload", async () => {
    mocks.from.mockReturnValue(response(row()));
    mocks.viewer.mockResolvedValue({ ...viewer, ownerKey: `guest:${"d".repeat(64)}` });
    await expect(getSayImportMedia(id, "source", new Request(`https://delivery.test/media?key=${key}`))).rejects.toMatchObject({ code: "SCENE_NOT_FOUND" });
    expect(mocks.storage).not.toHaveBeenCalled();
  });

  it("serves the prepared excerpt through its valid capability with range support", async () => {
    mocks.from.mockReturnValue(response(row()));
    const signed = vi.fn(async () => ({ data: { signedUrl: "https://storage.test/signed" }, error: null }));
    mocks.storage.mockReturnValue({ createSignedUrl: signed });
    const fetcher = vi.fn(async () => new Response("clip", { status: 206, headers: { "content-range": "bytes 0-3/100", "content-length": "4" } }));
    vi.stubGlobal("fetch", fetcher);
    const result = await getSayImportMedia(id, "video", new Request(`https://delivery.test/media?key=${key}`, { headers: { range: "bytes=0-3" } }));
    expect(result.status).toBe(206);
    expect(result.headers.get("content-range")).toBe("bytes 0-3/100");
    expect(await result.text()).toBe("clip");
    expect(fetcher).toHaveBeenCalledWith("https://storage.test/signed", expect.objectContaining({ headers: { Range: "bytes=0-3" } }));
    expect(mocks.viewer).not.toHaveBeenCalled();
  });
});

describe("custom scene retry identity", () => {
  it("rejects another file under the same request ID, even with the same name", async () => {
    const sourceHash = createHash("sha256").update("original").digest("hex");
    mocks.from.mockReturnValue(response(row({ integrity: { source: sourceHash } })));
    await expect(createSayImport({ requestId: row().request_key, file: new File(["different"], "same.mp4", { type: "video/mp4" }) }, viewer)).rejects.toMatchObject({ code: "IMPORT_RETRY_CONFLICT" });
    expect(mocks.storage).not.toHaveBeenCalled();
    expect(mocks.limit).not.toHaveBeenCalled();
  });

  it("reuses a matching upload without another upload or quota charge", async () => {
    const sourceHash = createHash("sha256").update("original").digest("hex");
    mocks.from.mockReturnValue(response(row({ integrity: { source: sourceHash } })));
    await expect(createSayImport({ requestId: row().request_key, file: new File(["original"], "same.mp4", { type: "video/mp4" }) }, viewer)).resolves.toMatchObject({ id, status: "ready" });
    expect(mocks.storage).not.toHaveBeenCalled();
    expect(mocks.limit).not.toHaveBeenCalled();
  });

  it("published retries return the original manifest without regenerating backing", async () => {
    const clip = { id: `custom-${id}`, version: "v1", title: "Original title", description: "An original scene.", duration: 5,
      difficulty: "easy", rating: "everyone", category: "Your scenes", tags: ["custom"], videoUrl: "https://delivery.test/video.mp4", posterUrl: "https://delivery.test/poster.jpg",
      roles: [{ id: "you", name: "You", description: "Your line", muteIntervals: [{ start: 0, end: 3 }] }],
      cues: [{ id: "line-1", roleId: "you", text: "Hello there.", start: 0, end: 3 }],
      source: { title: "Original", creator: "Player", url: "https://delivery.test", license: "User media", licenseUrl: "https://delivery.test", attribution: "Player scene", reuseNote: "Source supplied by the player.", excerptStart: 5, excerptEnd: 10 } };
    mocks.from.mockReturnValueOnce(response(row({ status: "published", published_clip_id: `${clip.id}:v1` }))).mockReturnValueOnce(response({ manifest: clip, enabled: true }));
    await expect(publishSayImport(id, { title: "Changed retry title", rating: "mature", cues: row().cues }, viewer)).resolves.toEqual(clip);
    expect(mocks.backing).not.toHaveBeenCalled();
    expect(mocks.storage).not.toHaveBeenCalled();
  });
});

describe("custom scene dialogue boundaries", () => {
  it("accepts selected and supporting dialogue through the 45-second boundary", () => {
    expect(() => validateImportCues([{ id: "a", text: "Hello.", start: 0, end: 20, selected: true }, { id: "b", text: "Goodbye.", start: 20, end: 45, selected: false }], 45)).not.toThrow();
  });
  it.each([
    [{ id: "a", text: "Hello.", start: 0, end: 2, selected: false }],
    [{ id: "a", text: "Hello.", start: 0, end: 2, selected: true }, { id: "a", text: "Again.", start: 2, end: 3, selected: true }],
    [{ id: "a", text: "Hello.", start: 0, end: 2, selected: true }, { id: "b", text: "Again.", start: 1.99, end: 3, selected: true }],
    [{ id: "a", text: "Hello.", start: 0, end: 5.01, selected: true }],
    [{ id: "a", text: "Hello.", start: NaN, end: 3, selected: true }],
  ])("rejects invalid or unselected cue sequences", (...cues) => {
    expect(() => validateImportCues(cues, 5)).toThrow();
  });
});

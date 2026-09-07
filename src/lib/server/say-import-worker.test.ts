// @vitest-environment node
import { createHash } from "node:crypto";
import { access, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SayImportRow } from "./say-imports";

type Values = Record<string, unknown>;
const state = vi.hoisted(() => ({ row: null as SayImportRow | null, failCommitAfterWrite: false, failCleanupRead: false, files: new Map<string, Buffer>(), preparedDir: "" }));
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn(), remove: vi.fn(), download: vi.fn(), resolve: vi.fn(), inspect: vi.fn(), prepare: vi.fn(), transcribe: vi.fn(), cues: vi.fn(), account: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({
  rpc: mocks.rpc,
  storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) },
  from: () => {
    const filters: Array<(row: SayImportRow) => boolean> = [];
    let update: Values | undefined;
    let columns = "*";
    const execute = () => {
      if (columns === "assets,deleted_at" && state.failCleanupRead) return { data: null, error: new Error("Storage credentials must not be shown") };
      const row = state.row;
      if (!row || !filters.every(filter => filter(row))) return { data: null, error: null };
      if (update) Object.assign(row, update);
      if (update?.status === "ready" && state.failCommitAfterWrite) {
        state.failCommitAfterWrite = false;
        return { data: null, error: new Error("Connection lost after database commit") };
      }
      return { data: structuredClone(row), error: null };
    };
    const query = {
      select: (value: string) => { columns = value; return query; },
      update: (value: Values) => { update = value; return query; },
      eq: (key: keyof SayImportRow, value: unknown) => { filters.push(row => row[key] === value); return query; },
      is: (key: keyof SayImportRow, value: unknown) => { filters.push(row => row[key] === value); return query; },
      gt: (key: keyof SayImportRow, value: string) => { filters.push(row => typeof row[key] === "string" && String(row[key]) > value); return query; },
      or: (expression: string) => { const now = expression.split("expires_at.gt.")[1]!; filters.push(row => !row.expires_at || row.expires_at > now); return query; },
      abortSignal: () => query,
      maybeSingle: async () => execute(),
      then: (resolve: (result: ReturnType<typeof execute>) => unknown, reject?: (error: unknown) => unknown) => Promise.resolve(execute()).then(resolve, reject),
    };
    return query;
  },
}) }));
vi.mock("@/lib/server/account-deletion", () => ({ assertAccountNotDeleting: mocks.account }));
vi.mock("@/lib/server/say-import-media", () => ({ resolveAndDownloadSource: mocks.resolve, inspectUploadedSource: mocks.inspect, prepareImportedMedia: mocks.prepare }));
vi.mock("@/lib/server/say-it-back-transcription", () => ({ transcribeSayAudio: mocks.transcribe }));
vi.mock("@/lib/server/say-imports", () => ({ SAY_IMPORT_BUCKET: "delivery-scenes", checkSayImport: (error: unknown) => { if (error) throw new Error("Scene storage unavailable"); }, downloadImportAsset: mocks.download, importCuesFromWords: mocks.cues }));

import { runNextSayImport } from "./say-import-worker";
import { AppError } from "./api-error";

const id = "22222222-2222-4222-8222-222222222222";
const lease = "33333333-3333-4333-8333-333333333333";
const newerLease = "44444444-4444-4444-8444-444444444444";
const sourceKey = `${id}/source`;
const videoBytes = Buffer.from("prepared video");
const cue = { id: "line-1", text: "Wait, what?", start: 0, end: 2, selected: true };
function row(values: Partial<SayImportRow> = {}): SayImportRow {
  return { id, owner_key: "guest:abc", user_id: null, request_key: id, status: "processing", source_url: null, title: "Uploaded scene", creator: "Player",
    source_duration: 12, source_mime: "video/quicktime", media_key: "a".repeat(48), excerpt_start: 2, excerpt_end: 8, cues: [], assets: { source: sourceKey }, integrity: {},
    error_message: null, published_clip_id: null, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400_000).toISOString(),
    deleted_at: null, job_kind: "prepare", lease_token: lease, lease_expires_at: new Date(Date.now() + 360_000).toISOString(), job_attempts: 1, ...values };
}

beforeEach(() => {
  vi.resetAllMocks();
  state.row = row(); state.files = new Map([[sourceKey, Buffer.from("source video")]]); state.failCommitAfterWrite = false; state.failCleanupRead = false; state.preparedDir = "";
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.rpc.mockImplementation(() => ({ abortSignal: async () => ({ data: state.row ? structuredClone(state.row) : null, error: null }) }));
  mocks.account.mockResolvedValue(undefined);
  mocks.upload.mockImplementation(async (key: string, bytes: Buffer) => { state.files.set(key, bytes); return { data: { path: key }, error: null }; });
  mocks.remove.mockImplementation(async (keys: string[]) => { keys.forEach(key => state.files.delete(key)); return { data: [], error: null }; });
  mocks.download.mockImplementation(async (_row: SayImportRow, _asset: string, file: string) => { await writeFile(file, "source video"); });
  mocks.inspect.mockResolvedValue({ duration: 12 });
  mocks.resolve.mockImplementation(async (_url: string, dir: string) => {
    const file = path.join(dir, "downloaded.mp4"); await writeFile(file, "public video");
    return { path: file, title: "Public title", creator: "Public creator", sourceUrl: "https://youtube.com/watch?v=Abcdefg_123", duration: 60 };
  });
  mocks.prepare.mockImplementation(async (_source: string, dir: string) => {
    state.preparedDir = dir;
    const videoPath = path.join(dir, "video.mp4"), posterPath = path.join(dir, "poster.jpg"), referencePath = path.join(dir, "reference.wav");
    await Promise.all([writeFile(videoPath, videoBytes), writeFile(posterPath, "poster"), writeFile(referencePath, "wav audio")]);
    return { videoPath, posterPath, referencePath, duration: 6 };
  });
  mocks.transcribe.mockResolvedValue({ text: cue.text, words: [{ text: cue.text, start: 0, end: 2 }], rawWords: [{ text: cue.text, start: 0.1, end: 2.1 }] });
  mocks.cues.mockReturnValue([cue]);
});
afterEach(() => { vi.restoreAllMocks(); });

describe("custom scene worker leases and preparation", () => {
  it("does not process an empty queue or acquire work after shutdown", async () => {
    state.row = null;
    expect(await runNextSayImport()).toBe(false);
    const controller = new AbortController(); controller.abort();
    expect(await runNextSayImport(controller.signal)).toBe(false);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.prepare).not.toHaveBeenCalled();
  });

  it("inspects an uploaded source without retrieving or replacing it", async () => {
    state.row = row({ job_kind: "fetch", status: "fetching" });
    expect(await runNextSayImport()).toBe(true);
    expect(state.row).toMatchObject({ status: "source-ready", source_duration: 12, source_mime: "video/quicktime", excerpt_start: 0, excerpt_end: 12, assets: { source: sourceKey }, lease_token: null });
    expect(mocks.inspect).toHaveBeenCalledOnce();
    expect(mocks.resolve).not.toHaveBeenCalled(); expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("stores a retrieved source under its immutable lease and retains its measured duration", async () => {
    state.row = row({ job_kind: "fetch", status: "fetching", source_url: "https://youtube.com/watch?v=Abcdefg_123", assets: {} });
    await runNextSayImport();
    expect(state.row).toMatchObject({ status: "source-ready", title: "Public title", creator: "Public creator", source_duration: 60, excerpt_end: 45, source_mime: "video/mp4", assets: { source: `${id}/${lease}-source.mp4` } });
    expect(mocks.upload).toHaveBeenCalledWith(`${id}/${lease}-source.mp4`, expect.any(Buffer), expect.objectContaining({ upsert: false }));
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("replaces a prepared excerpt atomically, retains source, and removes only superseded assets", async () => {
    const oldVideo = `${id}/old-video.mp4`, oldPoster = `${id}/old-poster.jpg`, oldReference = `${id}/old-reference.wav`, oldBacking = `${id}/old-backing.m4a`;
    state.row!.assets = { source: sourceKey, video: oldVideo, poster: oldPoster, reference: oldReference, backing: oldBacking };
    for (const key of [oldVideo, oldPoster, oldReference, oldBacking]) state.files.set(key, Buffer.from("old media"));
    await runNextSayImport();
    expect(state.row).toMatchObject({ status: "ready", excerpt_start: 2, excerpt_end: 8, cues: [cue], job_kind: null, lease_token: null });
    expect(state.row!.assets).toEqual({ source: sourceKey, video: `${id}/${lease}-video.mp4`, poster: `${id}/${lease}-poster.jpg`, reference: `${id}/${lease}-reference.wav` });
    expect(state.row!.integrity.video).toBe(createHash("sha256").update(videoBytes).digest("hex"));
    expect(mocks.remove).toHaveBeenCalledWith([oldVideo, oldPoster, oldReference, oldBacking]);
    expect(state.files.has(sourceKey)).toBe(true);
    await expect(access(state.preparedDir)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each(["failed", "empty"])("keeps media editable with fresh manual cues when ASR is %s", async (mode) => {
    state.row!.cues = [{ ...cue, text: "Old excerpt dialogue", end: 20 }];
    if (mode === "failed") mocks.transcribe.mockRejectedValue(new Error("Private provider body"));
    else mocks.cues.mockReturnValue([]);
    await runNextSayImport();
    expect(state.row).toMatchObject({ status: "ready", cues: [{ id: "line-1", text: "", start: 0, end: 6, selected: true }] });
    expect(state.row!.error_message).toMatch(/Add|dialogue/);
    expect(JSON.stringify(state.row)).not.toContain("Private provider body");
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("uses validated ASR words as editable draft timing when acoustic refinement has no usable words", async () => {
    const rawWords = [{ text: "Wait, what?", start: 0.2, end: 1.8 }, { text: "Give me a second.", start: 3, end: 5 }];
    const draftCues = rawWords.map((word, index) => ({ ...word, id: `line-${index + 1}`, selected: true }));
    mocks.transcribe.mockResolvedValue({ text: "Wait, what? Give me a second.", words: [], rawWords });
    mocks.cues.mockReturnValue(draftCues);

    await runNextSayImport();

    expect(mocks.cues).toHaveBeenCalledWith("Wait, what? Give me a second.", rawWords, 6);
    expect(state.row).toMatchObject({ status: "ready", cues: draftCues, error_message: "Check the line timing before creating your scene." });
    expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain("Give me a second.");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("Give me a second.");
  });

  it("continues to prefer refined word timing when it is available", async () => {
    await runNextSayImport();

    expect(mocks.cues).toHaveBeenCalledWith(cue.text, [{ text: cue.text, start: 0, end: 2 }], 6);
    expect(state.row).toMatchObject({ status: "ready", cues: [cue], error_message: null });
  });

  it("fails clearly for a missing original before media or transcription work", async () => {
    state.row!.assets = {};
    await runNextSayImport();
    expect(state.row).toMatchObject({ status: "failed", error_message: "The original video is unavailable. Import it again.", job_kind: null });
    expect(mocks.download).not.toHaveBeenCalled(); expect(mocks.prepare).not.toHaveBeenCalled(); expect(mocks.transcribe).not.toHaveBeenCalled();
  });

  it("cannot overwrite a newer lease after preparation completes", async () => {
    const prepare = mocks.prepare.getMockImplementation()!;
    mocks.prepare.mockImplementation(async (...args: unknown[]) => {
      const result = await prepare(...args);
      state.row!.lease_token = newerLease;
      state.row!.assets.video = `${id}/${newerLease}-video.mp4`;
      return result;
    });
    await runNextSayImport();
    expect(state.row).toMatchObject({ status: "processing", lease_token: newerLease, assets: { video: `${id}/${newerLease}-video.mp4` } });
    expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled(); expect(mocks.transcribe).not.toHaveBeenCalled();
  });

  it("cleans only its own partial output when the import is deleted during an upload", async () => {
    mocks.upload.mockImplementationOnce(async (key: string, bytes: Buffer) => {
      state.files.set(key, bytes); state.row!.deleted_at = new Date().toISOString(); state.row!.lease_token = null;
      return { data: { path: key }, error: null };
    });
    await runNextSayImport();
    expect(state.row!.deleted_at).not.toBeNull(); expect(state.row!.status).toBe("processing");
    expect(mocks.remove).toHaveBeenCalledWith([`${id}/${lease}-video.mp4`]);
    expect(state.files.has(sourceKey)).toBe(true); expect(mocks.transcribe).not.toHaveBeenCalled();
  });

  it.each(["lease_expires_at", "expires_at"] as const)("does not publish or mark failed when %s expires", async (field) => {
    mocks.transcribe.mockImplementationOnce(async () => {
      state.row![field] = new Date(Date.now() - 1000).toISOString();
      return { text: cue.text, words: [{ text: cue.text, start: 0, end: 2 }] };
    });
    await runNextSayImport();
    expect(state.row).toMatchObject({ status: "processing", lease_token: lease, job_kind: "prepare" });
    expect(mocks.remove).toHaveBeenCalledWith([`${id}/${lease}-video.mp4`, `${id}/${lease}-poster.jpg`, `${id}/${lease}-reference.wav`]);
  });

  it("preserves committed output when the database response is lost after the write", async () => {
    state.failCommitAfterWrite = true;
    await runNextSayImport();
    expect(state.row).toMatchObject({ status: "ready", lease_token: null, assets: { video: `${id}/${lease}-video.mp4` } });
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(state.files.get(state.row!.assets.video!)).toEqual(videoBytes);
  });

  it("removes an uncertain partial upload without touching the prior successful excerpt", async () => {
    const oldVideo = `${id}/old-video.mp4`;
    state.row!.assets.video = oldVideo; state.files.set(oldVideo, Buffer.from("old video"));
    mocks.upload.mockImplementationOnce(async (key: string, bytes: Buffer) => {
      state.files.set(key, bytes);
      return { data: null, error: new Error("Upload response lost") };
    });
    await runNextSayImport();
    expect(state.row).toMatchObject({ status: "failed", assets: { video: oldVideo } });
    expect(mocks.remove).toHaveBeenCalledWith([`${id}/${lease}-video.mp4`]);
    expect(state.files.has(oldVideo)).toBe(true);
  });

  it("keeps uncertain remote files and still removes its local workspace when cleanup fails", async () => {
    state.failCleanupRead = true;
    mocks.upload.mockResolvedValueOnce({ data: null, error: new Error("Upload failed") });
    await runNextSayImport();
    expect(state.row!.status).toBe("failed");
    expect(mocks.remove).not.toHaveBeenCalled();
    await expect(access(state.preparedDir)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not turn shutdown cancellation into a ready manual-transcript scene", async () => {
    const controller = new AbortController();
    mocks.transcribe.mockImplementationOnce(async () => { controller.abort(); throw new Error("Aborted ASR"); });
    await runNextSayImport(controller.signal);
    expect(state.row!.status).toBe("failed");
    expect(state.row!.assets.video).toBeUndefined();
    expect(mocks.remove).toHaveBeenCalledWith([`${id}/${lease}-video.mp4`, `${id}/${lease}-poster.jpg`, `${id}/${lease}-reference.wav`]);
  });

  it("rechecks account deletion before committing prepared media", async () => {
    state.row!.user_id = "55555555-5555-4555-8555-555555555555";
    mocks.account.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new AppError("ACCOUNT_DELETING", "This account is being deleted.", 409));
    await runNextSayImport();
    expect(state.row!.status).toBe("failed");
    expect(state.row!.assets.video).toBeUndefined();
    expect(mocks.remove).toHaveBeenCalledOnce();
  });
});

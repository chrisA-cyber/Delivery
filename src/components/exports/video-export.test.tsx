import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VideoExport, type ExportVideo } from "./video-export";
import { defaultClipEditSettings, type ClipEditSettings } from "@/lib/video-composition";

vi.mock("@/components/providers/app-provider", () => ({ useApp: () => ({ contentRating: "everyone", reducedMotion: false }) }));
vi.mock("@/hooks/use-preferred-avatar", () => ({ usePreferredAvatar: () => ({ avatar: { kind: "builtin", id: "fox" }, setAvatar: vi.fn(), loading: false, saving: false, error: "" }) }));
vi.mock("@/components/avatars/avatar-picker", () => ({ AvatarPicker: ({ onChange }: { onChange: (value: unknown) => void }) => <button type="button" onClick={() => onChange({ kind: "builtin", id: "cat" })}>Choose Cat</button> }));
vi.mock("./clip-preview", () => ({ ClipPreview: ({ settings }: { settings: ClipEditSettings }) => <div aria-label="Editable clip preview" data-settings={JSON.stringify(settings)} />, clipTime: (value: number) => `${value.toFixed(1)}s` }));
const settings = { ...defaultClipEditSettings("classic"), includeName: false };
const scene = { mode: "classic", duration: 5, classic: { phrase: "I was being dramatic.", direction: "A little too confidently" }, score: { value: 82, label: "Delivery score" }, displayName: "Chris" };
const editor = { settings, preferredAvatar: settings.avatar, source: { recordingUrl: "/private-audio", recordingOffsetMs: 0, duration: 5, scene } };
const video: ExportVideo = { id: "video-1", status: "ready", includeScore: true, includeName: false, settings, score: scene.score, displayName: null, filename: "delivery-classic.mp4", assignmentUrl: "https://delivery.example/a/public1234" };
function ok(data: unknown) { return new Response(JSON.stringify({ ok: true, data }), { headers: { "Content-Type": "application/json" } }); }
function setup({ saved = editor, exports = [video], eligible = true }: { saved?: typeof editor; exports?: ExportVideo[]; eligible?: boolean } = {}) {
  let edits = saved;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith("/api/exports/editor")) {
      if (init?.method === "PUT") { edits = { ...edits, settings: JSON.parse(init.body as string).settings }; return ok({ settings: edits.settings }); }
      return ok(edits);
    }
    if (url === "/api/exports" && init?.method === "POST") { const body = JSON.parse(init.body as string); return ok({ export: { ...video, status: "queued", settings: body.settings, includeScore: body.settings.includeScore, includeName: body.settings.includeName, displayName: body.settings.includeName ? scene.displayName : null, score: body.settings.includeScore ? scene.score : null } }); }
    if (url.startsWith("/api/exports?")) return ok({ exports, eligible, reason: eligible ? undefined : "This scene is available for in-app replay only." });
    if (url.endsWith("/video")) return new Response(new Blob(["finished mp4"], { type: "video/mp4" }));
    return ok({ export: video });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
beforeEach(() => {
  vi.stubGlobal("React", React);
  Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  Object.defineProperty(navigator, "canShare", { configurable: true, value: undefined });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("compact clip editor and finished video workflow", () => {
  it("opens the editor directly, recovers a matching MP4, and never displays a stale video after edits", async () => {
    const fetchMock = setup();
    render(<VideoExport mode="classic" attemptId="owned-take" hasScore />);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Create video" }));
    await screen.findByRole("link", { name: "Download video" });
    expect(screen.getByRole("dialog", { name: "Edit your clip" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Finished MP4" }));
    expect(screen.getByLabelText("Finished performance video")).toHaveAttribute("src", "/api/exports/video-1/video?v=0");
    fireEvent.click(screen.getByRole("tab", { name: "Text" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Display name/ }));
    expect(screen.queryByLabelText("Finished performance video")).toBeNull();
    expect(screen.queryByRole("link", { name: "Download video" })).toBeNull();
    expect(screen.getByRole("button", { name: "Generate video" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save edits" })).toBeEnabled();
    expect(screen.getByText("Earlier clips")).toBeInTheDocument();
  });

  it("saves a local unscored source once on opening, keeps trimming separate from judging, and restores saved edits", async () => {
    const saved = { ...editor, settings: { ...settings, includeScore: false }, source: { ...editor.source, scene: { ...scene, score: null } } } as unknown as typeof editor;
    const fetchMock = setup({ saved, exports: [] });
    const prepareAttempt = vi.fn().mockResolvedValue("saved-local");
    const first = render(<VideoExport mode="switch" prepareAttempt={prepareAttempt} />);
    fireEvent.click(screen.getByRole("button", { name: "Create video" }));
    await screen.findByLabelText("Editable clip preview");
    expect(prepareAttempt).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("tab", { name: "Trim" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Trim start seconds" }), { target: { value: "1.2" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Trim end seconds" }), { target: { value: "4.2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save edits" }));
    await screen.findByText("Edits saved. Reopen this performance to keep editing.");
    first.unmount();
    render(<VideoExport mode="switch" attemptId="saved-local" initialOpen />);
    await screen.findByLabelText("Editable clip preview");
    fireEvent.click(screen.getByRole("tab", { name: "Trim" }));
    expect(screen.getByRole("spinbutton", { name: "Trim start seconds" })).toHaveValue(1.2);
    expect(screen.getByRole("spinbutton", { name: "Trim end seconds" })).toHaveValue(4.2);
    fireEvent.click(screen.getByRole("button", { name: "Generate video" }));
    await screen.findByText("Your video is queued.");
    const posted = JSON.parse(fetchMock.mock.calls.find(([, init]) => init?.method === "POST")![1]!.body as string);
    expect(posted).toMatchObject({ mode: "switch", attemptId: "saved-local", includeScore: false, settings: { trimStart: 1.2, trimEnd: 4.2, avatar: settings.avatar }, maxRating: "everyone" });
    expect(fetchMock.mock.calls.every(([url]) => !url.includes("judge"))).toBe(true);
  });

  it("uses a different avatar for this clip without changing the preferred avatar and keeps name independent", async () => {
    setup();
    render(<VideoExport mode="classic" attemptId="owned" hasScore initialOpen />);
    await screen.findByLabelText("Editable clip preview");
    fireEvent.click(screen.getByRole("tab", { name: "Avatar" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose Cat" }));
    expect(screen.getByRole("button", { name: "Use for future clips" })).toBeEnabled();
    const draft = JSON.parse(screen.getByLabelText("Editable clip preview").getAttribute("data-settings")!);
    expect(draft).toMatchObject({ avatar: { kind: "builtin", id: "cat" }, avatarVisible: true, includeName: false });
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(JSON.parse(screen.getByLabelText("Editable clip preview").getAttribute("data-settings")!)).toMatchObject({ avatar: settings.avatar, trimStart: 0, trimEnd: null });
  });

  it("rejects an old-name render after a profile update and retains original-layout downloads", async () => {
    const namedSettings = { ...settings, includeName: true };
    setup({ saved: { ...editor, settings: namedSettings }, exports: [{ ...video, settings: namedSettings, includeName: true, displayName: "Old name" }, { ...video, id: "legacy", settings: null }] });
    render(<VideoExport mode="classic" attemptId="owned" hasScore initialOpen />);
    await screen.findByLabelText("Editable clip preview");
    expect(screen.getByRole("button", { name: "Generate video" })).toBeEnabled();
    expect(screen.queryByRole("link", { name: "Download video" })).toBeNull();
    expect(screen.getByText("Clip 2 · original layout")).toHaveAttribute("href", "/api/exports/legacy/video?download=1");
  });

  it("retries failed exports with their saved source and exact settings", async () => {
    const fetchMock = setup({ exports: [{ ...video, status: "failed", errorMessage: "Video creation was interrupted." }] });
    render(<VideoExport mode="classic" attemptId="kept-take" hasScore initialOpen />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry video" }));
    await screen.findByText("Your video is queued.");
    expect(JSON.parse(fetchMock.mock.calls.find(([, init]) => init?.method === "POST")![1]!.body as string)).toMatchObject({ attemptId: "kept-take", settings });
  });

  it("shares the actual preloaded MP4 on a user tap and never calls it published", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: vi.fn().mockReturnValue(true) });
    setup();
    render(<VideoExport mode="classic" attemptId="owned" hasScore initialOpen />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Share video" })).toBeEnabled());
    expect(share).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Share video" }));
    await screen.findByText("Share menu closed. Your video is still available here.");
    expect((share.mock.calls[0]![0] as ShareData).files?.[0]).toMatchObject({ name: "delivery-classic.mp4", type: "video/mp4" });
    expect(screen.queryByText(/published/i)).toBeNull();
  });

  it("explains ineligible scenes without starting generation", async () => {
    const fetchMock = setup({ eligible: false, exports: [] });
    render(<VideoExport mode="say-it-back" attemptId="restricted" initialOpen />);
    await screen.findByText("This scene is available for in-app replay only.");
    expect(screen.queryByRole("button", { name: "Generate video" })).toBeNull();
    expect(fetchMock.mock.calls.every(([, init]) => !init?.method)).toBe(true);
  });
});

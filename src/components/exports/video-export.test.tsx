import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VideoExport, type ExportVideo } from "./video-export";

vi.mock("@/components/providers/app-provider", () => ({ useApp: () => ({ contentRating: "everyone" }) }));
const video: ExportVideo = { id: "video-1", status: "ready", includeScore: true, includeName: false, filename: "delivery-classic.mp4" };
function ok(data: unknown) { return new Response(JSON.stringify({ ok: true, data }), { headers: { "Content-Type": "application/json" } }); }
beforeEach(() => {
  vi.stubGlobal("React", React);
  Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  Object.defineProperty(navigator, "canShare", { configurable: true, value: undefined });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("finished video workflow", () => {
  it("recovers a private finished file and changes visibility options without showing the wrong preview", async () => {
    const hidden: ExportVideo = { ...video, id: "without-score", includeScore: false };
    const fetchMock = vi.fn().mockResolvedValue(ok({ eligible: true, exports: [video, hidden] }));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<VideoExport mode="classic" attemptId="owned-take" hasScore />);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Create video" }));
    await screen.findByRole("link", { name: "Download video" });
    expect(container.querySelector("video")).toHaveAttribute("src", "/api/exports/video-1/video?v=0");
    expect(screen.getByRole("link", { name: "Download video" })).toHaveAttribute("href", "/api/exports/video-1/video?download=1");
    fireEvent.click(screen.getByRole("checkbox", { name: "Score" }));
    expect(container.querySelector("video")).toHaveAttribute("src", "/api/exports/without-score/video?v=0");
    fireEvent.click(screen.getByRole("checkbox", { name: "Display name / avatar" }));
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByRole("button", { name: "Generate video" })).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("uploads an unscored local take once, queues the same saved source, and recovers it on reopening", async () => {
    const queued = { ...video, status: "queued", includeScore: false };
    const prepareAttempt = vi.fn().mockResolvedValue("saved-local");
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") return ok({ export: queued });
      if (url.startsWith("/api/exports?")) return ok({ eligible: true, exports: [queued] });
      return ok({ export: { ...queued, status: "ready" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const first = render(<VideoExport mode="switch" prepareAttempt={prepareAttempt} />);
    fireEvent.click(screen.getByRole("button", { name: "Create video" }));
    expect(screen.getByRole("checkbox", { name: /Beta score/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Generate video" }));
    await screen.findByText("Your video is queued.");
    expect(prepareAttempt).toHaveBeenCalledOnce();
    expect(JSON.parse(fetchMock.mock.calls.find(([, init]) => init?.method === "POST")![1]!.body as string)).toEqual({ mode: "switch", attemptId: "saved-local", includeScore: false, includeName: false, maxRating: "everyone" });
    expect(screen.getByRole("link", { name: "Reopen this performance" })).toHaveAttribute("href", "/switch?attempt=saved-local");
    first.unmount();
    render(<VideoExport mode="switch" attemptId="saved-local" initialOpen />);
    await screen.findByText("Your video is queued.");
    await screen.findByRole("link", { name: "Download video" }, { timeout: 4_000 });
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(fetchMock.mock.calls.every(([url]) => !url.includes("judge"))).toBe(true);
  });

  it("retries a failed export with the same saved source and selected options", async () => {
    const failed = { ...video, status: "failed", includeName: true, errorMessage: "Video creation was interrupted." };
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => init?.method === "POST" ? ok({ export: { ...failed, status: "queued" } }) : ok({ eligible: true, exports: [failed] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<VideoExport mode="classic" attemptId="kept-take" hasScore initialOpen />);
    await screen.findByRole("button", { name: "Retry video" });
    expect(screen.getByRole("checkbox", { name: "Display name / avatar" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Retry video" }));
    await screen.findByText("Your video is queued.");
    const posted = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")![1]!;
    expect(JSON.parse(posted.body as string)).toMatchObject({ attemptId: "kept-take", includeName: true, includeScore: true });
  });

  it("shares the actual preloaded MP4 on a user tap and never calls it published", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: vi.fn().mockReturnValue(true) });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/video") ? new Response(new Blob(["finished mp4"], { type: "video/mp4" })) : ok({ eligible: true, exports: [video] })));
    render(<VideoExport mode="classic" attemptId="owned" hasScore initialOpen />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Share video" })).toBeEnabled());
    expect(share).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Share video" }));
    await screen.findByText("Share menu closed. Your video is still available here.");
    const data = share.mock.calls[0]![0] as ShareData;
    expect(data.files?.[0]).toMatchObject({ name: "delivery-classic.mp4", type: "video/mp4" });
    expect(data.url).toBeUndefined();
    expect(screen.queryByText(/published/i)).toBeNull();
  });

  it("keeps unsupported sharing downloadable and explains scene eligibility without a generation request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ eligible: true, exports: [video] }));
    vi.stubGlobal("fetch", fetchMock);
    const first = render(<VideoExport mode="classic" attemptId="owned" hasScore initialOpen />);
    const fallback = await screen.findByRole("link", { name: "Save to share" });
    expect(fallback).toHaveAttribute("href", "/api/exports/video-1/video?download=1");
    expect(fallback).toHaveAttribute("download", "delivery-classic.mp4");
    first.unmount();
    fetchMock.mockResolvedValue(ok({ eligible: false, reason: "This scene is available for in-app replay only.", exports: [] }));
    render(<VideoExport mode="say-it-back" attemptId="restricted-scene" initialOpen />);
    await screen.findByText("This scene is available for in-app replay only.");
    expect(screen.queryByRole("button", { name: "Generate video" })).toBeNull();
    expect(fetchMock.mock.calls.every((call) => !call[1]?.method)).toBe(true);
  });
});

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SavedAudio } from "@/components/game/saved-audio";

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("saved playback recovery", () => {
  it("keeps the source after StrictMode setup replay and stops audio on removal", () => {
    const { unmount } = render(<React.StrictMode><SavedAudio url="https://example.test/take.wav" label="Saved take" /></React.StrictMode>);
    const audio = screen.getByLabelText("Saved take");
    expect(audio).toHaveAttribute("src", "https://example.test/take.wav");
    unmount();
    expect(audio).not.toHaveAttribute("src");
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(2);
  });

  it("refreshes an expired link through the authorized route only after a click", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { audioUrl: "https://example.test/fresh.wav" } })));
    vi.stubGlobal("fetch", (url: string, options: RequestInit) => url.endsWith("?camera=manifest")
      ? Promise.resolve(new Response(JSON.stringify({ segments: [] }))) : fetchMock(url, options));
    render(<SavedAudio url="https://example.test/expired.wav" label="Saved take" refreshPath="/api/deliveries/fixture" />);
    fireEvent.error(screen.getByLabelText("Saved take"));
    expect(screen.getByRole("alert")).toHaveTextContent("link may have expired");
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reload playback" }));
    await waitFor(() => expect(screen.getByLabelText("Saved take")).toHaveAttribute("src", "https://example.test/fresh.wav"));
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/deliveries/fixture", { cache: "no-store" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows access rejection without retrying in a loop or inventing a playable URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "That take is private, expired, or lost to the timeline." } }), { status: 404 }));
    vi.stubGlobal("fetch", (url: string, options: RequestInit) => url.endsWith("?camera=manifest")
      ? Promise.resolve(new Response(JSON.stringify({ segments: [] }))) : fetchMock(url, options));
    render(<SavedAudio url="https://example.test/expired.wav" label="Shared take" refreshPath="/api/share/fixture" />);
    fireEvent.error(screen.getByLabelText("Shared take"));
    fireEvent.click(screen.getByRole("button", { name: "Reload playback" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("That take is private"));
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Shared take")).toHaveAttribute("src", "https://example.test/expired.wav");
    expect(screen.getByRole("button", { name: "Reload playback" })).toBeEnabled();
  });
});

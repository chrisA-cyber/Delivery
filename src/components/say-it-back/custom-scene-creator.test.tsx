import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SayImport } from "@/lib/say-it-back/import-types";
import { CustomSceneCreator, CustomSceneLibrary, type MySceneFilters } from "./custom-scene-creator";

const base: SayImport = {
  id: "private-import", requestId: "2b7af0a1-25fa-4f22-a548-98c25c9f4913", status: "ready", title: "The moment",
  sourceUrl: "https://clips.twitch.tv/ARealExample", sourceDuration: 100, sourceVideoUrl: "/api/private-source",
  start: 20, end: 40, error: null, createdAt: "2026-09-07T00:00:00Z",
  cues: [{ id: "line-a", text: "Original words", start: 1, end: 3, selected: true }],
};
const ok = (data: unknown) => ({ ok: true, json: async () => ({ ok: true, data }) });

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("custom Say It Back scene creation", () => {
  it("keeps edited dialogue and selection when publishing fails, then opens the created scene", async () => {
    const created = { id: "custom-scene", title: "My scene" };
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ ok: false, error: { message: "Connection interrupted" } }) })
      .mockResolvedValueOnce(ok({ clip: created }));
    vi.stubGlobal("fetch", fetch);
    const onCreated = vi.fn();
    render(<CustomSceneCreator initialImport={base} initialRating="everyone" onCreated={onCreated} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Line 1 dialogue"), { target: { value: "Corrected dialogue" } });
    fireEvent.change(screen.getByLabelText("Scene title"), { target: { value: "My scene" } });
    fireEvent.click(screen.getByRole("button", { name: "Create scene & record" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Connection interrupted");
    expect(screen.getByLabelText("Line 1 dialogue")).toHaveValue("Corrected dialogue");
    fireEvent.click(screen.getByRole("button", { name: "Create scene & record" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
    expect(JSON.parse(fetch.mock.calls[1]![1].body)).toEqual({ title: "My scene", rating: "everyone", cues: [{ ...base.cues[0], text: "Corrected dialogue" }] });
  });

  it("previews line times relative to the excerpt while keeping publish timestamps relative", async () => {
    const { container } = render(<CustomSceneCreator initialImport={base} initialRating="everyone" onCreated={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Listen to line 1" }));
    expect(container.querySelector("video")!.currentTime).toBe(21);
    expect(screen.getByLabelText("Line 1 start")).toHaveValue(1);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
  });

  it("limits the initial excerpt to 45 seconds and sends the chosen source interval", async () => {
    const fetch = vi.fn().mockResolvedValue(ok({ import: { ...base, status: "processing" } }));
    vi.stubGlobal("fetch", fetch);
    render(<CustomSceneCreator initialImport={{ ...base, status: "source-ready", start: 0, end: 100, cues: [] }} initialRating="everyone" onCreated={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByLabelText("End (seconds)")).toHaveValue(45);
    fireEvent.change(screen.getByLabelText("Start (seconds)"), { target: { value: "30" } });
    expect(screen.getByLabelText("End (seconds)")).toHaveValue(75);
    fireEvent.click(screen.getByRole("button", { name: "Prepare lines" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({ start: 30, end: 75 });
  });

  it("stops polling once the source can be edited", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValue(ok({ import: { ...base, status: "source-ready", cues: [] } }));
    vi.stubGlobal("fetch", fetch);
    render(<CustomSceneCreator initialImport={{ ...base, status: "fetching", sourceVideoUrl: null }} initialRating="everyone" onCreated={vi.fn()} onClose={vi.fn()} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(screen.getByRole("button", { name: "Prepare lines" })).toBeEnabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    expect(fetch).toHaveBeenCalledOnce();
  });
});

describe("My scenes filters", () => {
  it("combines dialogue search with status and recovers from no matches", async () => {
    const imports: SayImport[] = [base, { ...base, id: "failed-import", title: "Failed scene", status: "failed" }, { ...base, id: "other-import", title: "Different scene", cues: [] }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ imports })));
    const onResume = vi.fn();
    function Library() {
      const [filters, setFilters] = React.useState<MySceneFilters>({ search: "", status: "all" });
      return <CustomSceneLibrary rating="everyone" authenticated={false} filters={filters} onFiltersChange={setFilters} onCreate={vi.fn()} onResume={onResume} onPlay={vi.fn()} />;
    }
    render(<Library />);
    await screen.findByRole("heading", { name: "Different scene" });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search my scenes" }), { target: { value: "original words" } });
    fireEvent.change(screen.getByRole("combobox", { name: "My scene status" }), { target: { value: "attention" } });
    expect(screen.queryByRole("heading", { name: base.title })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Different scene" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue", exact: true }));
    expect(onResume).toHaveBeenCalledWith(imports[1]);
    fireEvent.change(screen.getByRole("combobox", { name: "My scene status" }), { target: { value: "published" } });
    expect(screen.getByRole("heading", { name: "No scenes match your filters" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all my scenes" }));
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });
});

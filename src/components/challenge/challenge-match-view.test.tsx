import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContentRating } from "@/data/content";
import { ChallengeMatchView } from "@/components/challenge/challenge-match-view";

vi.mock("@/components/providers/app-provider", () => ({
  useApp: () => {
    const [contentRating, setRating] = React.useState<ContentRating>("everyone");
    return { contentRating, updatePreferences: ({ contentRating }: { contentRating: ContentRating }) => setRating(contentRating) };
  },
}));
// Explicit-consent modal behavior is exercised by supporting-ui.spec.ts. This
// test isolates the match gate and makes changing the preference deterministic.
vi.mock("@/components/content/content-control", () => ({
  ContentControl: ({ onChange }: { onChange: (value: ContentRating) => void }) => <div><button onClick={() => onChange("mature")}>Enable mature fixture</button><button onClick={() => onChange("everyone")}>Return to clean fixture</button></div>,
}));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const entries = [{ entrantId: "fixture-user", displayName: "Local match fixture", handle: "local_fixture", deliveryId: "fixture-take", createdAt: "2026-09-05", audioUrl: "https://example.test/consented-fixture.wav", overall: 80, commitment: 80, comedy: 80, accuracy: 80, chaos: 80, headline: "Protected fixture headline", verdict: "Protected mature fixture verdict" }];

describe("challenge result content consent", () => {
  it.each([false, true])("gates verdict and audio for complete=%s, then stops playback when lowered", (complete) => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    const load = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
    const { container } = render(<ChallengeMatchView entries={entries} complete={complete} invitePath="/challenge/fixture" currentUserId="fixture-user" rating="mature" />);
    expect(screen.getByText("This matchup is behind your filter.")).toBeVisible();
    expect(screen.queryByText("Protected mature fixture verdict")).not.toBeInTheDocument();
    expect(screen.queryByText("Protected fixture headline")).not.toBeInTheDocument();
    expect(container.querySelector("audio")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Enable mature fixture" }));
    expect(screen.getByText("Protected mature fixture verdict")).toBeVisible();
    expect(container.querySelector("audio")).toHaveAttribute("src", entries[0]!.audioUrl);
    fireEvent.click(screen.getByRole("button", { name: "Return to clean fixture" }));
    expect(screen.queryByText("Protected mature fixture verdict")).not.toBeInTheDocument();
    expect(container.querySelector("audio")).toBeNull();
    expect(pause).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledOnce();
  });
});

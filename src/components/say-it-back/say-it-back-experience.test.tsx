import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import catalog from "@/lib/say-it-back/catalog.json";
import { SayItBackExperience } from "./say-it-back-experience";

const mocks = vi.hoisted(() => ({ reset: vi.fn(), refreshAccount: vi.fn() }));
vi.mock("@/components/providers/app-provider", () => ({
  useApp: () => {
    const [contentRating, setContentRating] = React.useState("everyone");
    return { authenticated: false, authReady: true, contentRating,
      refreshAccount: mocks.refreshAccount,
      updatePreferences: ({ contentRating: next }: { contentRating: string }) => setContentRating(next) };
  },
}));
vi.mock("@/hooks/use-audio-recorder", () => ({ useAudioRecorder: () => ({ status: "idle", reset: mocks.reset }) }));
vi.mock("./dub-player", () => ({ DubPlayer: () => <div data-testid="scene-player" /> }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("challenge content preferences", () => {
  it("keeps a Spicy challenge closed for Clean and opens it when the player enables Spicy", async () => {
    vi.stubGlobal("React", React);
    const clip = catalog.find((item) => item.rating === "teen")!;
    const challenge = { token: "disposable-test", challengerName: "Friend", clip, roleId: clip.roles[0]!.id,
      challengerAttempt: { score: null, owned: false, audioUrl: "/private-test-audio" }, recipientAttempts: [] };
    const requestedRatings: (string | null)[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const url = new URL(input, "https://delivery.test");
      if (url.pathname.endsWith("/clips")) return { ok: true, json: async () => ({ ok: true, data: { clips: [] } }) };
      const rating = url.searchParams.get("maxRating");
      requestedRatings.push(rating);
      return rating === "teen"
        ? { ok: true, json: async () => ({ ok: true, data: { challenge } }) }
        : { ok: false, json: async () => ({ ok: false, error: { message: "Enable Spicy content to play this line, or choose a clean round." } }) };
    }));

    render(<SayItBackExperience challengeToken="disposable-test" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Enable Spicy content");
    expect(requestedRatings).toEqual(["everyone"]);
    expect(screen.queryByTestId("scene-player")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Spicy", exact: true }));
    await waitFor(() => expect(screen.getByTestId("scene-player")).toBeInTheDocument());
    expect(requestedRatings).toEqual(["everyone", "teen"]);
    expect(screen.getByRole("heading", { name: /Friend set the scene/ })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

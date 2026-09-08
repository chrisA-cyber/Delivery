import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryPrompts } from "@/data/content";
import catalog from "@/lib/say-it-back/catalog.json";
import { SWITCH_CHALLENGES } from "@/lib/switch/catalog";
import { RoundBuilder } from "./round-builder";

const mocks = vi.hoisted(() => ({ api: vi.fn(), post: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("./round-api", () => ({ roundApi: mocks.api, roundPost: mocks.post }));
vi.mock("@/components/providers/app-provider", () => ({ useApp: () => ({
  authenticated: true, profile: { displayName: "Fixture host" }, contentRating: "everyone", updatePreferences: vi.fn(),
}) }));

const clip = catalog.find((item) => item.rating === "everyone")!;
const prompt = queryPrompts({ maxRating: "everyone" })[0]!;
const challenge = SWITCH_CHALLENGES.find((item) => item.rating === "everyone")!;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("React", React);
  mocks.api.mockImplementation(async (url: string) => url.includes("/clips") ? { clips: [clip] } : { challenges: [challenge] });
  mocks.post.mockResolvedValue({ round: { token: "created-fixture" } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function createRound() {
  fireEvent.change(screen.getByRole("textbox", { name: "Round name" }), { target: { value: "Fixture round" } });
  const create = screen.getByRole("button", { name: "Create friend round" });
  await waitFor(() => expect(create).toBeEnabled());
  fireEvent.click(create);
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/rounds/created-fixture"));
  return mocks.post.mock.calls[0]![1];
}

describe("Switch-first round creation preserves incoming assignments", () => {
  it("creates a new default room with the selected Switch challenge", async () => {
    render(<RoundBuilder />);
    expect(await createRound()).toMatchObject({ mode: "switch", challengeId: challenge.id, challengeVersion: challenge.version });
  });

  it("keeps an incoming Classic prompt even without a mode parameter", async () => {
    render(<RoundBuilder initialPromptId={prompt.id} />);
    expect(await createRound()).toMatchObject({ mode: "classic", promptId: prompt.id });
  });

  it("keeps an incoming scene and role even without a mode parameter", async () => {
    render(<RoundBuilder initialClipId={clip.id} initialRoleId={clip.roles[0]!.id} />);
    expect(await createRound()).toMatchObject({ mode: "say-it-back", clipId: clip.id, roleId: clip.roles[0]!.id });
  });

  it("honors an explicit mode when other assignment parameters are present", async () => {
    render(<RoundBuilder initialMode="say-it-back" initialPromptId={prompt.id} />);
    expect(await createRound()).toMatchObject({ mode: "say-it-back", clipId: clip.id });
  });

  it("rematches the previous scene and role rather than switching the assignment", async () => {
    mocks.api.mockImplementation(async (url: string) => url.includes("/clips") ? { clips: [clip] } : url.includes("/catalog") ? { challenges: [challenge] } : {
      round: { name: "Previous fixture", members: [], viewerMemberId: "host", assignment: { mode: "say-it-back", clip, roleId: clip.roles[0]!.id, rating: "everyone" } },
    });
    render(<RoundBuilder previousToken="previous-fixture" />);
    const create = await screen.findByRole("button", { name: "Create the next round" });
    await waitFor(() => expect(create).toBeEnabled());
    fireEvent.click(create);
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith("/api/rounds/previous-fixture/rematch", expect.objectContaining({
      name: "Previous fixture · again", mode: "say-it-back", clipId: clip.id, roleId: clip.roles[0]!.id,
    })));
  });
});

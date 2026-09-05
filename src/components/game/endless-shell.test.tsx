import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JudgeResult, Prompt } from "@/types/game";
import { EndlessShell } from "@/components/game/endless-shell";

const fixture = vi.hoisted(() => ({ source: "ai", score: 80 }));
vi.mock("@/components/game/game-experience", () => ({
  GameExperience: ({ onJudged }: { onJudged: (result: JudgeResult) => void }) => <button onClick={() => onJudged({ source: fixture.source, scores: { overall: fixture.score } } as JudgeResult)}>Complete fixture round</button>,
}));
afterEach(() => cleanup());
const prompt: Prompt = { id: "fixture", line: "Test line.", energy: "Test direction.", category: "wildcard", difficulty: 1 };
function statistic(label: string) { return screen.getByText(label).parentElement?.querySelector("dd")?.textContent; }

describe("Hot Streak session counters", () => {
  it("keeps synthetic preview scores out of judged rounds, bests, and streaks", () => {
    fixture.source = "fallback"; fixture.score = 100;
    render(<EndlessShell prompt={prompt} />);
    fireEvent.click(screen.getByRole("button", { name: "Complete fixture round" }));
    expect(statistic("Judged rounds")).toBe("0");
    expect(statistic("Session best")).toBe("—");
    expect(statistic("Hot streak")).toBe("0");
    expect(screen.getByRole("status")).toHaveTextContent("Synthetic judging does not count");
  });

  it("counts live-result contracts and breaks the local streak below 70", () => {
    fixture.source = "ai"; fixture.score = 80;
    render(<EndlessShell prompt={prompt} />);
    fireEvent.click(screen.getByRole("button", { name: "Complete fixture round" }));
    expect(statistic("Judged rounds")).toBe("1");
    expect(statistic("Hot streak")).toBe("1");
    fixture.score = 69;
    fireEvent.click(screen.getByRole("button", { name: "Complete fixture round" }));
    expect(statistic("Judged rounds")).toBe("2");
    expect(statistic("Session best")).toBe("80");
    expect(statistic("Hot streak")).toBe("0");
  });
});

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpeechAvatar } from "./speech-avatar";

const preferences = vi.hoisted(() => ({ reducedMotion: false, systemReduced: false }));
vi.mock("@/components/providers/app-provider", () => ({ useApp: () => preferences }));
beforeEach(() => {
  vi.stubGlobal("React", React);
  preferences.reducedMotion = false;
  preferences.systemReduced = false;
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: preferences.systemReduced, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("speaking character artwork", () => {
  it("moves the character with speech and returns to the resting pose in silence", () => {
    const avatar = { kind: "builtin", id: "fox" } as const;
    const { container, rerender } = render(<SpeechAvatar avatar={avatar} level={0} />);
    const pose = () => container.querySelector("image")!.closest("g")!.getAttribute("transform");
    const resting = pose();
    rerender(<SpeechAvatar avatar={avatar} level={1} />);
    expect(pose()).not.toBe(resting);
    expect(container.querySelector("image")).toHaveAttribute("href", "/avatars/fox.webp");
    expect(screen.getByRole("img")).toHaveAttribute("data-speaking", "true");
    rerender(<SpeechAvatar avatar={avatar} level={0} />);
    expect(pose()).toBe(resting);
  });

  it.each(["reducedMotion", "systemReduced"] as const)("keeps the character still with %s while indicating speech", (preference) => {
    preferences[preference] = true;
    const avatar = { kind: "builtin", id: "cloud" } as const;
    const { container, rerender } = render(<SpeechAvatar avatar={avatar} level={0} />);
    const resting = container.querySelector("image")!.closest("g")!.getAttribute("transform");
    rerender(<SpeechAvatar avatar={avatar} level={1} />);
    expect(container.querySelector("image")!.closest("g")!.getAttribute("transform")).toBe(resting);
    expect(screen.getByRole("img")).toHaveAttribute("data-speaking", "true");
  });
});

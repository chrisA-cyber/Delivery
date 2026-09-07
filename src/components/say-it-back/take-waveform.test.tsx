import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TakeWaveform } from "./take-waveform";

vi.mock("@/lib/say-it-back/audio-timeline", () => ({
  loadReferenceWaveform: vi.fn().mockResolvedValue([{ time: 2.1, peak: 0.4 }]),
  measureTakeWaveform: vi.fn(),
}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("updates measured live input in the selected line while retaining the original waveform", async () => {
  vi.stubGlobal("React", React);
  const props = { referenceUrl: "/reference.wav", duration: 4, rangeStart: 2, rangeEnd: 4, playhead: 2.2, liveStart: 1.9, recording: true };
  const { container, rerender } = render(<TakeWaveform {...props} liveWaveform={[{ time: 0.3, peak: 0.1 }]} level={0.1} />);
  const paths = () => container.querySelectorAll("svg path");
  await waitFor(() => expect(paths()[1]!.getAttribute("d")).not.toBe(""));
  const reference = paths()[1]!.getAttribute("d");
  const before = paths()[2]!.getAttribute("d");
  rerender(<TakeWaveform {...props} liveWaveform={[{ time: 0.3, peak: 0.1 }, { time: 0.4, peak: 0.7 }]} level={0.7} />);
  expect(paths()[1]!.getAttribute("d")).toBe(reference);
  expect(paths()[2]!.getAttribute("d")).not.toBe(before);
  expect(paths()[2]!.getAttribute("d")).toContain("M150.0");
  expect(screen.getByRole("meter", { name: "Microphone level" })).toHaveAttribute("aria-valuenow", "70");
  expect(screen.getByText("Your voice · live")).toBeInTheDocument();
});

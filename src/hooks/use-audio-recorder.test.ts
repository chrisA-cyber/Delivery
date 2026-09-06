import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_RECORDING_BYTES, MAX_RECORDING_MS } from "@/lib/audio-capture";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";

class FakeTrack extends EventTarget {
  readyState = "live";
  muted = false;
  stop = vi.fn(() => { this.readyState = "ended"; });
}

class FakeStream {
  track = new FakeTrack();
  getTracks = () => [this.track];
  getAudioTracks = () => [this.track];
}

class FakeNode {
  connect = vi.fn();
  disconnect = vi.fn();
  gain = { value: 1 };
  onaudioprocess: ((event: { inputBuffer: { getChannelData: (channel: number) => Float32Array } }) => void) | null = null;
}

class FakeAudioContext extends EventTarget {
  static instances: FakeAudioContext[] = [];
  static nextResume: (() => Promise<void>) | null = null;
  static rate = 48_000;
  sampleRate = FakeAudioContext.rate;
  state = "suspended";
  source = new FakeNode();
  processor = new FakeNode();
  gainNode = new FakeNode();
  destination = new FakeNode();
  resume = vi.fn(async () => {
    if (FakeAudioContext.nextResume) await FakeAudioContext.nextResume();
    if (this.state !== "closed") this.state = "running";
  });
  close = vi.fn(async () => { this.state = "closed"; });
  createMediaStreamSource = vi.fn(() => this.source);
  createScriptProcessor = vi.fn(() => this.processor);
  createGain = vi.fn(() => this.gainNode);
  constructor() { super(); FakeAudioContext.instances.push(this); }
  push(samples: number, amplitude = 0.1) {
    this.processor.onaudioprocess?.({ inputBuffer: { getChannelData: () => new Float32Array(samples).fill(amplitude) } });
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const getUserMedia = vi.fn();
let stream: FakeStream;
let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  FakeAudioContext.instances = [];
  FakeAudioContext.nextResume = null;
  FakeAudioContext.rate = 48_000;
  stream = new FakeStream();
  getUserMedia.mockReset().mockResolvedValue(stream);
  vi.stubGlobal("AudioContext", FakeAudioContext);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  createObjectURL = vi.fn(() => "blob:local-take");
  revokeObjectURL = vi.fn();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function record() {
  const hook = renderHook(() => useAudioRecorder());
  await act(async () => { expect(await hook.result.current.start()).toBe(true); });
  const context = FakeAudioContext.instances[0]!;
  return { ...hook, context };
}

describe("microphone capture lifecycle", () => {
  it("guards overlapping starts before permission resolves and captures only audio", async () => {
    const permission = deferred<MediaStream>();
    getUserMedia.mockReturnValue(permission.promise);
    const { result } = renderHook(() => useAudioRecorder());
    let first!: Promise<boolean>;
    await act(async () => {
      first = result.current.start();
      expect(await result.current.start()).toBe(false);
    });
    expect(result.current.status).toBe("requesting");
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ video: false }));
    await act(async () => { permission.resolve(stream as unknown as MediaStream); expect(await first).toBe(true); });
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(result.current.status).toBe("recording");
    expect(FakeAudioContext.instances[0]!.gainNode.gain.value).toBe(0);
  });

  it.each(["stop", "reset", "unmount"] as const)("releases a late permission grant after %s", async (action) => {
    const permission = deferred<MediaStream>();
    getUserMedia.mockReturnValue(permission.promise);
    const { result, unmount } = renderHook(() => useAudioRecorder());
    let pending!: Promise<boolean>;
    await act(async () => { pending = result.current.start(); });
    act(() => { if (action === "unmount") unmount(); else result.current[action](); });
    await act(async () => { permission.resolve(stream as unknown as MediaStream); expect(await pending).toBe(false); });
    expect(stream.track.stop).toHaveBeenCalledTimes(1);
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it("releases a pending audio context when reset happens during resume", async () => {
    const resume = deferred<void>();
    FakeAudioContext.nextResume = () => resume.promise;
    const { result } = renderHook(() => useAudioRecorder());
    let pending!: Promise<boolean>;
    await act(async () => { pending = result.current.start(); });
    act(() => result.current.reset());
    expect(FakeAudioContext.instances[0]!.close).toHaveBeenCalledTimes(1);
    await act(async () => { resume.resolve(); expect(await pending).toBe(false); });
    expect(stream.track.stop).toHaveBeenCalledTimes(1);
    expect(FakeAudioContext.instances[0]!.close).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("idle");
  });

  it("closes an audio context whose pending resume rejects after unmount", async () => {
    const resume = deferred<void>();
    FakeAudioContext.nextResume = () => resume.promise;
    const { result, unmount } = renderHook(() => useAudioRecorder());
    let pending!: Promise<boolean>;
    await act(async () => { pending = result.current.start(); });
    unmount();
    await act(async () => { resume.reject(new Error("Device removed")); expect(await pending).toBe(false); });
    expect(FakeAudioContext.instances[0]!.close).toHaveBeenCalledTimes(1);
    expect(stream.track.stop).toHaveBeenCalledTimes(1);
  });

  it("saves short audio for replay and releases every resource on an immediate stop", async () => {
    const { result, context } = await record();
    act(() => { context.push(4_800); result.current.stop(); });
    expect(result.current.status).toBe("stopped");
    expect(result.current.durationMs).toBe(100);
    expect(result.current.audioBlob?.type).toBe("audio/wav");
    expect(result.current.audioBlob?.size).toBe(9_644);
    expect(result.current.quality).toBe("too-short");
    expect(result.current.canSubmit).toBe(false);
    expect(stream.track.stop).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(context.source.disconnect).toHaveBeenCalledTimes(1);
    expect(context.processor.disconnect).toHaveBeenCalledTimes(1);
    expect(context.gainNode.disconnect).toHaveBeenCalledTimes(1);
    expect(context.processor.onaudioprocess).toBeNull();
    act(() => { result.current.stop(); vi.advanceTimersByTime(25_000); });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(stream.track.stop).toHaveBeenCalledTimes(1);
  });

  it("releases the microphone even when no audio frame has arrived", async () => {
    const { result, context } = await record();
    act(() => result.current.stop());
    expect(result.current.status).toBe("error");
    expect(result.current.quality).toBe("empty");
    expect(result.current.error).toContain("No audio arrived");
    expect(result.current.audioBlob).toBeNull();
    expect(stream.track.stop).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
  });

  it("keeps the previous take when a retake is interrupted before its first frame", async () => {
    const { result, context } = await record();
    act(() => { context.push(48_000); result.current.stop(); });
    const savedBlob = result.current.audioBlob;
    stream = new FakeStream();
    getUserMedia.mockResolvedValue(stream);
    await act(async () => { expect(await result.current.start()).toBe(true); });
    act(() => stream.track.dispatchEvent(new Event("ended")));
    expect(result.current.audioBlob).toBe(savedBlob);
    expect(result.current.audioUrl).toBe("blob:local-take");
    expect(result.current.durationMs).toBe(1_000);
    expect(result.current.canSubmit).toBe(true);
    expect(result.current.status).toBe("stopped");
    expect(result.current.error).toContain("previous take is still here");
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it("restores the prior take and technical fields after unsynchronized startup already stopped with PCM", async () => {
    createObjectURL.mockReturnValueOnce("blob:previous").mockReturnValueOnce("blob:startup-partial");
    const { result, context } = await record();
    act(() => { context.push(48_000, 0.003); result.current.stop(); });
    const savedBlob = result.current.audioBlob;
    const savedMessage = result.current.qualityMessage;
    stream = new FakeStream();
    getUserMedia.mockResolvedValue(stream);
    await act(async () => { expect(await result.current.start({ preservePreviousTake: true })).toBe(true); });
    act(() => {
      FakeAudioContext.instances[1]!.push(24_000);
      stream.track.dispatchEvent(new Event("ended"));
    });
    expect(result.current.audioUrl).toBe("blob:startup-partial");
    expect(revokeObjectURL).not.toHaveBeenCalledWith("blob:previous");
    act(() => result.current.cancelCapture());
    expect(result.current.audioBlob).toBe(savedBlob);
    expect(result.current.audioUrl).toBe("blob:previous");
    expect(result.current.durationMs).toBe(1_000);
    expect(result.current.quality).toBe("quiet");
    expect(result.current.qualityMessage).toBe(savedMessage);
    expect(result.current.stopReason).toBe("user");
    expect(result.current.warning).toBeNull();
    expect(result.current.canSubmit).toBe(true);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:startup-partial");
    expect(revokeObjectURL).not.toHaveBeenCalledWith("blob:previous");
  });

  it("preserves prior state on startup cancel, then keeps normal interrupted audio after sync is committed", async () => {
    createObjectURL.mockReturnValueOnce("blob:previous").mockReturnValueOnce("blob:committed-partial");
    const { result, context } = await record();
    act(() => { context.push(48_000); result.current.stop(); });
    const savedBlob = result.current.audioBlob;
    stream = new FakeStream();
    getUserMedia.mockResolvedValue(stream);
    await act(async () => { await result.current.start({ preservePreviousTake: true }); });
    act(() => {
      FakeAudioContext.instances[1]!.push(4_800);
      result.current.cancelCapture();
    });
    expect(result.current.audioBlob).toBe(savedBlob);
    expect(result.current.durationMs).toBe(1_000);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    stream = new FakeStream();
    getUserMedia.mockResolvedValue(stream);
    await act(async () => { await result.current.start({ preservePreviousTake: true }); });
    act(() => {
      FakeAudioContext.instances[2]!.push(24_000);
      result.current.commitCapture();
      stream.track.dispatchEvent(new Event("ended"));
    });
    expect(result.current.audioUrl).toBe("blob:committed-partial");
    expect(result.current.durationMs).toBe(500);
    expect(result.current.stopReason).toBe("interrupted");
    expect(result.current.warning).toContain("interrupted");
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:previous");
  });

  it("keeps quiet audible takes submittable and identifies digital silence", async () => {
    const { result, context } = await record();
    act(() => { context.push(48_000, 0.003); result.current.stop(); });
    expect(result.current.quality).toBe("quiet");
    expect(result.current.canSubmit).toBe(true);
    expect(result.current.qualityMessage).toContain("quiet take is welcome");
    stream = new FakeStream();
    getUserMedia.mockResolvedValue(stream);
    await act(async () => { await result.current.start(); });
    act(() => { FakeAudioContext.instances[1]!.push(48_000, 0); result.current.stop(); });
    expect(result.current.quality).toBe("silent");
    expect(result.current.canSubmit).toBe(false);
    expect(result.current.audioUrl).toBe("blob:local-take");
  });

  it("reports actual input level, sample duration, and clipping independently", async () => {
    const { result, context } = await record();
    act(() => context.push(4_800, 0.2));
    expect(result.current.level).toBeGreaterThan(0.8);
    expect(result.current.isClipping).toBe(false);
    expect(result.current.durationMs).toBe(100);
    act(() => context.push(4_800, 0.999));
    expect(result.current.isClipping).toBe(true);
    act(() => result.current.stop());
    expect(result.current.level).toBe(0);
    expect(result.current.isClipping).toBe(false);
  });

  it("exposes bounded live PCM peaks and restores them when a line redo is canceled", async () => {
    const { result, context } = await record();
    act(() => { context.push(2_400, 0.1); context.push(2_400, 0.5); });
    expect(result.current.waveform.map((point) => point.time)).toEqual([0, 0.025, 0.05, 0.075]);
    expect(result.current.waveform[0]!.peak).toBeCloseTo(0.1);
    expect(result.current.waveform[2]!.peak).toBeCloseTo(0.5);
    act(() => result.current.stop());
    const previous = result.current.waveform;
    stream = new FakeStream();
    getUserMedia.mockResolvedValue(stream);
    await act(async () => { await result.current.start({ preservePreviousTake: true }); });
    act(() => FakeAudioContext.instances[1]!.push(1_200, 0.3));
    expect(result.current.waveform).toHaveLength(1);
    act(() => result.current.cancelCapture());
    expect(result.current.waveform).toEqual(previous);
    act(() => result.current.reset());
    expect(result.current.waveform).toEqual([]);
  });

  it("trims a crossing audio block to exactly 20 seconds without a UI timer", async () => {
    const { result, context } = await record();
    act(() => context.push(48_000 * 21));
    expect(result.current.durationMs).toBe(MAX_RECORDING_MS);
    expect(result.current.waveform).toHaveLength(800);
    expect(result.current.audioBlob?.size).toBe(44 + 48_000 * 20 * 2);
    expect(result.current.stopReason).toBe("limit");
    expect(result.current.status).toBe("stopped");
    expect(stream.track.stop).toHaveBeenCalledOnce();
  });

  it("enforces the byte cap independently of an unexpected input sample rate", async () => {
    FakeAudioContext.rate = 1_000_000;
    const { result, context } = await record();
    act(() => context.push(8_000_000));
    expect(result.current.audioBlob?.size).toBe(MAX_RECORDING_BYTES);
    expect(result.current.stopReason).toBe("size-limit");
    expect(result.current.durationMs).toBeLessThan(MAX_RECORDING_MS);
  });

  it("stops a stalled capture at the wall-clock deadline", async () => {
    const { result, context } = await record();
    act(() => { context.push(48_000); vi.advanceTimersByTime(MAX_RECORDING_MS); });
    expect(result.current.status).toBe("stopped");
    expect(result.current.durationMs).toBe(1_000);
    expect(result.current.stopReason).toBe("limit");
    expect(stream.track.stop).toHaveBeenCalledOnce();
  });

  it.each(["track-ended", "context-suspended", "pagehide"] as const)("preserves an interrupted take after %s", async (event) => {
    const { result, context } = await record();
    act(() => {
      context.push(48_000);
      if (event === "track-ended") stream.track.dispatchEvent(new Event("ended"));
      else if (event === "context-suspended") { context.state = "suspended"; context.dispatchEvent(new Event("statechange")); }
      else window.dispatchEvent(new Event("pagehide"));
    });
    expect(result.current.status).toBe("stopped");
    expect(result.current.canSubmit).toBe(true);
    expect(result.current.warning).toContain("saved");
    expect(stream.track.stop).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
  });

  it("allows transient mute recovery, then saves on a persistent mute", async () => {
    const { result, context } = await record();
    act(() => {
      context.push(48_000);
      stream.track.dispatchEvent(new Event("mute"));
      vi.advanceTimersByTime(500);
      stream.track.dispatchEvent(new Event("unmute"));
      vi.advanceTimersByTime(600);
    });
    expect(result.current.status).toBe("recording");
    act(() => { stream.track.dispatchEvent(new Event("mute")); vi.advanceTimersByTime(1_000); });
    expect(result.current.stopReason).toBe("interrupted");
    expect(result.current.canSubmit).toBe(true);
  });

  it.each([
    ["NotAllowedError", "access is blocked"],
    ["NotFoundError", "No microphone was found"],
    ["NotReadableError", "microphone is unavailable"],
  ])("explains %s without discarding an existing take", async (name, message) => {
    const { result, context } = await record();
    act(() => { context.push(48_000); result.current.stop(); });
    const savedBlob = result.current.audioBlob;
    getUserMedia.mockRejectedValue(new DOMException("Unavailable", name));
    await act(async () => { expect(await result.current.start()).toBe(false); });
    expect(result.current.error).toContain(message);
    expect(result.current.audioBlob).toBe(savedBlob);
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it("can retry after a synchronous permission failure", async () => {
    getUserMedia.mockImplementationOnce(() => { throw new DOMException("Missing device", "NotFoundError"); });
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => { expect(await result.current.start()).toBe(false); });
    await act(async () => { expect(await result.current.start()).toBe(true); });
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it("reuses a context unlocked by the initial gesture after a scene countdown", async () => {
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => { result.current.primeAudioContext(); });
    const primed = FakeAudioContext.instances[0]!;
    expect(primed.state).toBe("running");
    await act(async () => { vi.advanceTimersByTime(3_000); expect(await result.current.start()).toBe(true); });
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(result.current.getCapturePositionMs()).toBeNull();
    act(() => primed.push(4_096));
    expect(result.current.getCapturePositionMs()).toBeCloseTo(4_096 / 48);
    act(() => result.current.reset());
    expect(primed.state).toBe("closed");
  });

  it("revokes discarded playback URLs and removes interruption listeners", async () => {
    const { result, context, unmount } = await record();
    act(() => { context.push(48_000); result.current.stop(); result.current.reset(); });
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-take");
    act(() => { stream.track.dispatchEvent(new Event("ended")); window.dispatchEvent(new Event("pagehide")); });
    expect(result.current.status).toBe("idle");
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

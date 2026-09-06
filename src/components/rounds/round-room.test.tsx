import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GroupMember, GroupPerformance, GroupRound } from "@/lib/groups/types";
import type { ContentRating } from "@/lib/content/types";
import { SWITCH_CHALLENGES } from "@/lib/switch/catalog";
import type { SwitchScore } from "@/lib/switch/types";
import type { SayClip, SayScore } from "@/lib/say-it-back/types";
import { RoundRoom } from "./round-room";

const mocks = vi.hoisted(() => ({ round: null as GroupRound | null, rating: "everyone" as ContentRating, act: vi.fn(), refresh: vi.fn(), replace: vi.fn(), seek: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("./use-round", () => ({ useRound: () => ({ round: mocks.round, loading: false, error: null, busy: "", act: mocks.act, refresh: mocks.refresh }) }));
vi.mock("@/components/providers/app-provider", () => ({ useApp: () => ({ authenticated: false, profile: { displayName: "UI fixture guest" }, contentRating: mocks.rating, updatePreferences: vi.fn() }) }));
vi.mock("@/components/say-it-back/dub-player", () => ({ DubPlayer: ({ clip, takeUrl, takeLabel }: { clip: SayClip; takeUrl?: string; takeLabel?: string }) => <div data-testid="scene-playback" data-source={takeUrl ?? clip.videoUrl}>{takeLabel ?? "Original fixture scene"}</div> }));
vi.mock("@/components/game/saved-audio", () => ({ SavedAudio: ({ url }: { url: string }) => <div data-testid="classic-playback" data-source={url} /> }));

vi.mock("@/components/switch/switch-player", async () => {
  const React = await import("react");
  return { SwitchPlayer: React.forwardRef(function FixtureSwitchPlayer({ audioUrl }: { audioUrl: string }, ref) {
    React.useImperativeHandle(ref, () => ({ seek: mocks.seek }));
    return <div data-testid="switch-playback" data-source={audioUrl} />;
  }) };
});

// Deliberately synthetic UI fixtures. Nothing is uploaded or represented as a
// live provider result; these values exercise visibility and comparison only.
const clip: SayClip = {
  id: "ui-fixture-scene", version: "ui-v1", title: "UI fixture exchange", description: "A synthetic scene for UI tests.",
  duration: 4, difficulty: "easy", rating: "everyone", category: "Fixture", tags: [],
  videoUrl: "/fixtures/original.mp4", posterUrl: "/fixtures/poster.jpg",
  roles: [{ id: "lead", name: "Lead", description: "Fixture role", muteIntervals: [{ start: 0, end: 4 }] }],
  cues: [{ id: "one", roleId: "lead", text: "Fixture one.", start: 0.2, end: 1.5 }, { id: "two", roleId: "lead", text: "Fixture two.", start: 2.2, end: 3.5 }],
  source: { title: "UI fixtures", creator: "Delivery tests", url: "https://example.test/fixture", license: "Test data", licenseUrl: "https://example.test/fixture", attribution: "Synthetic test fixture", reuseNote: "Not a playable catalog entry", excerptStart: 0, excerptEnd: 4 },
};

function fixtureScore(overall: number, wordsOnly = false): SayScore {
  return { version: "say-match-v1.2", overall, words: overall, timing: wordsOnly ? null : overall, rhythm: wordsOnly ? null : overall, delivery: null,
    weights: { words: wordsOnly ? 1 : 0.5, timing: wordsOnly ? 0 : 0.3, rhythm: wordsOnly ? 0 : 0.2, delivery: 0 }, transcript: "UI fixture transcript", observations: [], coachNote: "Synthetic UI fixture, not a live score.", limitations: [],
    evidence: { substitutions: 0, omissions: 0, additions: 0, expectedWords: 4, matchedWords: 4, meanStartErrorMs: wordsOnly ? null : 0, phrases: [], transcriptionModel: "ui-fixture-only", audioHash: "ui-fixture-only" } };
}

function performance(sourceId: string, memberId = "me", score: SayScore | null = null): GroupPerformance {
  return { takeId: sourceId, memberId, mode: "say-it-back", audioUrl: `/fixtures/${sourceId}.wav`, durationMs: 4000, submittedAt: null,
    canSubmit: true, sharingStatus: score ? "approved" : "unreviewed", score, scoreGroup: !score ? "unscored" : score.timing == null ? "words-only" : "full-match",
    sayAttempt: { id: sourceId, mode: "say-it-back", clip, roleId: "lead", status: score ? "scored" : "ready", score, audioUrl: `/fixtures/${sourceId}.wav`, audioExpiresAt: "2026-09-07T01:00:00Z", durationMs: 4000, recordingOffsetMs: 0, scoringVersion: "say-match-v1.2", createdAt: "2026-09-06T12:00:00Z", saved: false, owned: memberId === "me" } };
}

function member(id: string, displayName: string, take: GroupPerformance | null = null): GroupMember {
  return { id, displayName, isHost: id === "me", isYou: id === "me", submitted: Boolean(take), joinedAt: "2026-09-06T12:00:00Z", votes: 0, performance: take };
}

function round(overrides: Partial<GroupRound> = {}): GroupRound {
  return { id: "ui-round", token: "ui-token", name: "UI fixture friends", url: "/rounds/ui-token", state: "open",
    assignment: { mode: "say-it-back", clip, roleId: "lead", rating: "everyone", scoringVersion: "say-match-v1.2" },
    createdAt: "2026-09-06T12:00:00Z", closesAt: "2026-09-07T12:00:00Z", closedAt: null, replayUntil: "2026-09-14T12:00:00Z", inviteRevoked: false,
    maxMembers: 12, members: [member("me", "Fixture host")], submittedCount: 0, viewerMemberId: "me", isHost: true, isGuest: true,
    canJoin: false, canClaim: false, viewerVoteMemberId: null, previousRoundId: null, yourTakes: [], ...overrides };
}

beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("React", React); mocks.rating = "everyone"; mocks.round = round(); mocks.refresh.mockResolvedValue(undefined); mocks.act.mockImplementation(async () => mocks.round); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("private group round UI boundaries", () => {
  it("never mounts another performance before reveal even if a stale client object contains it", () => {
    const privateTake = performance("own-private");
    mocks.round = round({ yourTakes: [privateTake], members: [member("me", "Fixture host"), member("friend", "Fixture friend", performance("friend-secret", "friend", fixtureScore(99)))], submittedCount: 1 });
    render(<RoundRoom token="ui-token" />);
    expect(screen.getByText("Fixture friend")).toBeInTheDocument();
    const sources = screen.getAllByTestId("scene-playback").map((element) => element.getAttribute("data-source"));
    expect(sources).toContain("/fixtures/own-private.wav");
    expect(sources).not.toContain("/fixtures/friend-secret.wav");
    expect(screen.queryByRole("region", { name: "Group performances" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("requires fresh consent when choosing a replacement draft and submits the chosen source", async () => {
    const submitted = { ...performance("already-submitted"), takeId: "group-wrapper", submittedAt: "2026-09-06T12:01:00Z" };
    mocks.round = round({ members: [member("me", "Fixture host", submitted)], yourTakes: [performance("draft-one"), performance("draft-two")], submittedCount: 1 });
    render(<RoundRoom token="ui-token" pendingAttemptId="draft-one" />);
    const replace = screen.getByRole("button", { name: "Replace my submitted performance" });
    expect(replace).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(replace).toBeEnabled();
    fireEvent.change(screen.getByRole("combobox", { name: "Choose a different private take" }), { target: { value: "draft-two" } });
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(replace).toBeDisabled();
    expect(mocks.act).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(replace);
    await waitFor(() => expect(mocks.act).toHaveBeenCalledWith("submit", { sayAttemptId: "draft-two", consent: true }));
  });

  it("immediately unmounts stale restricted scene and voice when the content preference is lowered", () => {
    const restrictedClip = { ...clip, title: "Restricted UI fixture", rating: "teen" as const };
    mocks.rating = "teen";
    mocks.round = round({ assignment: { mode: "say-it-back", clip: restrictedClip, roleId: "lead", rating: "teen", scoringVersion: "say-match-v1.2" }, yourTakes: [performance("restricted-voice")] });
    const { rerender } = render(<RoundRoom token="ui-token" />);
    expect(screen.getByRole("heading", { name: "Restricted UI fixture" })).toBeInTheDocument();
    expect(screen.getAllByTestId("scene-playback")).toHaveLength(2);
    mocks.rating = "everyone"; // Leave the old round in cache until its fetch settles.
    rerender(<RoundRoom token="ui-token" />);
    expect(screen.getByRole("heading", { name: "Check your content setting." })).toBeInTheDocument();
    expect(screen.queryByText("Restricted UI fixture")).not.toBeInTheDocument();
    expect(screen.queryByTestId("scene-playback")).not.toBeInTheDocument();
  });

  it("separates full matches from higher words-only fixture scores after reveal", () => {
    mocks.round = round({ state: "revealed", members: [member("me", "Fixture full", performance("full", "me", fixtureScore(72))), member("friend", "Fixture words", performance("words", "friend", fixtureScore(99, true)))], submittedCount: 2 });
    render(<RoundRoom token="ui-token" />);
    const full = screen.getByRole("table", { name: "Full words, timing, and rhythm matches" });
    const words = screen.getByRole("table", { name: "Words-only results" });
    expect(within(full).getByText(/Fixture full/)).toBeInTheDocument();
    expect(within(full).queryByText("Fixture words")).not.toBeInTheDocument();
    expect(within(words).getByText("Fixture words")).toBeInTheDocument();
    expect(within(words).queryByText(/Fixture full/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fixture full posted 72." })).toBeInTheDocument();
    expect(screen.getByText(/Only one comparable score is available/)).toBeInTheDocument();
  });

  it("recognizes the submitted Say source despite its different group wrapper identity", () => {
    const source = performance("say-source");
    const submitted = { ...source, takeId: "different-group-wrapper", submittedAt: "2026-09-06T12:01:00Z" };
    mocks.round = round({ members: [member("me", "Fixture host", submitted)], yourTakes: [source], submittedCount: 1 });
    render(<RoundRoom token="ui-token" pendingAttemptId="say-source" />);
    expect(screen.getByText("Your current submission")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Replace my submitted performance" })).not.toBeInTheDocument();
  });
});

const switchChallenge = { ...SWITCH_CHALLENGES[0]!, cues: SWITCH_CHALLENGES[0]!.cues.map((cue) => ({ ...cue })) };
function switchPerformance(id: string, memberId = "me", overall: number | null = null): GroupPerformance {
  const score: SwitchScore | null = overall == null ? null : { version: switchChallenge.scoringVersion, rubricVersion: switchChallenge.rubricVersion, beta: true, ranked: false, overall, words: overall, delivery: overall, transitions: overall, transcript: "Synthetic UI fixture", segments: switchChallenge.cues.map((cue) => ({ cueId: cue.id, words: overall, delivery: overall, feedback: `Fixture feedback for ${cue.id}` })), transitionFeedback: "Synthetic transition note.", coachNote: "Synthetic retry note.", limitations: [], evidence: { source: "audio", model: "synthetic-ui-fixture", audioHash: "fixture", timing: "approximate", timingToleranceMs: 750, recordingOffsetMs: 0 } };
  return { takeId: id, memberId, mode: "switch", audioUrl: `/fixtures/${id}.wav`, durationMs: switchChallenge.duration * 1000, submittedAt: null, canSubmit: true, sharingStatus: score ? "approved" : "unreviewed", score, scoreGroup: score ? "switch-beta" : "unscored", switchAttempt: { id, mode: "switch", challenge: switchChallenge, status: score ? "scored" : "ready", score, audioUrl: `/fixtures/${id}.wav`, audioExpiresAt: "2026-09-07T01:00:00Z", durationMs: switchChallenge.duration * 1000, recordingOffsetMs: 0, scoringVersion: switchChallenge.scoringVersion, createdAt: "2026-09-06T12:00:00Z", saved: false, owned: memberId === "me" } };
}
const switchAssignment = { mode: "switch" as const, challenge: switchChallenge, rating: switchChallenge.rating, scoringVersion: switchChallenge.scoringVersion, rubricVersion: switchChallenge.rubricVersion };

describe("Switch round integrations", () => {
  it("keeps uncertain audio judgments playable without inventing a comparison score", () => {
    const uncertain = switchPerformance("switch-uncertain", "me", 75);
    const score = uncertain.score as SwitchScore;
    score.overall = null;
    score.limitations = ["Fixture audio judgment was uncertain."];
    mocks.round = round({ state: "revealed", assignment: switchAssignment, members: [member("me", "Uncertain performer", uncertain)], submittedCount: 1 });
    render(<RoundRoom token="ui-token" />);
    expect(screen.getByTestId("switch-playback")).toBeInTheDocument();
    expect(screen.getByText(/Judgment is uncertain/)).toBeInTheDocument();
    expect(screen.getByText("Fixture audio judgment was uncertain.")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Unranked Switch beta comparison" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "The show comes first." })).toBeInTheDocument();
  });

  it("submits a Switch source with fresh consent and recognizes the existing wrapper", async () => {
    const source = switchPerformance("switch-source");
    mocks.round = round({ assignment: switchAssignment, yourTakes: [source] });
    const { rerender } = render(<RoundRoom token="ui-token" pendingAttemptId="switch-source" />);
    expect(screen.getByRole("button", { name: "Submit this performance" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Submit this performance" }));
    await waitFor(() => expect(mocks.act).toHaveBeenCalledWith("submit", { switchAttemptId: "switch-source", consent: true }));
    mocks.round = round({ assignment: switchAssignment, yourTakes: [source], members: [member("me", "Switch host", { ...source, takeId: "round-wrapper", submittedAt: "2026-09-06T12:01:00Z" })], submittedCount: 1 });
    rerender(<RoundRoom token="ui-token" pendingAttemptId="switch-source" />);
    expect(screen.getByText("Your current submission")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("labels casual Switch comparison separately from the audience favorite and seeks feedback", () => {
    const host = member("me", "Switch judge leader", switchPerformance("switch-host", "me", 82));
    const friend = { ...member("friend", "Audience favorite fixture", switchPerformance("switch-friend", "friend", 70)), votes: 3 };
    mocks.round = round({ state: "revealed", assignment: switchAssignment, members: [host, friend], submittedCount: 2 });
    render(<RoundRoom token="ui-token" />);
    expect(screen.getByRole("table", { name: "Unranked Switch beta comparison" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Switch judge leader leads with 82." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Audience favorite fixture" })).toBeInTheDocument();
    const secondCue = switchChallenge.cues[1]!;
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`Jump to ${secondCue.start}s`) }));
    expect(mocks.seek).toHaveBeenCalledWith(secondCue.start);
    expect(screen.queryByRole("table", { name: "Full words, timing, and rhythm matches" })).not.toBeInTheDocument();
  });
});

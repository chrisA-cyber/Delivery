"use client";
import Link from "next/link";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { GroupRound } from "@/lib/groups/types";
import { GroupPlayback, performanceScore } from "./round-shared";
import { roundDate } from "./round-api";

type Action = (action: string, body?: Record<string, unknown>) => Promise<GroupRound | null>;
export function CommunityPanel({ round, busy, act, refresh }: { round: GroupRound; busy: string; act: Action; refresh: () => Promise<void> }) {
  const c = round.community!;
  const [preview, setPreview] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("");
  const candidates = round.members.filter((m) => m.performance);
  const selected = candidates.filter((m) => c.selectedIds.includes(m.id));
  const current = selected.find((m) => m.id === c.currentMemberId);
  const privatePreview = candidates.find((m) => m.id === preview);
  const joinUrl = new URL(`/join?code=${c.code}`, round.url).href;
  const button = (label: string, action: string, body?: Record<string, unknown>) => <button type="button" className="button-secondary" disabled={Boolean(busy)} onClick={() => { setPreview(""); void act(action, body); }}>{label}</button>;
  async function copy(value: string) { try { await navigator.clipboard.writeText(value); setNotice("Copied."); } catch { setNotice("Select and copy the link below."); } }
  return <section className="mb-7 space-y-5" aria-label={round.isHost ? "Host controls" : "Community showcase"}>
    <div className="grid gap-5 rounded-2xl border border-electric/25 bg-electric/5 p-5 sm:p-7 md:grid-cols-[1fr_auto]">
      <div><p className="mono-label text-electric">{round.isHost ? "Your control desk" : "Community round"} · {c.phase}</p><h2 className="display-type mt-3 text-4xl sm:text-5xl">{c.phase === "submissions" ? "The mic is open." : c.phase === "review" ? "Building the show." : c.phase === "showcase" ? "Let them cook." : c.phase === "voting" ? "Who delivered?" : "That’s a wrap."}</h2>
        <p className="mt-3 text-sm leading-7 text-white/70">{round.submittedCount}/{c.submissionLimit} performances · {c.participantCount} joined · {c.selectedIds.length}/12 selected</p>
        {c.phase === "submissions" && <p className="text-xs leading-6 text-white/60">Submissions close {roundDate(round.closesAt)}. You can replace your take until then.</p>}
        {c.phase === "review" && <p className="mt-2 text-sm text-white/65">Submissions are closed. The host is choosing the showcase. Your place is saved if you leave and return.</p>}
        {!round.inviteRevoked && <div className="mt-5 flex flex-wrap items-center gap-4"><span className="font-mono text-3xl font-bold tracking-[.12em]">{c.code}</span><button className="button-secondary" onClick={() => void copy(joinUrl)}>Copy join link</button></div>}
      </div>{!round.inviteRevoked && <div className="self-center rounded-xl bg-white p-3"><QRCodeSVG value={joinUrl} size={140} marginSize={2} title="Scan to join this round" /></div>}
    </div>
    {notice && <p role="status" className="text-sm text-electric">{notice}</p>}
    {round.isHost && <div className="rounded-2xl border border-white/20 bg-[#20201d] p-5 sm:p-6">
      <div className="flex flex-wrap gap-3">
        {c.displayUrl && !c.displayRevoked && <><a className="button-primary" target="_blank" rel="noreferrer" href={c.displayUrl}>Open broadcast display ↗</a><button className="button-secondary" onClick={() => void copy(c.displayUrl!)}>Copy OBS display URL</button></>}
        {c.phase === "submissions" && button("Close submissions", "close")}
        {c.phase === "review" && button("Begin showcase", "showcase")}
        {c.phase === "showcase" && c.votingEnabled && button("Open audience voting", "start-voting")}
        {["review", "showcase", "voting"].includes(c.phase) && button(c.phase === "voting" ? "End voting & reveal results" : "Finish & show results", "end-voting")}
        {c.phase === "results" && <Link className="button-primary" href={c.nextRoundUrl ?? `/rounds?from=${round.token}&community=1`}>{c.nextRoundUrl ? "Open next round" : "Set up next round"} →</Link>}
      </div>
      {c.displayUrl && <input aria-label="Read-only display URL" value={c.displayUrl} readOnly onFocus={(e) => e.target.select()} className="mt-4 min-h-11 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-xs" />}
      <p className="mt-3 text-xs leading-6 text-white/60">Use the display in OBS at 1920×1080 or 1280×720. Enable audio once in its browser. Host previews play only here; pause them before going on air. The display follows controls within a few seconds.</p>
      {c.phase === "showcase" && <div className="mt-5 border-t border-white/15 pt-5"><label className="block text-xs font-bold">On the display<select aria-label="Display performance" className="mt-2 min-h-12 w-full rounded-lg border border-white/25 bg-ink px-3" value={current?.id ?? ""} onChange={(e) => { setPreview(""); void act("display", { memberId: e.target.value, command: "pause", revision: c.revision }); }}><option value="" disabled>Choose a performance</option>{selected.map((m) => <option value={m.id} key={m.id}>{m.displayName}</option>)}</select></label><div className="mt-3 flex flex-wrap gap-2">{current && <>{button("Play", "display", { memberId: current.id, command: "play", revision: c.revision })}{button("Pause", "display", { memberId: current.id, command: "pause", revision: c.revision })}{button("Replay", "display", { memberId: current.id, command: "replay", revision: c.revision })}</>}{selected.length > 0 && button("Next / skip →", "display", { memberId: selected[(selected.findIndex((m) => m.id === current?.id) + 1) % selected.length]?.id, command: "pause", revision: c.revision })}</div><p className="mt-3 text-xs text-white/55">Failed media? Skip to the next entry. Refresh restores the selected performance; it never starts sound without browser permission.</p></div>}
      {["submissions", "review", "showcase", "voting"].includes(c.phase) && <div className="mt-6 border-t border-white/15 pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-bold">Submission queue</h3><input aria-label="Filter submissions" placeholder="Find a performer" value={filter} onChange={(e) => setFilter(e.target.value)} className="min-h-10 rounded-lg border border-white/20 bg-transparent px-3 text-sm" /></div><p className="mt-2 text-xs leading-6 text-white/60">Only explicitly consented submissions can be previewed. Unreviewed entries need your listening check. Selection resets if the performer replaces their take.</p>
        {!candidates.length && <p className="py-7 text-white/65">No eligible submissions yet. Share the code, or finish this round and try another assignment.</p>}
        <ul className="mt-4 max-h-96 space-y-2 overflow-y-auto">{candidates.filter((m) => m.displayName.toLowerCase().includes(filter.toLowerCase())).map((m) => <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/15 p-3"><span className="min-w-0 flex-1 break-words text-sm font-bold">{m.displayName}<span className="mt-1 block text-[11px] font-normal text-white/55">{m.performance!.sharingStatus === "unreviewed" ? "Unreviewed · listen before selecting" : "Approved"}{c.selectedIds.includes(m.id) ? " · Selected" : ""}</span></span><button className="button-ghost" onClick={() => setPreview(preview === m.id ? "" : m.id)}>{preview === m.id ? "Close preview" : "Private preview"}</button>{c.selectedIds.includes(m.id) ? button("Hide", "hide", { memberId: m.id }) : ["submissions", "review"].includes(c.phase) ? button("Select", "select", { memberId: m.id }) : null}</li>)}</ul>
        {privatePreview?.performance && <div className="mt-5"><p className="mb-3 text-xs font-bold text-hot">PRIVATE HOST PREVIEW · {privatePreview.displayName}</p><GroupPlayback key={privatePreview.performance.takeId} performance={privatePreview.performance} assignment={round.assignment} label={privatePreview.displayName} refresh={refresh} /></div>}
      </div>}
      <details className="mt-5 border-t border-white/15 pt-4"><summary className="cursor-pointer text-xs text-white/60">Access controls</summary><div className="mt-3 flex flex-wrap gap-3">{!round.inviteRevoked && button("Stop new joins & disable code", "revoke")}{!c.displayRevoked && button("Revoke display URL", "revoke-display")}</div></details>
    </div>}
    {!round.isHost && ["showcase", "voting"].includes(c.phase) && <div className="rounded-2xl border border-white/15 p-5"><h3 className="text-xl font-bold">The selected performances</h3><p className="mt-2 text-sm leading-7 text-white/65">Watch along on the host’s stream, or replay an entry here at your own pace.</p><div className="mt-4 flex flex-wrap gap-2">{selected.map((m) => <button key={m.id} className="button-secondary" onClick={() => setPreview(preview === m.id ? "" : m.id)}>{m.displayName}</button>)}</div>{privatePreview?.performance && <div className="mt-5"><GroupPlayback performance={privatePreview.performance} assignment={round.assignment} label={privatePreview.displayName} refresh={refresh} /></div>}{!selected.length && <p className="mt-4 text-white/60">No available entries are selected.</p>}</div>}
    {c.phase === "voting" && <div className="rounded-2xl bg-paper p-5 text-ink sm:p-7"><h3 className="display-type text-4xl">Give your favorite the vote.</h3><p className="my-4 max-w-2xl text-sm leading-7 text-ink/65">One effective vote per participant. No self-votes. You can change your pick until the host ends voting. Guest identities suit a casual game; they cannot prevent determined repeat signups.</p><div className="grid gap-3 sm:grid-cols-2">{selected.map((m) => <button key={m.id} disabled={!round.viewerMemberId || m.isYou || Boolean(busy)} onClick={() => void act("vote", { memberId: m.id })} aria-pressed={round.viewerVoteMemberId === m.id} className="min-h-14 rounded-xl border border-ink/25 p-4 text-left font-bold disabled:opacity-40">{m.displayName}{m.isYou ? " · you" : round.viewerVoteMemberId === m.id ? " · Your vote ✓" : ""}</button>)}</div>{!round.viewerMemberId && <p className="mt-4 text-sm font-bold">Join with a display name above to vote.</p>}</div>}
    {c.phase === "results" && <CommunityResults round={round} />}
    {c.nextRoundUrl && <Link href={c.nextRoundUrl} className="button-primary">The next round is ready →</Link>}
    {round.viewerMemberId && round.state !== "open" && !round.isHost && !c.nextRoundUrl && <p className="text-xs text-white/55">Keep this link. The host’s next round will appear here.</p>}
  </section>;
}

export function CommunityResults({ round }: { round: GroupRound }) {
  const performers = round.members.filter((m) => m.performance && round.community!.selectedIds.includes(m.id));
  const most = Math.max(0, ...performers.map((m) => m.votes));
  const audience = performers.filter((m) => most > 0 && m.votes === most);
  const group = round.assignment.mode === "classic" ? "classic" : "full-match";
  const ranked = performers.filter((m) => m.performance?.scoreGroup === group && performanceScore(m.performance) !== null);
  const best = Math.max(-1, ...ranked.map((m) => performanceScore(m.performance)!));
  const judges = ranked.filter((m) => performanceScore(m.performance) === best);
  return <div className="grid gap-5 sm:grid-cols-2"><section className="rounded-2xl bg-electric p-6 text-ink"><p className="mono-label">Audience favorite</p><h3 className="display-type mt-3 break-words text-5xl">{!round.community?.votingEnabled ? "No audience vote" : audience.length ? audience.map((m) => m.displayName).join(" + ") : "No votes cast"}</h3><p className="mt-3 text-sm">{audience.length > 1 ? `A tie · ${most} votes each` : audience.length ? `${most} ${most === 1 ? "vote" : "votes"}` : "No audience winner declared."}</p></section><section className="rounded-2xl border border-white/20 bg-[#20201d] p-6"><p className="mono-label text-hot">{group === "classic" ? "Judge’s pick" : "Full matching result"}</p><h3 className="display-type mt-3 break-words text-4xl">{judges.length ? judges.map((m) => m.displayName).join(" + ") : "Replay is the reward."}</h3><p className="mt-3 text-sm text-white/65">{judges.length ? `${Math.round(best)}/100${judges.length > 1 ? " · tied" : ""}` : "No comparable scored showcase entry."}</p><p className="mt-3 text-xs leading-6 text-white/55">Audience votes are separate from scoring. Words-only matches never compete for the full matching result.</p></section>{performers.some((m) => m.performance?.scoreGroup === "words-only") && <p className="text-sm text-white/65 sm:col-span-2">Words-only results: {performers.filter((m) => m.performance?.scoreGroup === "words-only").map((m) => `${m.displayName} ${Math.round(performanceScore(m.performance) ?? 0)}/100`).join(" · ")}</p>}</div>;
}

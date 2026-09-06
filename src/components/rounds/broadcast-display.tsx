"use client";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { GroupRound } from "@/lib/groups/types";
import { SwitchPlayer } from "@/components/switch/switch-player";
import { DubPlayer } from "@/components/say-it-back/dub-player";
import { useApp } from "@/components/providers/app-provider";
import { roundApi } from "./round-api";
import { CommunityResults } from "./community-panel";
import { ContentControl } from "@/components/content/content-control";

export function BroadcastDisplay({ token }: { token: string }) {
  const { contentRating, updatePreferences, hydrated } = useApp();
  const [round, setRound] = useState<GroupRound | null>(null);
  const [error, setError] = useState("");
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (!hydrated) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      if (document.visibilityState !== "visible") { timer = setTimeout(refresh, 15000); return; }
      let delay = 4000;
      try {
        const data = await roundApi<{ round: GroupRound }>(`/api/broadcast/${token}?maxRating=${contentRating}`);
        if (!stopped) { setRound(data.round); setError(""); }
        delay = data.round.community?.phase === "showcase" ? 2500 : data.round.community?.phase === "voting" ? 5000 : 15000;
      } catch { if (!stopped) { setRound(null); setError("Display unavailable. Reconnect, check the content setting, or ask the host for a current display link."); } delay = 15000; }
      if (!stopped) timer = setTimeout(refresh, delay);
    };
    setRound(null); void refresh();
    return () => { stopped = true; clearTimeout(timer); };
  }, [token, contentRating, hydrated]);
  // Keep the OBS source useful across linked rounds. Audio permission belongs
  // to this display tab; the media player still handles browser play rejection.
  useEffect(() => { try { setEnabled(sessionStorage.getItem("delivery:broadcast-audio") === "enabled"); } catch { /* explicit enable remains available */ } }, []);
  const nextRoundUrl = round?.community?.nextRoundUrl;
  useEffect(() => { if (nextRoundUrl) window.location.replace(nextRoundUrl); }, [nextRoundUrl]);
  const enableAudio = () => { setEnabled(true); try { sessionStorage.setItem("delivery:broadcast-audio", "enabled"); } catch { /* current tab can still play */ } };
  const c = round?.community;
  const current = round?.members.find((m) => m.id === c?.currentMemberId && c?.selectedIds.includes(m.id));
  const assignment = round?.assignment;
  return <main className="min-h-screen bg-[#101210] p-[3vw] text-paper" aria-label="Read-only broadcast display">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/20 pb-5"><span className="display-type text-4xl text-electric">DELIVERY<span className="text-hot">.</span></span><p className="mono-label text-white/60">{c?.phase ?? "Connecting"} · {round?.assignment.mode === "switch" ? "Switch · Beta" : round?.assignment.mode === "classic" ? "Classic" : "Say It Back"}</p></header>
    {!round || !c || !assignment ? <section className="mx-auto max-w-xl py-20"><h1 className="display-type text-5xl">{error ? "We’ll be right back." : "Setting the stage…"}</h1><p className="my-6 leading-7 text-white/65">{error || "Connecting to the host’s round."}</p>{error && <ContentControl allowMature={false} value={contentRating === "mature" ? "teen" : contentRating} onChange={(rating) => updatePreferences({ contentRating: rating })} />}</section> : <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-5"><div className="max-w-4xl"><h1 className="display-type break-words text-[clamp(2.5rem,5vw,5.5rem)] leading-none">{round.name}</h1><p className="mt-3 text-lg text-white/65">{assignment.mode === "switch" ? assignment.challenge.title : assignment.mode === "classic" ? assignment.energy : assignment.clip.title}</p></div><p className="text-xl font-bold text-electric">{c.phase === "voting" || c.phase === "results" ? `${round.members.reduce((n,m) => n + m.votes,0)} votes` : `${round.submittedCount}/${c.submissionLimit} performances`}</p></div>
      {["submissions","review"].includes(c.phase) ? <div className="grid items-center gap-10 rounded-3xl border border-white/15 bg-[#1b201b] p-[4vw] md:grid-cols-[1.4fr_1fr]"><div><p className="mono-label text-hot">{c.phase === "submissions" ? "Your voice. Your moment." : "The host is choosing the show."}</p><h2 className="display-type mt-5 text-[clamp(2rem,4vw,4.5rem)] leading-tight">{assignment.mode === "switch" ? assignment.challenge.cues.map((cue) => `${cue.emoji} ${cue.directionLabel}`).join(" → ") : assignment.mode === "classic" ? `“${assignment.promptText}”` : `Play ${assignment.clip.roles.find((r) => r.id === assignment.roleId)?.name}. Make it yours.`}</h2><p className="mt-6 text-xl leading-8 text-white/65">{c.phase === "submissions" ? "Scan. Record. Submit. Or join just to watch and vote." : "Submissions are closed. Stay for the performances."}</p></div>{!round.inviteRevoked && <div className="text-center"><QRCodeSVG value={round.url} size={224} marginSize={4} className="mx-auto h-auto max-w-full rounded-2xl" title="Scan to join the audience" /><p className="mt-5 font-mono text-[clamp(2rem,3vw,4rem)] font-bold tracking-widest text-electric">{c.code}</p><p className="mt-2 text-sm text-white/60">{new URL(round.url).host}/join</p></div>}</div> : c.phase === "showcase" ? <div className="mx-auto max-w-6xl [&_.aspect-video]:max-h-[48vh]">{current?.performance ? <><div className="mb-4 flex items-center justify-between"><h2 className="display-type text-4xl">{current.displayName}</h2><span className="text-sm text-white/60">{c.selectedIds.indexOf(current.id) + 1} / {c.selectedIds.length}</span></div>{!enabled && <button className="button-primary mb-5" onClick={enableAudio}>Enable broadcast audio</button>}{assignment.mode === "switch" ? <SwitchPlayer key={current.performance.takeId} challenge={assignment.challenge} audioUrl={current.performance.audioUrl} takeLabel={current.displayName} externalCommand={enabled ? { command: c.command, revision: c.revision } : { command: "pause", revision: c.revision }} /> : assignment.mode === "say-it-back" ? <DubPlayer key={current.performance.takeId} clip={assignment.clip} role={assignment.clip.roles.find((r) => r.id === assignment.roleId)!} takeUrl={current.performance.audioUrl} takeLabel={current.displayName} recordingOffsetMs={current.performance.sayAttempt?.recordingOffsetMs ?? 0} externalCommand={enabled ? { command: c.command, revision: c.revision } : undefined} /> : <ClassicBroadcast key={current.performance.takeId} url={current.performance.audioUrl} line={assignment.promptText} enabled={enabled} command={c.command} revision={c.revision} />}</> : <div className="rounded-3xl border border-white/15 py-24 text-center"><h2 className="display-type text-6xl">Next up…</h2><p className="mt-5 text-xl text-white/60">{c.selectedIds.length ? "The host is choosing the next performance." : "No available performances in this showcase."}</p></div>}</div> : c.phase === "voting" ? <div className="grid gap-8 md:grid-cols-[1fr_auto]"><div><h2 className="display-type text-6xl text-hot">Who delivered?</h2><p className="my-5 text-xl text-white/65">Vote from your round page. One pick. No self-votes.</p><div className="grid gap-4 sm:grid-cols-2">{round.members.map((m) => <div key={m.id} className="rounded-2xl border border-white/20 p-6 text-2xl font-bold">{m.displayName}</div>)}</div></div>{!round.inviteRevoked && <div><QRCodeSVG value={round.url} size={200} marginSize={4} title="Scan to vote" /><p className="mt-4 text-center font-mono text-2xl text-electric">{c.code}</p></div>}</div> : <CommunityResults round={round} />}
      {c.nextRoundUrl && <a className="button-primary mt-8" href={c.nextRoundUrl}>The next round is ready →</a>}
      {assignment.mode === "say-it-back" && <p className="mt-5 text-xs leading-6 text-white/50">{assignment.clip.source.attribution} · Shortened, dubbed adaptation · <a href={assignment.clip.source.licenseUrl} target="_blank" rel="noreferrer" className="underline">{assignment.clip.source.license}</a></p>}
      <footer className="mt-6 flex flex-wrap justify-between gap-4 text-xs leading-6 text-white/45"><span>{c.participantCount} joined · Host-controlled showcase</span><span>{c.phase === "showcase" ? "Audio follows the host after browser permission. Use play if the browser blocks sound." : "Camera-free performances. Audience votes and matching scores are separate."}</span></footer>
    </>}
  </main>;
}
function ClassicBroadcast({ url, line, enabled, command, revision }: { url: string; line: string; enabled: boolean; command: "play" | "pause" | "replay"; revision: number }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [error,setError] = useState("");
  const [playing,setPlaying] = useState(false);
  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    if (!enabled || command === "pause") { audio.pause(); return; }
    if (command === "replay") audio.currentTime = 0;
    void audio.play().catch(() => { setPlaying(false); setError("Sound did not start. Press play below to enable audio, or ask the host to skip this entry."); });
    return () => audio.pause();
  }, [enabled, command, revision]);
  return <div className="rounded-3xl border border-electric/30 bg-electric/5 p-[5vw]"><p className="display-type text-[clamp(2rem,4vw,4.5rem)]">“{line}”</p><p className="my-6 text-sm text-electric" role="status">{playing ? "Playing performance" : "Performance paused"}</p><audio ref={ref} src={url} controls preload="none" className="w-full" onPlay={() => { setPlaying(true); setError(""); }} onPause={() => setPlaying(false)} onError={() => setError("Recording unavailable. The host can skip to the next performance.")} />{error && <p role="alert" className="mt-4 text-sm text-orange-200">{error}</p>}</div>;
}

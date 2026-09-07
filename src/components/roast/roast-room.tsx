"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, ArrowUp, Check, ChevronDown, Copy, Crown, Flag, Flame, Headphones, LockKeyhole, LogOut, MessageCircle, Mic, MicOff, MoreHorizontal, Pause, Play, Radio, RefreshCw, Send, ShieldCheck, SkipForward, Users, Video, VideoOff, X } from "lucide-react";
import type { RoastPublicMember, RoastReactionKind, RoastResult } from "@/lib/roast/types";
import { RoastFormat, RoastRules } from "./roast-lobby";
import { useRoastRoom } from "./use-roast-room";
import { PerformerMedia, RoastMediaPreparation, useRoastMedia } from "./live-media";

const reactions: Array<{ kind: RoastReactionKind; emoji: string; label: string }> = [
  { kind: "fire", emoji: "🔥", label: "Fire" }, { kind: "laugh", emoji: "😂", label: "Laugh" },
  { kind: "clap", emoji: "👏", label: "Applause" }, { kind: "wow", emoji: "😮", label: "Wow" },
];
function resultTitle(result: RoastResult) {
  if (result.kind === "no_contest") return "No contest";
  if (!result.winnerId) return result.votes[0] + result.votes[1] === 0 ? "No votes. Fresh challengers." : "It’s a draw.";
  const name = result.performerNames[result.performerIds.indexOf(result.winnerId)];
  return `${name} ${result.kind === "forfeit" ? "wins by forfeit" : "takes it"}.`;
}

export function RoastRoom({ id, inviteToken }: { id: string; inviteToken?: string }) {
  const { room, loading, error, busy, now, joined, credentials, mediaError, mediaLoading, refresh, act, connectMedia, setError } = useRoastRoom(id, inviteToken);
  const [adult, setAdult] = useState(false);
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [prepareOpen, setPrepareOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  const [hideChat, setHideChat] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentInvite, setCurrentInvite] = useState(inviteToken);
  const [reportTarget, setReportTarget] = useState<RoastPublicMember | null>(null);
  const [reportReason, setReportReason] = useState("harassment");
  const [reportDetails, setReportDetails] = useState("");
  const [notice, setNotice] = useState("");
  const [closeConfirm, setCloseConfirm] = useState(false);
  const reportDialog = useRef<HTMLElement>(null);
  const chatBottom = useRef<HTMLDivElement>(null);
  const chatFollow = useRef(true);
  const offerAnnounced = useRef("");
  const media = useRoastMedia({
    url: credentials?.url,
    token: credentials?.token,
    identity: credentials?.identity,
    enabled: joined && Boolean(credentials),
    blockedIdentities: room?.viewer.blockedIds ?? [],
    hostMuted: Boolean(room?.stage.find((member) => member?.id === room.viewer.id)?.muted),
    onCameraChange: async (enabled) => { await act("camera", { enabled }); },
  });
  const isPerformer = Boolean(room?.viewer.id && room.stage.some((member) => member?.id === room.viewer.id));
  const queuePosition = room?.viewer.queuePosition ?? null;
  const seconds = room?.deadline ? Math.max(0, Math.ceil((room.deadline - now) / 1000)) : null;
  const offer = room?.viewer.offer;
  const offerSeconds = offer ? Math.max(0, Math.ceil((offer.expiresAt - now) / 1000)) : 0;

  useEffect(() => {
    const scroller = chatBottom.current?.parentElement;
    if (scroller && chatFollow.current) scroller.scrollTop = scroller.scrollHeight;
  }, [room?.chat.length, hideChat]);
  useEffect(() => {
    if (offer && offerAnnounced.current !== `${offer.seat}:${offer.expiresAt}`) {
      offerAnnounced.current = `${offer.seat}:${offer.expiresAt}`;
      setNotice("You’re up! Accept your place on stage before the invitation expires.");
    }
  }, [offer]);
  const { stageConsent, leaveStage: stopStagePublishing, stopPreview } = media;
  useEffect(() => {
    if (!isPerformer && stageConsent) {
      stopStagePublishing();
      if (queuePosition === null && !offer) stopPreview();
    }
  }, [isPerformer, stageConsent, stopStagePublishing, stopPreview, queuePosition, offer]);

  useEffect(() => {
    if (!reportTarget) return;
    const previousFocus = document.activeElement;
    const dialog = reportDialog.current;
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog) return;
      const controls = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea, a[href]')];
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    dialog?.addEventListener("keydown", trapFocus);
    return () => { dialog?.removeEventListener("keydown", trapFocus); if (previousFocus instanceof HTMLElement) previousFocus.focus(); };
  }, [reportTarget]);

  async function join() {
    if (!adult) return;
    await act("join", { adult: true, name: name.trim() || undefined });
  }
  async function joinQueue() {
    if (!media.ready || !consent) return;
    const ready = await act("ready", { adultAcknowledged: true, microphoneReady: true, cameraEnabled: Boolean(media.localVideoTrack) });
    if (ready && await act("queue_join")) { setPrepareOpen(false); setNotice("You’re in the queue. Keep listening; your invitation will appear here."); }
  }
  async function acceptOffer() {
    if (!media.ready || !consent || !offer) { setPrepareOpen(true); setNotice("Check your microphone and confirm the roast consent, then accept your place on stage."); return; }
    const accepted = await act("offer_accept", { offerExpiresAt: offer.expiresAt });
    if (accepted) { media.acceptStage(); setPrepareOpen(false); setNotice("You’re on stage. Your microphone opens only during your turn."); }
  }
  async function leaveQueue() {
    if (await act("queue_leave")) { media.stopPreview(); setPrepareOpen(false); setConsent(false); }
  }
  async function leaveStage() {
    media.leaveStage();
    if (await act("step_down")) { media.stopPreview(); setConsent(false); }
  }
  async function sendChat(event: FormEvent) {
    event.preventDefault();
    if (!chatText.trim()) return;
    if (await act("chat", { text: chatText.trim() })) setChatText("");
  }
  async function copyInvite() {
    const url = `${window.location.origin}/roast-off/${encodeURIComponent(id)}${currentInvite ? `?invite=${encodeURIComponent(currentInvite)}` : ""}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { setNotice(`Invitation: ${url}`); }
  }
  async function rotateInvite() {
    const result = await act("revoke_invite");
    if (result?.inviteToken) {
      setCurrentInvite(result.inviteToken);
      window.history.replaceState(null, "", `/roast-off/${encodeURIComponent(id)}?invite=${encodeURIComponent(result.inviteToken)}`);
      setNotice("The old invitation no longer admits new people. Copy the new link to invite someone. Current members can stay.");
    }
  }
  async function sendReport(event: FormEvent) {
    event.preventDefault();
    if (!reportTarget) return;
    if (await act("report", { memberId: reportTarget.id, reason: reportReason, details: reportDetails.trim() })) { setReportTarget(null); setReportDetails(""); setNotice("Report sent for review. You can block this person or leave at any time."); }
  }
  function memberMenu(member: RoastPublicMember) {
    if (!joined || !room || member.id === room.viewer.id) return null;
    const blocked = room.viewer.blockedIds.includes(member.id);
    return <details className="roast-member-menu relative"><summary aria-label={`Controls for ${member.name}`}><MoreHorizontal className="size-4" /></summary><div>
      <button onClick={() => void act("block", { memberId: member.id, blocked: !blocked })}>{blocked ? "Unblock" : "Block voice and chat"}</button>
      <button onClick={() => { setReportTarget(member); setReportReason("harassment"); }}>Report</button>
      {room.viewer.isHost && <>
        <button onClick={() => void act("host_mute", { memberId: member.id, muted: !member.muted })}>{member.muted ? "Unmute in room" : "Mute in room"}</button>
        <button onClick={() => void act("host_remove", { memberId: member.id })}>Remove from room</button>
        <button className="text-acid" onClick={() => void act("host_remove", { memberId: member.id, ban: true })}>Ban from this room</button>
      </>}
    </div></details>;
  }

  if (loading && !room) return <main className="roast-wrap"><p className="mono-label flex items-center gap-2 text-acid"><Flame className="size-4" />Roast Off</p><h1 className="display-type mt-6 text-5xl">Finding your crowd…</h1><p className="mt-4 text-sm text-white/60">No microphone or camera needed to watch.</p></main>;
  if (!room) return <main className="roast-wrap"><Link className="button-ghost pl-0" href="/roast-off"><ArrowLeft className="size-4" />Roast Off</Link><div className="roast-panel mt-5 max-w-xl p-7"><h1 className="display-type text-5xl">This stage isn’t available.</h1><p role="alert" className="mt-5 text-sm leading-7 text-white/65">{error || "The room may have closed or its invitation may have changed."}</p><button className="button-secondary mt-5" onClick={() => void refresh()}><RefreshCw className="size-4" />Try again</button></div></main>;
  if (room.viewer.removed || room.phase === "closed") return <main className="roast-wrap"><Link className="button-ghost pl-0" href="/roast-off"><ArrowLeft className="size-4" />Roast Off</Link><div className="roast-panel mt-5 max-w-xl p-7"><p className="mono-label text-white/50">{room.name}</p><h1 className="display-type mt-4 text-5xl">{room.viewer.removed ? "You’ve left the room." : "That’s our time."}</h1><p className="mt-5 text-sm leading-7 text-white/65">{room.viewer.removed ? "Your live connection and stage access have ended." : room.closedReason || "The host closed this stage. Thanks for being part of the crowd."}</p><Link className="button-primary mt-6" href="/roast-off">Back to Roast Off<ArrowRight className="size-4" /></Link></div></main>;

  const activeName = room.stage.find((member) => member?.id === room.activeSpeakerId)?.name;
  const stageHeadline = room.phase === "turn" ? `${activeName || "Performer"} has the mic.` : room.phase === "intro" ? "Here we go." : room.phase === "buffer" ? "Let that last line land." : room.phase === "voting" ? "Crowd. Your call." : room.phase === "results" && room.result ? resultTitle(room.result) : room.phase === "paused" ? "Hold that thought." : "Who wants the mic?";

  return <main className="roast-wrap">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><Link href="/roast-off" className="mono-label mb-2 inline-flex items-center gap-2 text-acid"><Flame className="size-4" />Roast Off</Link><h1 className="text-xl font-bold sm:text-2xl">{room.name}</h1></div>
      <div className="flex items-center gap-2"><span className="roast-tag bg-white/5 text-white/60">{room.visibility === "private" ? <LockKeyhole className="size-3" /> : <Radio className="size-3" />}{room.visibility === "private" ? "Private" : "Main stage"} · 18+</span>{joined && <button className="roast-mini-button" onClick={async () => { media.stopPreview(); media.leaveStage(); await act("leave"); }}><LogOut className="size-3.5" /><span>Leave</span></button>}</div>
    </header>

    {!joined && <section className="roast-panel mb-5 grid gap-6 border-acid/30 p-5 sm:p-7 md:grid-cols-[1fr_1.1fr]" aria-labelledby="join-heading"><div><h2 id="join-heading" className="display-type text-4xl">Come hang out.</h2><p className="mb-3 mt-4 text-sm leading-6 text-white/70">Watch, chat, react, and vote. Entering as a spectator never requests your microphone or camera.</p><RoastFormat compact /></div><div><label htmlFor="spectator-name" className="mb-2 block text-xs font-bold">Display name <span className="font-normal text-white/50">{room.viewer.signedIn ? "(your account name is used)" : "(optional)"}</span></label><input id="spectator-name" className="roast-input" maxLength={32} disabled={room.viewer.signedIn} value={name} onChange={(event) => setName(event.target.value)} placeholder="Guest" /><label className="roast-check mt-4"><input type="checkbox" checked={adult} onChange={(event) => setAdult(event.target.checked)} /><span>I am 18 or older and agree to the roast rules. This acknowledgement does not verify my age. People may capture this live session externally.</span></label><button className="button-primary mt-4 w-full" disabled={!adult || Boolean(busy)} onClick={() => void join()}><Headphones className="size-4" />{busy === "join" ? "Joining…" : "Enter as a spectator"}<ArrowRight className="size-4" /></button></div></section>}

    {error && <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-acid/35 bg-acid/5 p-4 text-sm text-acid"><p>{error}</p><button aria-label="Dismiss error" onClick={() => setError("")}><X className="size-4" /></button></div>}
    {notice && <div role="status" className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-electric/20 bg-electric/5 p-4 text-sm leading-6 text-electric"><p className="break-all">{notice}</p><button aria-label="Dismiss notice" onClick={() => setNotice("")}><X className="size-4" /></button></div>}

    {offer && joined && <section className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-acid bg-acid/10 p-5" aria-label="Your stage invitation"><div><p className="mono-label text-acid">You’re up · {offerSeconds}s to accept</p><h2 className="mt-2 text-xl font-bold">The mic is yours if you want it.</h2><p className="mt-1 text-xs leading-6 text-white/65">Accepting puts your prepared voice and optional camera on stage.</p></div><div className="flex gap-2"><button className="button-secondary" disabled={Boolean(busy)} onClick={() => void act("offer_decline")}>Pass</button><button className="button-primary" disabled={Boolean(busy) || offerSeconds === 0} onClick={() => void acceptOffer()}><Mic className="size-4" />Accept stage</button></div></section>}

    <div className="roast-room-grid">
      <div className="roast-main-column min-w-0 space-y-5">
        <section className="roast-stage" aria-label="Live roast stage">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5"><div className="flex flex-wrap items-center gap-2"><span className={`roast-tag ${room.mediaHealthy && joined && media.connectionState === "connected" ? "bg-electric/10 text-electric" : "bg-white/5 text-white/60"}`}><span className="roast-live-dot" />{!joined ? "Stage preview" : media.connectionState === "connected" ? "Live" : media.connectionState === "reconnecting" ? "Reconnecting" : mediaLoading || media.connectionState === "connecting" ? "Connecting" : "Audio disconnected"}</span><span className="text-xs text-white/50"><Users className="mr-1 inline size-3.5" />{room.memberCount} in room</span></div><span className="mono-label text-white/45">No recording</span></div>
          <div className="p-4 sm:p-5"><div className="mb-5 flex min-h-16 items-start justify-between gap-3"><div><p className="mono-label mb-2 text-acid">{room.phaseLabel}{room.phase === "turn" && room.turnIndex !== null ? ` · Turn ${room.turnIndex + 1} of 4` : ""}</p><h2 className="display-type text-3xl sm:text-4xl" aria-live="polite">{stageHeadline}</h2></div>{seconds !== null && <div className="shrink-0 text-right" aria-label={`${seconds} seconds remaining`}><span className={`display-type text-5xl tabular-nums ${seconds <= 5 ? "text-acid" : "text-paper"}`}>{seconds.toString().padStart(2, "0")}</span><p className="mono-label text-white/40">Seconds</p></div>}</div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">{room.stage.map((member, seat) => <div key={seat} className="min-w-0">{member ? <><PerformerMedia media={media} identity={member.id} name={member.name} active={room.activeSpeakerId === member.id} blocked={room.viewer.blockedIds.includes(member.id)} /><div className="mt-2 flex items-center justify-between gap-1"><div className="min-w-0"><p className="truncate text-sm font-bold">{member.name}{member.id === room.viewer.id ? " (you)" : ""}</p><p className="mt-1 text-[11px] text-white/50">{member.muted ? "Muted by host" : !member.mediaConnected ? "Reconnecting to stage" : room.activeSpeakerId === member.id ? "Their turn" : "Listening"}{room.championId === member.id && room.streak > 0 ? ` · ${room.streak} win streak` : ""}</p></div>{memberMenu(member)}</div></> : <div className="roast-empty-seat"><Mic className="size-8 text-white/30" /><p className="text-center text-xs">{room.offers.some((invitation) => invitation.seat === seat) ? "Inviting next challenger…" : "An open mic."}</p></div>}</div>)}</div>

            {joined && (mediaError || media.error) && <div role="alert" className="mt-4 rounded-lg border border-acid/25 p-3 text-xs leading-6 text-acid"><p>{mediaError || media.error}</p><button className="roast-mini-button mt-2" disabled={mediaLoading} onClick={() => void connectMedia()}><RefreshCw className="size-3.5" />Reconnect live audio</button></div>}
            {joined && media.audioBlocked && <button className="button-primary mt-4 w-full" onClick={() => void media.unlockAudio()}><Headphones className="size-4" />Tap to hear the stage</button>}
            {joined && media.connectionState === "disconnected" && !mediaLoading && !mediaError && !media.error && <button className="button-secondary mt-4 w-full" onClick={() => void connectMedia()}><RefreshCw className="size-4" />Connect live audio</button>}
            {room.phase === "paused" && <div role="status" className="mt-4 rounded-lg border border-white/15 bg-white/5 p-4 text-sm leading-6 text-white/70">{room.pauseReason === "host_disconnected" ? "The host is reconnecting. New battles are paused." : room.pauseReason === "performer_disconnected" ? "A performer is reconnecting. The timer is held briefly." : room.pauseReason === "media_unavailable" ? "Live media is unavailable. The battle is paused; this will not create an audience verdict." : "The host paused the stage. The timer will resume from here."}</div>}
            {room.phase === "waiting" && <p className="mt-5 text-center text-sm leading-6 text-white/55">{room.stage.filter(Boolean).length === 1 ? "One performer is ready. The next challenger is being invited." : "Queue up or hang out. The show starts when two performers accept."}</p>}
            {room.phase === "buffer" && <p className="mt-4 text-sm leading-6 text-white/60">A short buffer lets everyone hear the final line. Voting opens next.</p>}
            {room.phase === "voting" && <div className="mt-5 border-t border-white/10 pt-5"><p className="mb-3 text-xs text-white/60">{room.viewer.canVote ? "Who had the better roast? You can change your vote until time runs out." : isPerformer ? "The audience is choosing. Performers cannot vote in their own battle." : "Voting is for spectators who joined before the vote opened. Stay for the next battle."}</p><div className="grid gap-2 sm:grid-cols-2">{room.stage.map((member) => member && <button key={member.id} className="roast-vote" disabled={!joined || !room.viewer.canVote || Boolean(busy)} aria-pressed={room.viewer.vote === member.id} onClick={() => void act("vote", { candidateId: member.id })}><span className="truncate">{member.name}</span>{room.viewer.vote === member.id ? <Check className="size-4 shrink-0 text-acid" /> : <ArrowRight className="size-4 shrink-0 text-white/40" />}</button>)}</div></div>}
            {room.phase === "results" && room.result && <div className="mt-5 rounded-xl border border-acid/25 bg-acid/5 p-4"><div className="flex items-center gap-2"><Crown className="size-5 text-acid" /><p className="font-bold">{resultTitle(room.result)}</p></div><p className="mt-2 text-xs leading-6 text-white/65">{room.result.kind === "completed" ? `${room.result.performerNames[0]} ${room.result.votes[0]} — ${room.result.performerNames[1]} ${room.result.votes[1]}. ${room.result.winnerId ? room.result.streak >= 3 ? "Three wins. Time to pass the mic." : `Win streak: ${room.result.streak}. Winner stays; next challenger steps up.` : "Both performers rotate out."}` : room.result.reason}</p></div>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-black/10 px-4 py-3 sm:px-5"><div className="flex gap-2">{reactions.map(({ kind, emoji, label }) => { const count = room.reactions.filter((reaction) => reaction.kind === kind && reaction.at > now - 6000).length; return <button key={kind} className="roast-reaction" aria-label={`React: ${label}`} disabled={!joined || Boolean(busy)} onClick={() => void act("react", { kind })}><span aria-hidden="true">{emoji}</span>{count > 0 && <span className="text-xs tabular-nums text-white/65">{count}</span>}</button>; })}</div><a href="#challenger-queue" className="roast-mini-button"><Mic className="size-3.5" />Queue · {room.queue.length}</a></div>
        </section>

        {joined && isPerformer && <section className="roast-panel roast-performer-controls p-4 sm:p-5" aria-label="Your stage controls"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="mono-label text-acid">You’re on stage</p><p className="mt-1 text-xs leading-6 text-white/60">{room.activeSpeakerId === room.viewer.id ? "Your turn. Your mic can be heard by the room." : "Your microphone is held while the other performer speaks."}</p></div><button className="roast-mini-button" disabled={Boolean(busy)} onClick={() => void leaveStage()}><LogOut className="size-3.5" />Step down</button></div><div className="mt-3 flex flex-wrap gap-2"><button className="button-secondary" disabled={!media.ready} aria-pressed={!media.microphoneEnabled} onClick={() => void media.toggleMicrophone()}>{media.microphoneEnabled ? <MicOff className="size-4" /> : <Mic className="size-4" />}{media.microphoneEnabled ? "Mute my microphone" : "Enable my microphone"}</button><button className="button-secondary" onClick={() => void media.toggleCamera()}>{media.localVideoTrack ? <VideoOff className="size-4" /> : <Video className="size-4" />}{media.localVideoTrack ? "Turn my camera off" : "Enable my camera"}</button>{!media.stageConsent && <button className="button-primary" onClick={() => { if (media.ready) media.acceptStage(); else setPrepareOpen(true); }}>Enable my stage devices</button>}</div></section>}

        {joined && (prepareOpen || (offer && !media.ready)) && <section className="roast-panel roast-device-check p-5 sm:p-6" aria-labelledby="prepare-title"><div className="flex items-start justify-between gap-3"><div><p className="mono-label text-acid">Private device check</p><h2 id="prepare-title" className="mt-2 text-xl font-bold">Before you take the heat.</h2></div><button aria-label="Close device check" className="roast-mini-button" onClick={() => { setPrepareOpen(false); if (queuePosition === null && !isPerformer) media.stopPreview(); }}><X className="size-4" /></button></div><p className="mb-4 mt-3 text-sm leading-6 text-white/60">Try your microphone privately. Headphones help prevent echo. Camera is optional. The crowd cannot hear or see this check.</p><RoastMediaPreparation media={media} /><label className="roast-check mt-5"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I am 18 or older, explicitly opt in to being roasted, and consent to my voice and optional camera being heard and seen by this room when I accept the stage. Others may capture the session.</span></label>{offer ? <button className="button-primary mt-4" disabled={!media.ready || !consent || Boolean(busy)} onClick={() => void acceptOffer()}><Mic className="size-4" />Accept stage · {offerSeconds}s</button> : isPerformer ? <button className="button-primary mt-4" disabled={!media.ready || !consent} onClick={() => { media.acceptStage(); setPrepareOpen(false); }}>Enable my stage devices</button> : <button className="button-primary mt-4" disabled={!media.ready || !consent || Boolean(busy)} onClick={() => void joinQueue()}><Mic className="size-4" />Join the challenger queue</button>}</section>}

        <section className="roast-panel roast-queue-panel p-5 sm:p-6" id="challenger-queue" aria-labelledby="queue-title"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 id="queue-title" className="flex items-center gap-2 text-lg font-bold"><Mic className="size-4 text-acid" />Next on the mic <span className="text-sm font-normal text-white/40">{room.queue.length}/{room.queueCapacity}</span></h2><p className="mt-2 text-xs leading-6 text-white/55">{queuePosition !== null ? `You’re #${queuePosition} in the queue. Stay here to accept your invitation.` : "Challengers get 20 seconds to accept. Absent people are skipped."}</p></div>{joined && !isPerformer && !offer && (queuePosition !== null ? <button className="button-secondary" disabled={Boolean(busy)} onClick={() => void leaveQueue()}>Leave queue</button> : room.viewer.signedIn ? <button className="button-primary" disabled={room.queue.length >= room.queueCapacity} onClick={() => setPrepareOpen(true)}><Mic className="size-4" />Get in line</button> : <Link className="button-secondary" href={`/login?next=${encodeURIComponent(`/roast-off/${id}${currentInvite ? `?invite=${currentInvite}` : ""}`)}`}>Sign in to perform</Link>)}</div>
          {room.queue.length ? <ol className="mt-4 divide-y divide-white/10">{room.queue.map((member, index) => <li key={member.id} className="flex items-center justify-between gap-3 py-3"><div className="flex min-w-0 items-center gap-3"><span className="mono-label text-acid">{String(index + 1).padStart(2, "0")}</span><span className="truncate text-sm">{member.name}{member.id === room.viewer.id ? " (you)" : ""}</span><span className="text-[10px] text-white/40">{member.online ? "Ready" : "Away"}</span></div><div className="flex gap-1">{room.viewer.isHost && <><button className="roast-mini-button" disabled={index === 0 || Boolean(busy)} aria-label={`Move ${member.name} up the queue`} onClick={() => void act("host_queue_move", { memberId: member.id, position: index - 1 })}><ArrowUp className="size-3.5" /></button><button className="roast-mini-button" disabled={Boolean(busy)} aria-label={`Remove ${member.name} from queue`} onClick={() => void act("host_queue_remove", { memberId: member.id })}><X className="size-3.5" /></button></>}{memberMenu(member)}</div></li>)}</ol> : <div className="mt-5 rounded-lg border border-dashed border-white/15 p-5 text-center text-sm text-white/40">A little quiet in line. A good time to be brave.</div>}
        </section>

        {room.viewer.isHost && joined && <details className="roast-panel p-5 sm:p-6"><summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-bold"><span className="flex items-center gap-2"><ShieldCheck className="size-4 text-electric" />Host controls</span><ChevronDown className="size-4 text-white/50" /></summary><div className="mt-5"><p className="mb-4 text-xs leading-6 text-white/55">The server runs each turn and result. Pause when needed, or skip a disrupted battle as a no-contest. Inviting someone never opens their devices.</p><div className="flex flex-wrap gap-2"><button className="button-secondary" disabled={Boolean(busy)} onClick={() => void act(room.phase === "paused" ? "host_resume" : "host_pause")}>{room.phase === "paused" ? <Play className="size-4" /> : <Pause className="size-4" />}{room.phase === "paused" ? "Resume stage" : "Pause stage"}</button><button className="button-secondary" disabled={Boolean(busy) || !room.battleId} onClick={() => void act("host_skip")}><SkipForward className="size-4" />Skip battle</button><button className="button-secondary" onClick={() => void copyInvite()}><Copy className="size-4" />{copied ? "Copied" : "Copy invitation"}</button>{room.visibility === "private" && <button className="button-secondary" disabled={Boolean(busy)} onClick={() => void rotateInvite()}><LockKeyhole className="size-4" />Revoke old invitation</button>}<button className="button-danger" onClick={() => setCloseConfirm(true)}>Close room</button></div>{closeConfirm && <div className="mt-4 rounded-xl border border-acid/30 p-4"><p className="text-sm">End the show and disconnect everyone?</p><div className="mt-3 flex gap-2"><button className="button-danger" disabled={Boolean(busy)} onClick={() => void act("host_end")}>End this room</button><button className="button-ghost" onClick={() => setCloseConfirm(false)}>Keep it open</button></div></div>}<details className="mt-5 border-t border-white/10 pt-4"><summary className="cursor-pointer text-xs font-bold">People in the room · {room.memberCount}/{room.capacity}</summary><div className="mt-3 max-h-64 overflow-y-auto">{room.members.map((member) => <div className="flex items-center justify-between gap-3 border-b border-white/5 py-2" key={member.id}><div className="min-w-0"><p className="truncate text-sm">{member.name}</p><p className="text-[10px] capitalize text-white/45">{member.role}{!member.online ? " · away" : ""}</p></div>{memberMenu(member)}</div>)}</div></details></div></details>}
      </div>

      <aside className="roast-crowd mt-5 min-w-0 space-y-5 lg:mt-0" aria-label="The crowd">
        <section className="roast-panel roast-chat-panel overflow-hidden" aria-labelledby="chat-title"><div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4"><h2 id="chat-title" className="flex items-center gap-2 text-sm font-bold"><MessageCircle className="size-4 text-hot" />The crowd</h2><button className="text-xs text-white/50" onClick={() => setHideChat((value) => !value)} aria-pressed={hideChat}>{hideChat ? "Show chat" : "Mute chat"}</button></div><div className="roast-chat px-4" onScroll={(event) => { const scroller = event.currentTarget; chatFollow.current = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop < 80; }} role="log" aria-label="Room chat" aria-live="polite" aria-relevant="additions text">{hideChat ? <p className="py-8 text-center text-sm text-white/45">Chat is muted for you.</p> : room.chat.length ? room.chat.filter((message) => !room.viewer.blockedIds.includes(message.memberId)).map((message) => { const member = room.members.find((person) => person.id === message.memberId) ?? { id: message.memberId, name: message.name, role: "spectator" as const, online: false, muted: false, mediaConnected: false, cameraEnabled: false }; return <div key={message.id} className="roast-chat-message"><div className="flex items-center justify-between gap-1"><span className={`text-xs font-bold ${message.memberId === room.hostId ? "text-electric" : "text-hot"}`}>{message.name}{message.memberId === room.hostId ? " · Host" : ""}</span><div className="flex items-center">{room.viewer.isHost && <button className="p-2 text-white/35" aria-label={`Remove message from ${message.name}`} onClick={() => void act("host_chat_remove", { messageId: message.id })}><X className="size-3" /></button>}{memberMenu(member)}</div></div><p className="text-sm leading-6 text-white/80">{message.text}</p></div>; }) : <div className="px-3 py-10 text-center"><MessageCircle className="mx-auto mb-3 size-7 text-white/20" /><p className="text-sm text-white/55">You found the crowd.</p><p className="mt-2 text-xs leading-6 text-white/40">Say hey. Appreciate a good line.<br />Save your roast for the stage.</p></div>}<div ref={chatBottom} /></div><form onSubmit={(event) => void sendChat(event)} className="border-t border-white/10 p-3"><label className="sr-only" htmlFor="roast-chat-input">Chat message</label><div className="flex gap-2"><input id="roast-chat-input" className="roast-input min-w-0 text-sm" maxLength={280} value={chatText} disabled={!joined} onChange={(event) => setChatText(event.target.value)} placeholder={joined ? "Say something to the crowd…" : "Enter the room to chat"} autoComplete="off" /><button className="button-primary shrink-0 px-3" type="submit" aria-label="Send message" disabled={!joined || !chatText.trim() || Boolean(busy)}><Send className="size-4" /></button></div><p className="mt-2 text-[10px] leading-5 text-white/35">Room chat clears after 15 minutes. 280 characters per message.</p></form></section>
        {joined && (room.visibility === "public" || currentInvite || room.viewer.isHost) && <button className="button-secondary w-full" onClick={() => void copyInvite()}><Copy className="size-4" />{copied ? "Invitation copied" : "Bring a friend"}</button>}
        <details className="roast-panel p-4"><summary className="cursor-pointer text-xs font-bold">How this stage works</summary><div className="mt-3"><RoastFormat compact /><div className="mt-4 border-t border-white/10 pt-4"><RoastRules compact /></div><p className="mt-3 text-[11px] leading-6 text-white/40">Guest vote limits discourage repeat voting; they cannot stop determined multi-account abuse.</p></div></details>
        {room.history.length > 0 && <details className="roast-panel p-4"><summary className="cursor-pointer text-xs font-bold">Earlier on this stage · {room.history.length}</summary><div className="mt-3 divide-y divide-white/10">{room.history.map((result) => <article className="py-3" key={result.id}><p className="text-xs font-bold">{resultTitle(result)}</p><p className="mt-1 text-[11px] leading-6 text-white/50">{result.performerNames.join(" vs ")}{result.kind === "completed" ? ` · ${result.votes[0]}–${result.votes[1]}` : ` · ${result.kind === "forfeit" ? "Forfeit" : "Technical no-contest"}`}</p></article>)}</div><p className="mt-2 text-[10px] leading-5 text-white/35">Results only. No battle audio or video is saved.</p></details>}
      </aside>
    </div>

    {reportTarget && <section ref={reportDialog} role="dialog" aria-modal="true" aria-labelledby="report-title" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4" onKeyDown={(event) => { if (event.key === "Escape") setReportTarget(null); }}><form className="roast-panel w-full max-w-lg p-6" onSubmit={(event) => void sendReport(event)}><div className="flex items-start justify-between gap-3"><h2 id="report-title" className="flex items-center gap-2 text-lg font-bold"><Flag className="size-4 text-acid" />Report {reportTarget.name}</h2><button type="button" aria-label="Close report" onClick={() => setReportTarget(null)}><X className="size-5" /></button></div><p className="mb-4 mt-3 text-xs leading-6 text-white/60">Report a rule violation. A consensual roast or a joke you dislike is not automatically a violation.</p><label className="mb-2 block text-xs font-bold" htmlFor="roast-report-reason">Reason</label><select id="roast-report-reason" className="roast-input" value={reportReason} onChange={(event) => setReportReason(event.target.value)} autoFocus><option value="harassment">Harassment or targeting a spectator</option><option value="violence">Threats or violence</option><option value="privacy">Doxxing or personal information</option><option value="hate">Protected-trait abuse</option><option value="sexual">Sexual content or conduct</option><option value="spam">Spam</option><option value="other">Other rule violation</option></select><label htmlFor="roast-report-details" className="mb-2 mt-4 block text-xs font-bold">What happened? <span className="font-normal text-white/45">Optional</span></label><textarea id="roast-report-details" className="roast-input min-h-24" maxLength={700} value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} placeholder="A brief description helps. Live media is not recorded." /><div className="mt-5 flex justify-end gap-2"><button type="button" className="button-ghost" onClick={() => setReportTarget(null)}>Cancel</button><button className="button-primary" disabled={Boolean(busy)} type="submit">Send report</button></div></form></section>}
  </main>;
}

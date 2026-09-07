"use client";
/* eslint-disable @next/next/no-img-element -- Versioned scene posters are curated media assets. */

import { ArrowRight, Check, Clock3, Clapperboard, LoaderCircle, Mic, Search, ShieldCheck, Shuffle, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ContentControl, CONTENT_LABELS } from "@/components/content/content-control";
import { useApp } from "@/components/providers/app-provider";
import { ENERGY_MODIFIERS, PACKS, isEnergyCompatible, isRatingAllowed, queryPrompts } from "@/data/content";
import type { CreateGroupRoundInput, GroupMode, GroupRound } from "@/lib/groups/types";
import type { SwitchChallenge } from "@/lib/switch/types";
import { groupSwitchPhrases } from "@/lib/switch/phrases";
import { SwitchPhraseCard } from "@/components/switch/switch-phrase-picker";
import type { SayClip } from "@/lib/say-it-back/types";
import { cn } from "@/lib/utils";
import { roundApi, roundPost } from "./round-api";

export function RoundBuilder({ community = false, initialMode, initialClipId = "", initialRoleId = "", initialPromptId = "", initialEnergyId = "", initialChallengeId = "", previousToken }: {
  community?: boolean; initialMode?: string; initialClipId?: string; initialRoleId?: string; initialPromptId?: string; initialEnergyId?: string; initialChallengeId?: string; previousToken?: string;
}) {
  const router = useRouter();
  const { profile, authenticated, contentRating: preference, updatePreferences } = useApp();
  const contentRating = preference === "mature" ? "teen" : preference;
  const [mode, setMode] = useState<GroupMode>(initialMode === "classic" || initialMode === "switch" ? initialMode : "say-it-back");
  const [challenges, setChallenges] = useState<SwitchChallenge[]>([]);
  const [challengeId, setChallengeId] = useState(initialChallengeId);
  const [switchCatalogError, setSwitchCatalogError] = useState("");
  const [switchLoading, setSwitchLoading] = useState(true);
  const [clips, setClips] = useState<SayClip[]>([]);
  const [clipId, setClipId] = useState(initialClipId);
  const [roleId, setRoleId] = useState(initialRoleId);
  const [promptId, setPromptId] = useState(initialPromptId);
  const [energyId, setEnergyId] = useState(initialEnergyId);
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [hours, setHours] = useState<1 | 24 | 72 | 168>(24);
  const [submissionLimit, setSubmissionLimit] = useState(25);
  const [audienceVoting, setAudienceVoting] = useState(true);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [reload, setReload] = useState(0);
  const [previousRound, setPreviousRound] = useState<GroupRound | null>(null);
  const initialized = useRef(false);
  const request = useRef<{ key: string; id: string } | null>(null);
  const sending = useRef(false);

  useEffect(() => { if (authenticated && profile.displayName) setDisplayName((current) => current || profile.displayName); }, [authenticated, profile.displayName]);
  useEffect(() => {
    let active = true;
    setLoading(true); setCatalogError("");
    roundApi<{ clips: SayClip[] }>(`/api/say-it-back/clips?maxRating=${contentRating}`)
      .then((data) => { if (active) setClips([...data.clips].filter((item) => !community || ["CC BY 3.0", "Public domain in the United States"].includes(item.source.license)).sort((a, b) => b.duration - a.duration)); })
      .catch((cause) => { if (active) setCatalogError(cause instanceof Error ? cause.message : "Scenes could not load."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [contentRating, reload, community]);
  useEffect(() => {
    let active = true;
    setSwitchLoading(true); setSwitchCatalogError("");
    roundApi<{ challenges: SwitchChallenge[] }>(`/api/switch/catalog?maxRating=${contentRating}`)
      .then((data) => { if (active) setChallenges(data.challenges); })
      .catch((cause) => { if (active) setSwitchCatalogError(cause instanceof Error ? cause.message : "Switch challenges could not load."); })
      .finally(() => { if (active) setSwitchLoading(false); });
    return () => { active = false; };
  }, [contentRating, reload]);
  useEffect(() => {
    if (!previousToken) return;
    let active = true;
    roundApi<{ round: GroupRound }>(`/api/rounds/${encodeURIComponent(previousToken)}?maxRating=${contentRating}`).then(({ round }) => {
      if (!active) return;
      setPreviousRound(round);
      if (initialized.current) return;
      initialized.current = true;
      setName(`${round.name.replace(/ · again$/, "")} · again`.slice(0, 60));
      setDisplayName((value) => value || round.members.find((member) => member.isYou)?.displayName || "");
      if (!initialMode && !initialClipId && !initialPromptId && !initialChallengeId) {
        setMode(round.assignment.mode);
        if (round.assignment.mode === "say-it-back") { setClipId(round.assignment.clip.id); setRoleId(round.assignment.roleId); }
        else if (round.assignment.mode === "switch") setChallengeId(round.assignment.challenge.id);
        else { setPromptId(round.assignment.promptSlug); setEnergyId(round.assignment.energySlug); }
      }
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "The previous round could not load. You can still start a fresh round."); });
    return () => { active = false; };
  }, [previousToken, contentRating, initialMode, initialClipId, initialPromptId, initialChallengeId]);

  const prompts = useMemo(() => queryPrompts({ maxRating: contentRating }).filter((item) => item.packIds.every((id) => PACKS.find((pack) => pack.id === id)?.access !== "pro")), [contentRating]);
  const visibleChallenges = challenges.filter((item) => isRatingAllowed(item.rating, contentRating));
  const challenge = visibleChallenges.find((item) => item.id === challengeId) ?? (!challengeId ? visibleChallenges[0] : undefined);
  const clip = clips.find((item) => item.id === clipId) ?? (!clipId ? clips[0] : undefined);
  const role = clip?.roles.find((item) => item.id === roleId) ?? clip?.roles[0];
  const prompt = prompts.find((item) => item.id === promptId) ?? (!promptId ? prompts[0] : undefined);
  const energies = prompt ? ENERGY_MODIFIERS.filter((item) => isEnergyCompatible(prompt, item)) : [];
  const energy = energies.find((item) => item.id === energyId) ?? energies[0];
  const search = query.trim().toLowerCase();
  const availableClips = clips.filter((item) => !search || `${item.title} ${item.source.title} ${item.tags.join(" ")}`.toLowerCase().includes(search));
  const availablePrompts = prompts.filter((item) => !search || item.line.toLowerCase().includes(search));
  const availablePhrases = groupSwitchPhrases(visibleChallenges).filter((phrase) => !search || Object.values(phrase.variants).some((item) => `${phrase.text} ${item.title} ${item.description} ${item.tags.join(" ")}`.toLowerCase().includes(search)));
  const visiblePrevious = previousRound && isRatingAllowed(previousRound.assignment.rating, contentRating) ? previousRound : null;
  const selected = mode === "switch" ? Boolean(challenge) : mode === "say-it-back" ? Boolean(clip && role) : Boolean(prompt && energy);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (sending.current || !selected) return;
    sending.current = true; setCreating(true); setError("");
    const input = {
      community, submissionLimit, audienceVoting, name: name.trim(), displayName: displayName.trim(), mode, closesInHours: hours, maxRating: contentRating,
      ...(mode === "switch" ? { challengeId: challenge!.id, challengeVersion: challenge!.version } : mode === "say-it-back" ? { clipId: clip!.id, clipVersion: clip!.version, roleId: role!.id } : { promptId: prompt!.id, energyId: energy!.id }),
    };
    const key = JSON.stringify(input);
    if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
    try {
      const { round } = await roundPost<{ round: GroupRound }>(previousToken && visiblePrevious?.viewerMemberId ? `/api/rounds/${encodeURIComponent(previousToken)}/rematch` : "/api/rounds", { ...input, requestId: request.current.id } satisfies CreateGroupRoundInput);
      router.push(`/rounds/${encodeURIComponent(round.token)}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your round could not be created. Try again."); }
    finally { sending.current = false; setCreating(false); }
  }

  return <div>
    {visiblePrevious && <p className="mb-5 rounded-xl border border-electric/25 bg-electric/5 px-4 py-3 text-sm text-white/75">Playing again from <Link href={`/rounds/${encodeURIComponent(previousToken!)}`} className="font-bold text-electric underline">{visiblePrevious.name}</Link>. Everyone follows the new link; previous performances stay in the previous round.</p>}
    <div className="mb-7 grid grid-cols-3 overflow-hidden rounded-xl border border-white/15 bg-surface">{[{ icon: Users, title: "Send one link", detail: community ? "Code + QR for your audience" : "Up to 12 friends" }, { icon: Mic, title: "Record anytime", detail: "Private takes. No camera." }, { icon: Clapperboard, title: community ? "Host the showcase" : "Reveal together", detail: "Watch. Vote. Go again." }].map((step, index) => <div key={step.title} className={cn("p-3 sm:p-5", index > 0 && "border-l border-white/15")}><step.icon className="mb-3 size-5 text-hot" /><p className="text-xs font-bold sm:text-sm">{step.title}</p><p className="mt-1 text-[11px] leading-5 text-white/55 sm:text-xs">{step.detail}</p></div>)}</div>
    <div className="mb-6"><ContentControl allowMature={false} value={contentRating} onChange={(rating) => updatePreferences({ contentRating: rating })} disabled={creating} /><p className="mt-2 text-xs leading-5 text-white/50">Friend rounds support Clean and Spicy assignments. Mature performances stay private.</p></div>
    <form onSubmit={(event) => void create(event)} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,1fr)]">
      <section className="min-w-0 rounded-2xl border border-white/15 bg-surface p-4 sm:p-6">
        <p className="mono-label text-hot">01 / Set the assignment</p><h2 className="mt-2 text-2xl font-bold">Give them something to work with.</h2>
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="Game mode">{([{ value: "say-it-back", label: "Say It Back", description: "Your voice in a real scene", icon: Clapperboard }, { value: "classic", label: "Classic", description: "A line. An absurd direction.", icon: Mic }, { value: "switch", label: "Switch · Beta", description: "One phrase. Keep switching.", icon: Shuffle }] as const).map((item) => <button type="button" key={item.value} onClick={() => { setMode(item.value); setQuery(""); }} disabled={creating} aria-pressed={mode === item.value} className={cn("rounded-xl border p-4 text-left", mode === item.value ? "border-hot bg-hot/10" : "border-white/15 hover:border-white/40")}><item.icon className="mb-3 size-5 text-hot" /><span className="block text-sm font-bold">{item.label}</span><span className="mt-1 block text-[11px] leading-5 text-white/60">{item.description}</span></button>)}</div>
        <label className="mt-5 flex min-h-12 items-center gap-3 rounded-xl border border-white/20 px-3"><Search className="size-4 shrink-0 text-white/55" /><span className="sr-only">Search {mode === "classic" ? "lines" : mode === "switch" ? "Switch challenges" : "scenes"}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={mode === "classic" ? "Find a funny line" : mode === "switch" ? "Find a Switch challenge" : "Find a scene"} className="min-w-0 w-full bg-transparent py-3 text-sm outline-none" /></label>
        {mode === "switch" ? <>
          <p className="mt-4 text-xs leading-6 text-white/65">Choose a phrase, then Emoji or Speed. Everyone plays the same cues.</p>
          {switchCatalogError && <p role="alert" className="mt-4 text-sm text-orange-200">{switchCatalogError} <button type="button" onClick={() => setReload((value) => value + 1)} className="underline">Retry Switch challenges</button></p>}
          {switchLoading && !challenges.length ? <p role="status" className="flex items-center gap-2 py-10 text-sm text-white/65"><LoaderCircle className="size-4 animate-spin" />Opening Switch phrases…</p> : <div className="mt-4 grid max-h-[520px] gap-3 overflow-y-auto pr-1" aria-label="Choose a Switch phrase">{availablePhrases.map((phrase) => <SwitchPhraseCard key={phrase.key} phrase={phrase} disabled={creating} selectedId={challenge?.id} onChoose={(item) => setChallengeId(item.id)} />)}</div>}
          {!switchLoading && !availablePhrases.length && !switchCatalogError && <p className="py-8 text-sm text-white/65">No Switch phrases match. Try another search or content setting.</p>}
          {challenge && <div className="mt-5 rounded-xl border border-hot/25 bg-hot/5 p-4"><p className="text-xs font-bold text-hot">Repeat this phrase through every cue</p><p className="mt-3 text-lg font-bold leading-7">“{challenge.cues[0]?.text}”</p><ol className="mt-4 space-y-3">{challenge.cues.map((cue) => <li key={cue.id} className="flex items-center gap-3"><span className="text-2xl" aria-hidden="true">{cue.emoji}</span><div><p className="text-sm font-bold text-white/85">{cue.directionLabel}</p><p className="text-xs text-white/55">{cue.start}–{cue.end}s</p></div></li>)}</ol></div>}
        </> : mode === "say-it-back" ? <>
          {catalogError && <p role="alert" className="mt-4 text-sm text-orange-200">{catalogError} <button type="button" onClick={() => setReload((value) => value + 1)} className="underline">Retry scenes</button></p>}
          {loading && !clips.length ? <p role="status" className="flex items-center gap-2 py-10 text-sm text-white/65"><LoaderCircle className="size-4 animate-spin" />Opening scenes…</p> : <div className="mt-4 grid max-h-[520px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2" aria-label="Choose a scene">{availableClips.map((item) => <button type="button" key={`${item.id}:${item.version}`} disabled={creating} aria-pressed={clip?.id === item.id} onClick={() => { setClipId(item.id); setRoleId(item.roles[0]?.id ?? ""); }} className={cn("overflow-hidden rounded-xl border text-left", clip?.id === item.id ? "border-hot bg-hot/10" : "border-white/15 hover:border-white/40")}><div className="relative aspect-video bg-black"><img src={item.posterUrl} alt="" loading="lazy" className="size-full object-cover" /><span className="absolute bottom-2 right-2 rounded bg-ink/90 px-2 py-1 text-[10px] font-bold">{Math.round(item.duration)} sec · {item.cues.filter((cue) => cue.roleId === item.roles[0]?.id).length} lines</span>{clip?.id === item.id && <span className="absolute left-2 top-2 grid size-7 place-items-center rounded-full bg-hot text-ink"><Check className="size-4" /></span>}</div><div className="p-3"><span className="block text-[10px] text-white/55">{item.source.title}</span><span className="mt-1 block text-sm font-bold">{item.title}</span><span className="mt-2 block text-[10px] text-white/60">{CONTENT_LABELS[item.rating]} · {item.difficulty}</span></div></button>)}</div>}
          {!loading && !availableClips.length && !catalogError && <p className="py-8 text-sm text-white/65">No scenes match. Try another search or content setting.</p>}
          {clip && role && <div className="mt-5 rounded-xl border border-hot/25 bg-hot/5 p-4"><label htmlFor="round-role" className="text-xs font-bold text-white/75">Everyone performs this role</label><select id="round-role" value={role.id} onChange={(event) => setRoleId(event.target.value)} disabled={creating} className="mt-2 min-h-12 w-full rounded-lg border border-white/20 bg-ink px-3 text-sm font-bold">{clip.roles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><p className="mt-3 text-xs leading-6 text-white/65">{role.description}</p></div>}
        </> : <><div className="mt-4 grid max-h-[400px] gap-2 overflow-y-auto pr-1" aria-label="Choose a line">{availablePrompts.map((item) => <button type="button" key={item.id} disabled={creating} onClick={() => setPromptId(item.id)} aria-pressed={prompt?.id === item.id} className={cn("flex items-start justify-between gap-3 rounded-xl border p-4 text-left", prompt?.id === item.id ? "border-acid bg-acid/10" : "border-white/15 hover:border-white/40")}><span className="text-sm font-bold leading-6">“{item.line}”<span className="mt-2 block text-[10px] font-normal text-white/55">{CONTENT_LABELS[item.rating]} · {item.difficulty}</span></span>{prompt?.id === item.id && <Check className="mt-1 size-4 shrink-0 text-acid" />}</button>)}</div>{!availablePrompts.length && <p className="py-8 text-sm text-white/65">No lines match that search.</p>}{prompt && energy && <div className="mt-5"><label htmlFor="round-energy" className="text-xs font-bold text-white/75">Everyone gets this direction</label><select id="round-energy" value={energy.id} disabled={creating} onChange={(event) => setEnergyId(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/20 bg-ink px-3 text-sm font-bold">{energies.map((item) => <option key={item.id} value={item.id}>{item.shortLabel}</option>)}</select><p className="mt-3 text-xs leading-6 text-white/65">{energy.instruction}</p></div>}</>}
        {!selected && !loading && <p className="mt-4 text-sm leading-6 text-orange-200">The requested assignment is outside this filter or no longer available. Choose one above, or adjust your content setting.</p>}
      </section>
      <aside className="min-w-0 space-y-4 lg:sticky lg:top-24">
        <section className="rounded-2xl bg-paper p-5 text-ink sm:p-6"><p className="mono-label text-ink/55">02 / Make it a round</p><h2 className="mt-2 text-2xl font-bold">{community ? "Bring your community." : "Invite the group chat."}</h2>
          <label htmlFor="round-name" className="mt-6 block text-xs font-bold">Round name</label><input id="round-name" required minLength={2} maxLength={60} value={name} onChange={(event) => setName(event.target.value)} disabled={creating} placeholder="Friday mic club" className="mt-2 min-h-12 w-full rounded-xl border border-ink/25 bg-transparent px-3 text-sm placeholder:text-ink/45" />
          <label htmlFor="host-name" className="mt-4 block text-xs font-bold">Your display name</label><input id="host-name" required minLength={1} maxLength={32} autoComplete="nickname" value={displayName} onChange={(event) => setDisplayName(event.target.value)} disabled={creating} placeholder="What your friends call you" className="mt-2 min-h-12 w-full rounded-xl border border-ink/25 bg-transparent px-3 text-sm placeholder:text-ink/45" />
          <label htmlFor="round-close" className="mt-4 block text-xs font-bold">{community ? "Submission deadline" : "Automatic reveal"}</label><select id="round-close" value={hours} onChange={(event) => setHours(Number(event.target.value) as typeof hours)} disabled={creating} className="mt-2 min-h-12 w-full rounded-xl border border-ink/25 bg-paper px-3 text-sm [color-scheme:light]"><option value={1}>In 1 hour · a quick round</option><option value={24}>In 24 hours · tomorrow’s premiere</option><option value={72}>In 3 days · no rush</option><option value={168}>In 7 days · whenever works</option></select>
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-ink/65"><Clock3 className="mt-0.5 size-4 shrink-0" />{community ? "The deadline closes submissions into your private review queue. You choose when the show starts." : "You can close and reveal sooner. If you’re away, the deadline reveals the round automatically."}</p>
          {community ? <div className="my-5 space-y-4 border-y border-ink/15 py-4 text-xs leading-6">
            <label className="block font-bold">Maximum submissions<select className="mt-2 block min-h-12 w-full rounded-xl border border-ink/25 bg-paper px-3" value={submissionLimit} onChange={(e) => setSubmissionLimit(Number(e.target.value))}>{[10,25,50].map((n) => <option key={n} value={n}>{n} performances</option>)}</select></label>
            <label className="flex items-start gap-3"><input type="checkbox" checked={audienceVoting} onChange={(e) => setAudienceVoting(e.target.checked)} className="mt-1 size-4" />Let the audience vote for their favorite</label>
            <p><strong>Host preview, then a selected showcase.</strong> Viewers explicitly consent before submitting. Choose up to 12 entries to show. Drafts remain private.</p>
            <p>Streams may be recorded externally. In-app deletion cannot retract an external broadcast. Replay lasts 7 days after submissions close.</p>
          </div> : <div className="my-5 border-y border-ink/15 py-4 text-xs leading-6 text-ink/75"><p><strong>Private until reveal.</strong> Each friend submits one take and can replace it before closure.</p><p>Unscored takes can join the show. Words-only scores stay separate. The group can replay and vote for 7 days after reveal.</p></div>}
          <button type="submit" disabled={creating || !selected || !name.trim() || !displayName.trim()} className="button-primary w-full">{creating ? <LoaderCircle className="size-4 animate-spin" /> : <Users className="size-4" />}{creating ? "Creating your round…" : visiblePrevious ? "Create the next round" : community ? "Host a community round" : "Create friend round"}<ArrowRight className="size-4" /></button>
          {error && <p role="alert" className="mt-4 rounded-xl bg-red-900/10 p-3 text-sm leading-6 text-red-950">{error}</p>}
        </section>
        <p className="flex items-start gap-2 px-1 text-xs leading-6 text-white/60"><ShieldCheck className="mt-1 size-4 shrink-0 text-electric" />{community ? "Share your code or QR on stream. Up to 500 people can join to watch and vote without a microphone." : "The link lets people join this private group. Share it only with your friends. You can stop new joins at any time."}</p>
        {!authenticated && <p className="px-1 text-xs leading-6 text-white/60">No account needed. Keep this browser’s cookies to retain your host access. Sign in from your round to keep access across devices.</p>}
      </aside>
    </form>
  </div>;
}

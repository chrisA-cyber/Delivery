import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LogIn, Swords } from "lucide-react";
import Link from "next/link";
import { ChallengeMatchView } from "@/components/challenge/challenge-match-view";
import { GameExperience } from "@/components/game/game-experience";
import { ReportAction } from "@/components/safety/report-action";
import { getChallengeInvite, getChallengeMatch } from "@/lib/server/challenges";
import { gamePromptById } from "@/lib/game-prompts";
import { getOptionalUser } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "You were challenged",
  robots: { index: false, follow: false },
};

export default async function ChallengePlayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const invite = await getChallengeInvite(code);
  if (!invite) notFound();
  const prompt = gamePromptById(invite.promptSlug, invite.energySlug);
  if (!prompt) notFound();
  const user = await getOptionalUser();
  if (!user) {
    const next = `/challenge/${encodeURIComponent(code)}`;
    return <main className="min-h-screen px-3 pb-28 pt-24 sm:px-6 sm:pt-28"><section className="panel-solid mx-auto max-w-xl p-7 text-center sm:p-10"><div className="mx-auto grid size-16 place-items-center rounded-3xl bg-hot/10 text-hot"><Swords className="size-7" /></div><p className="mono-label mt-6 text-hot">@{invite.challengerHandle} called you out</p><h1 className="mt-3 text-3xl font-black tracking-[-0.05em]">Sign in so your answer lands.</h1>{invite.message && <p className="mt-4 rounded-xl border border-hot/15 bg-hot/[0.06] p-3 text-sm font-bold text-hot/75">“{invite.message}”</p>}<p className="mt-4 text-sm leading-6 text-white/45">Challenge scores need an account so both entries stay attached to the matchup. Your signed invite will be waiting after login.</p><div className="mt-7 grid gap-2 sm:grid-cols-[1fr_auto]"><Link href={`/login?next=${encodeURIComponent(next)}`} className="button-primary"><LogIn className="size-4" /> Sign in to accept</Link><ReportAction profileId={invite.challengerId} challengeInvite={code} context={`Challenge from @${invite.challengerHandle}`} /></div></section></main>;
  }
  const invitePath = `/challenge/${encodeURIComponent(code)}`;
  const match = await getChallengeMatch(invite.id, user.id);
  const hasEntered = match?.entries.some((entry) => entry.entrantId === user.id) ?? false;
  if (match && (hasEntered || match.state === "completed")) {
    return <main className="min-h-screen px-3 pb-28 pt-24 sm:px-6 sm:pt-28"><ChallengeMatchView entries={match.entries} complete={match.state === "completed"} invitePath={invitePath} currentUserId={user.id} /></main>;
  }
  if (invite.state === "completed") notFound();
  const game = <GameExperience mode="challenge" initialPrompt={prompt} challengeId={invite.id} challengeToken={invite.token} challengeReturnPath={invitePath} />;
  return <main className="min-h-screen px-3 pb-10 pt-24 sm:px-6 sm:pt-28 lg:pt-20"><div className="mx-auto mb-6 flex max-w-4xl items-start justify-between gap-3 rounded-2xl border border-hot/25 bg-hot/10 p-3 text-hot sm:px-4"><div className="flex items-start gap-3"><Swords className="mt-0.5 size-4 shrink-0" /><div><span className="mono-label">@{invite.challengerHandle} called you out. The line is locked.</span>{invite.message && <p className="mt-1 text-sm font-bold text-hot/70">“{invite.message}”</p>}</div></div>{invite.challengerId !== user.id && <ReportAction profileId={invite.challengerId} challengeInvite={code} label="Report" context={`Challenge from @${invite.challengerHandle}`} className="button-ghost min-h-9 shrink-0 px-3" />}</div>{game}</main>;
}

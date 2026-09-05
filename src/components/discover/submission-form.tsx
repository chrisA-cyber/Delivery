"use client";

import { ArrowRight, CheckCircle2, Lightbulb, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

const categories = ["main-character", "group-chat", "gaming", "anime-energy", "cinema-coded", "workplace", "romance", "villain-era", "brainrot", "customer-service", "streamer-mode", "wildcard"] as const;

export function SubmissionForm() {
  const [text, setText] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("wildcard");
  const [energy, setEnergy] = useState("");
  const [context, setContext] = useState("");
  const [rights, setRights] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "signin">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, category, suggestedEnergy: energy || undefined, sourceContext: context || undefined, confirmOriginalOrLicensed: rights }),
      });
      const body = await response.json() as { ok?: boolean; data?: { accepted?: boolean; status?: string }; error?: { message?: string } };
      if (response.status === 401) { setStatus("signin"); setMessage("Sign in so we can credit you and show the review status."); return; }
      if (!response.ok) throw new Error(body.error?.message ?? "Your line could not be submitted.");
      if (!body.data?.accepted) { setStatus("error"); setMessage("This line did not pass the automatic safety check. Try an original, all-ages rewrite."); return; }
      setStatus("success");
      setMessage("In the review queue. If it makes the cut, your handle stays attached to it.");
      setText(""); setEnergy(""); setContext(""); setRights(false);
    } catch (cause) {
      setStatus("error");
      setMessage(cause instanceof Error ? cause.message : "Your line could not be submitted.");
    }
  }

  return <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
    <form onSubmit={submit} className="panel-solid p-5 sm:p-8">
      <label htmlFor="submission-line" className="mono-label text-acid">Your original line</label>
      <textarea id="submission-line" required minLength={4} maxLength={180} value={text} onChange={(event) => setText(event.target.value)} placeholder="I made the apology video worse by putting a sponsor in the middle." className="mt-3 min-h-36 w-full resize-y rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-lg font-black leading-7 outline-none placeholder:text-white/50 focus:border-acid/40" />
      <p className="mt-2 text-right font-mono text-[10px] font-bold text-white/60">{text.length} / 180</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2"><label><span className="mono-label text-white/60">Category</span><select value={category} onChange={(event) => setCategory(event.target.value as typeof category)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#161618] px-4 text-sm font-black capitalize outline-none">{categories.map((item) => <option key={item} value={item}>{item.replaceAll("-", " ")}</option>)}</select></label><label><span className="mono-label text-white/60">Suggested energy <span className="text-white/65">optional</span></span><input maxLength={180} value={energy} onChange={(event) => setEnergy(event.target.value)} placeholder="Sound completely sincere, then accidentally proud." className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-bold outline-none placeholder:text-white/50 focus:border-hot/40" /></label></div>
      <label className="mt-4 block"><span className="mono-label text-white/60">Context for the editors <span className="text-white/65">optional</span></span><textarea maxLength={500} value={context} onChange={(event) => setContext(event.target.value)} placeholder="Why this line works, where it came from, or what makes the bit land." className="mt-2 min-h-24 w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm font-bold leading-6 outline-none placeholder:text-white/50 focus:border-electric/40" /></label>
      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4"><input type="checkbox" required checked={rights} onChange={(event) => setRights(event.target.checked)} className="mt-1 size-4 accent-[#ff745c]" /><span><b className="text-sm">I wrote this or have permission to submit it.</b><span className="mt-1 block text-xs leading-5 text-white/55">No copied movie dialogue, lyrics, personal information, targeted harassment, or private chat leaks.</span></span></label>
      <button disabled={status === "loading"} className="button-primary mt-6 w-full min-h-14">{status === "loading" ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {status === "loading" ? "Running the vibe check…" : "Submit for review"}</button>
      {message && <div role="status" className={`mt-4 rounded-xl border p-4 text-sm font-bold leading-6 ${status === "success" ? "border-acid/20 bg-acid/10 text-acid" : "border-orange-400/20 bg-orange-400/10 text-orange-100"}`}>{status === "success" && <CheckCircle2 className="mr-2 inline size-4" />}{message}{status === "signin" && <Link href="/login?next=/submit" className="ml-2 inline-flex items-center gap-1 underline">Sign in <ArrowRight className="size-3" /></Link>}</div>}
    </form>
    <aside className="grid gap-4 lg:sticky lg:top-24"><div className="panel p-5"><Lightbulb className="size-5 text-hot" /><h2 className="mt-4 text-lg font-black">What gets featured</h2><ul className="mt-4 grid gap-3 text-sm font-bold leading-6 text-white/50"><li>• Short enough to perform in one breath-ish</li><li>• A clear comedic premise</li><li>• Flexible across several energies</li><li>• Original wording or a documented license</li></ul></div><div className="panel p-5"><ShieldCheck className="size-5 text-acid" /><h2 className="mt-4 text-lg font-black">Human-reviewed</h2><p className="mt-2 text-sm leading-6 text-white/65">Automation catches obvious unsafe content. An editor makes the final call before anything enters a public pack.</p><Link href="/guidelines" className="button-ghost mt-4 px-0">Read the rules <ArrowRight className="size-3.5" /></Link></div></aside>
  </div>;
}

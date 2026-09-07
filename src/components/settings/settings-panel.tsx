"use client";

import { Ban, Bell, CreditCard, Download, Eye, LoaderCircle, LogOut, Mic, Save, ShieldCheck, Trash2, UserRound, Volume2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useApp } from "@/components/providers/app-provider";
import { ContentControl } from "@/components/content/content-control";
import { AvatarPicker } from "@/components/avatars/avatar-picker";
import { SpeechAvatar } from "@/components/avatars/speech-avatar";
import { usePreferredAvatar } from "@/hooks/use-preferred-avatar";

function errorMessage(body: unknown, fallback: string) {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: unknown }).error;
    if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  }
  return fallback;
}

export function SettingsPanel() {
  const { muted, reducedMotion, contentRating, authenticated, accountEmail, tier, billing, profile, refreshAccount, updatePreferences, clearLocalData, signOut } = useApp();
  const avatarPreference = usePreferredAvatar();
  const [confirmingLocal, setConfirmingLocal] = useState(false);
  const [savedNotice, setSavedNotice] = useState("");
  const [billingError, setBillingError] = useState("");
  const [billingLoading, setBillingLoading] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [privacySaving, setPrivacySaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [blockedProfiles, setBlockedProfiles] = useState<Array<{ handle: string; displayName: string }>>([]);
  const [blocksLoading, setBlocksLoading] = useState(false);

  useEffect(() => {
    if (!authenticated) { setBlockedProfiles([]); return; }
    const controller = new AbortController();
    setBlocksLoading(true);
    void fetch("/api/blocks", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as { data?: { blocks?: Array<{ handle: string; displayName: string }> } };
        if (response.ok) setBlockedProfiles(body.data?.blocks ?? []);
      })
      .catch((cause) => { if (!(cause instanceof DOMException && cause.name === "AbortError")) setProfileError("Blocked performers could not be loaded."); })
      .finally(() => { if (!controller.signal.aborted) setBlocksLoading(false); });
    return () => controller.abort();
  }, [authenticated]);
  const [profileDraft, setProfileDraft] = useState({ handle: "", displayName: "", bio: "" });

  async function manageBilling() {
    if (!billing.portalAvailable) return;
    setBillingLoading(true); setBillingError("");
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      const body = await response.json() as { data?: { url?: string }; error?: { message?: string } };
      if (!response.ok || !body.data?.url) throw new Error(body.error?.message ?? "Billing could not open.");
      window.location.href = body.data.url;
    } catch (cause) {
      setBillingError(cause instanceof Error ? cause.message : "Billing could not open.");
      setBillingLoading(false);
    }
  }

  async function deleteAccount() {
    if (deleteConfirmation !== "DELETE") return;
    setDeletingAccount(true); setDeleteError("");
    try {
      const response = await fetch("/api/account/delete", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: deleteConfirmation }) });
      const body = await response.json() as unknown;
      if (!response.ok) throw new Error(errorMessage(body, "Your account could not be deleted safely."));
      clearLocalData();
      await signOut();
      window.location.assign("/?account=deleted");
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : "Your account could not be deleted safely.");
      setDeletingAccount(false);
    }
  }

  function openProfileEditor() {
    setProfileDraft({ handle: profile.handle, displayName: profile.displayName, bio: profile.bio ?? "" });
    setProfileError(""); setProfileOpen(true);
  }

  async function saveProfile() {
    setProfileSaving(true); setProfileError("");
    try {
      const response = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profileDraft) });
      const body = await response.json() as { data?: { warning?: string }; error?: unknown };
      if (!response.ok) throw new Error(errorMessage(body, "Your profile could not be updated."));
      await refreshAccount();
      setProfileOpen(false); setSavedNotice(body.data?.warning ?? "Profile updated.");
    } catch (cause) { setProfileError(cause instanceof Error ? cause.message : "Your profile could not be updated."); }
    finally { setProfileSaving(false); }
  }

  async function setProfilePrivacy(isPrivate: boolean) {
    setPrivacySaving(true); setProfileError("");
    try {
      const response = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPrivate }) });
      const body = await response.json() as unknown;
      if (!response.ok) throw new Error(errorMessage(body, "Profile privacy could not be updated."));
      await refreshAccount();
      setSavedNotice(isPrivate ? "Profile is now private." : "Profile is now discoverable.");
    } catch (cause) { setProfileError(cause instanceof Error ? cause.message : "Profile privacy could not be updated."); }
    finally { setPrivacySaving(false); }
  }

  async function exportAccountData() {
    setExporting(true); setProfileError("");
    try {
      const response = await fetch("/api/account/export", { method: "POST" });
      const body = await response.json() as unknown;
      if (!response.ok) throw new Error(errorMessage(body, "Your export could not be prepared."));
      const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `delivery-data-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setSavedNotice("Personal data export downloaded. Recording links expire in ten minutes.");
    } catch (cause) { setProfileError(cause instanceof Error ? cause.message : "Your export could not be prepared."); }
    finally { setExporting(false); }
  }

  async function unblock(handle: string) {
    const response = await fetch("/api/blocks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle }) });
    const body = await response.json() as unknown;
    if (!response.ok) { setProfileError(errorMessage(body, "That performer could not be unblocked.")); return; }
    setBlockedProfiles((current) => current.filter((profile) => profile.handle !== handle));
    setSavedNotice(`@${handle} unblocked.`);
  }

  const navigation = [{ label: "Avatar", icon: UserRound }, { label: "Content", icon: Mic }, { label: "Playback", icon: Volume2 }, { label: "Privacy", icon: ShieldCheck }, { label: "Account", icon: Eye }];

  return (
    <div className="grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label="Settings sections" className="panel grid h-fit grid-cols-2 p-2 lg:sticky lg:top-28 lg:grid-cols-1">{navigation.map(({ label, icon: Icon }) => <a key={label} href={`#${label.toLowerCase()}`} className="flex min-h-12 items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold text-white/65 hover:bg-white/5 hover:text-white"><Icon className="size-4" /> {label}</a>)}</nav>
      <div className="grid min-w-0 gap-5">
        <Section id="avatar" title="Your performance avatar" description="Your default character for recording and new clips. Change it for any clip in the editor.">
          <div className="mb-2 flex items-center gap-4"><SpeechAvatar avatar={avatarPreference.avatar} size={112} /><p className="text-sm font-semibold text-white/70">{profile.displayName}</p></div>
          <AvatarPicker value={avatarPreference.avatar} onChange={avatarPreference.setAvatar} disabled={avatarPreference.loading || avatarPreference.saving} />
          {avatarPreference.saving && <p className="text-xs text-white/60" role="status">Saving avatar…</p>}
          {avatarPreference.error && <p className="text-xs text-hot" role="alert">{avatarPreference.error}</p>}
        </Section>
        <Section id="content" title="Your kind of trouble" description="Choose the intensity of lines shown in Classic, packs, and challenge creation.">
          <ContentControl value={contentRating} onChange={(contentRating) => updatePreferences({ contentRating })} />
          <p className="text-sm leading-6 text-white/65">Saved on this device. Hosts choose a separate setting when opening Stream Mode; each new stage setup starts clean.</p>
        </Section>
        <Section id="playback" title="Playback & motion" description="Tune the game to your device and your nervous system.">
          <Toggle title="Playback audio" description="Play recorded takes with sound on this device." icon={Volume2} checked={!muted} onChange={(value) => updatePreferences({ muted: !value })} />
          <Toggle title="Full motion" description="Celebrations, card movement, and animated score reveals." icon={Mic} checked={!reducedMotion} onChange={(value) => updatePreferences({ reducedMotion: !value })} />
        </Section>

        <Section id="privacy" title="Privacy" description="Your voice belongs to you. New recordings are private until you choose otherwise.">
          {authenticated && <Toggle title={privacySaving ? "Updating profile privacy…" : "Private profile"} description="Hide your profile, public tape, badges, and leaderboard presence from everyone except people already following you." icon={ShieldCheck} checked={Boolean(profile.isPrivate)} onChange={(value) => { if (!privacySaving) void setProfilePrivacy(value); }} />}
          <div className="rounded-xl border border-acid/15 bg-acid/[0.06] p-4 text-xs font-bold leading-5 text-white/55"><ShieldCheck className="mb-2 size-4 text-acid" /> Every new take starts private. Choose Publish on an eligible result or in your profile to share that individual recording after a safety check. Guest takes never appear on a public profile.</div>
          {authenticated && <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"><div className="flex items-center gap-2"><Ban className="size-4 text-white/65" /><p className="text-sm font-black">Blocked performers</p></div>{blocksLoading ? <p className="mt-3 text-xs text-white/60">Loading your list…</p> : blockedProfiles.length ? <div className="mt-3 grid gap-2">{blockedProfiles.map((blocked) => <div key={blocked.handle} className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2"><div><p className="text-xs font-black">{blocked.displayName}</p><p className="text-[10px] font-bold text-white/60">@{blocked.handle}</p></div><button onClick={() => void unblock(blocked.handle)} className="button-ghost min-h-11 px-3 text-[10px]">Unblock</button></div>)}</div> : <p className="mt-3 text-xs leading-5 text-white/60">Nobody is blocked. Use Block on a performer&apos;s public profile to hide each other&apos;s content and remove follows.</p>}</div>}
          {profileError && <p role="alert" className="text-xs font-bold text-orange-200">{profileError}</p>}
        </Section>

        <Section id="account" title={authenticated ? "Account & billing" : "Guest data"} description={authenticated ? `Signed in as ${accountEmail ?? "a Delivery player"} · ${tier === "pro" ? "Delivery Pro" : "Free plan"}` : "Sign in to sync history, publish takes, and challenge friends."}>
          {authenticated ? <div className="flex flex-wrap gap-2">{tier === "pro" ? <button onClick={() => void manageBilling()} disabled={billingLoading || !billing.portalAvailable} className="button-secondary disabled:opacity-50"><CreditCard className="size-4" /> {billingLoading ? "Opening…" : billing.portalAvailable ? "Manage billing" : "Billing currently unavailable"}</button> : billing.checkoutAvailable ? <Link href="/pricing" className="button-primary"><CreditCard className="size-4" /> Upgrade to Pro</Link> : null}<button onClick={openProfileEditor} className="button-secondary"><UserRound className="size-4" /> Edit profile</button><button onClick={() => void exportAccountData()} disabled={exporting} className="button-secondary"><Download className="size-4" /> {exporting ? "Preparing…" : "Download my data"}</button><button onClick={() => void signOut()} className="button-secondary"><LogOut className="size-4" /> Sign out</button></div> : <Link href="/login?next=/settings" className="button-primary w-fit">Sign in</Link>}
          {billingError && <p role="alert" className="text-xs font-bold text-orange-200">{billingError}</p>}

          {authenticated && profileOpen && <div className="rounded-2xl border border-electric/20 bg-electric/[0.07] p-4"><p className="mono-label text-electric">Public profile</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-black text-white/50">Display name<input value={profileDraft.displayName} onChange={(event) => setProfileDraft((value) => ({ ...value, displayName: event.target.value }))} maxLength={48} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm font-bold text-white outline-none focus:border-electric/50" /></label><label className="text-xs font-black text-white/50">Handle<input value={profileDraft.handle} onChange={(event) => setProfileDraft((value) => ({ ...value, handle: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") }))} minLength={3} maxLength={24} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 font-mono text-sm font-bold text-white outline-none focus:border-electric/50" /></label><label className="text-xs font-black text-white/50 sm:col-span-2">Bio<textarea value={profileDraft.bio} onChange={(event) => setProfileDraft((value) => ({ ...value, bio: event.target.value }))} maxLength={240} rows={3} className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm font-bold leading-6 text-white outline-none focus:border-electric/50" placeholder="What should the audience know?" /></label></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => void saveProfile()} disabled={profileSaving || profileDraft.handle.length < 3 || !profileDraft.displayName.trim()} className="button-primary min-h-11 px-4 disabled:opacity-40">{profileSaving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Save profile</button><button onClick={() => setProfileOpen(false)} disabled={profileSaving} className="button-ghost min-h-11 px-3">Cancel</button></div>{profileError && <p role="alert" className="mt-3 text-xs font-bold text-orange-200">{profileError}</p>}</div>}

          {confirmingLocal ? <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4"><p className="text-sm font-black text-red-100">Clear this device&apos;s history, favorites, and preferences?</p><p className="mt-1 text-xs text-red-100/55">Cloud recordings are unaffected.</p><div className="mt-4 flex gap-2"><button onClick={() => { clearLocalData(); setConfirmingLocal(false); setSavedNotice("Local data cleared."); }} className="min-h-11 rounded-lg bg-red-500 px-4 py-2 text-xs font-black">Clear device</button><button onClick={() => setConfirmingLocal(false)} className="button-ghost min-h-11 px-3">Cancel</button></div></div> : <button onClick={() => setConfirmingLocal(true)} className="button-secondary w-fit border-red-400/20 text-red-200"><Trash2 className="size-4" /> Clear this device</button>}
          {savedNotice && <p role="status" className="text-xs font-black text-acid">{savedNotice}</p>}

          {authenticated && <div className="mt-3 border-t border-white/10 pt-6"><p className="mono-label text-red-300">Danger zone</p><p className="mt-2 text-sm font-black">Permanently delete your Delivery account</p><p className="mt-1 max-w-2xl text-xs leading-5 text-white/55">This cancels the linked subscription, deletes recordings and profile data, and cannot be undone.</p>{deleteOpen ? <div className="mt-4 rounded-xl border border-red-400/25 bg-red-400/10 p-4"><label className="text-xs font-black text-red-100" htmlFor="delete-confirmation">Type DELETE to confirm</label><input id="delete-confirmation" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" className="mt-2 w-full rounded-xl border border-red-300/20 bg-black/30 px-3 py-3 font-mono text-sm font-black outline-none focus:border-red-300/50" placeholder="DELETE" /><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => void deleteAccount()} disabled={deleteConfirmation !== "DELETE" || deletingAccount} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-red-500 px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{deletingAccount && <LoaderCircle className="size-4 animate-spin" />} Delete account forever</button><button onClick={() => { setDeleteOpen(false); setDeleteConfirmation(""); setDeleteError(""); }} disabled={deletingAccount} className="button-ghost min-h-11 px-3">Cancel</button></div>{deleteError && <p role="alert" className="mt-3 text-xs font-bold text-red-100">{deleteError}</p>}</div> : <button onClick={() => setDeleteOpen(true)} className="button-ghost mt-4 min-h-11 w-fit border border-red-400/20 px-3 text-red-200"><Trash2 className="size-4" /> Delete account</button>}</div>}
        </Section>
      </div>
    </div>
  );
}

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return <section id={id} className="panel-solid scroll-mt-24 p-5 sm:p-7"><h2 className="text-2xl font-black tracking-[-0.04em]">{title}</h2><p className="mt-2 text-sm leading-6 text-white/60">{description}</p><div className="mt-6 grid gap-3">{children}</div></section>;
}

function Toggle({ title, description, icon: Icon, checked, onChange }: { title: string; description: string; icon: typeof Bell; checked: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 text-left"><div className="flex items-start gap-3"><Icon className="mt-0.5 size-4 text-white/65" /><div><p className="text-sm font-black">{title}</p><p className="mt-1 text-xs leading-5 text-white/55">{description}</p></div></div><span className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-acid" : "bg-white/10"}`}><span className={`absolute top-1 size-5 rounded-full bg-black transition ${checked ? "left-6" : "left-1 bg-white/60"}`} /></span></button>;
}

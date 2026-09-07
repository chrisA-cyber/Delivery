import "server-only";
import { AppError, ExternalServiceError } from "@/lib/server/api-error";
import { getGroupViewer, type GroupViewer } from "@/lib/server/group-rounds";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { StoredRoastRoom } from "@/lib/server/roast-store";

export interface RoastViewer extends GroupViewer { ownerKey: string; canHostPublic: boolean; name: string }
export async function getRoastViewer(request: Request, requestKey?: string): Promise<RoastViewer> {
  const viewer = await getGroupViewer(request, requestKey);
  let role = "user";
  let name = "Guest";
  if (viewer.user) {
    const admin = createSupabaseAdminClient();
    const [profile, restrictions] = await Promise.all([
      admin.from("profiles").select("role,display_name,handle").eq("id", viewer.user.id).maybeSingle(),
      admin.from("account_restrictions").select("starts_at,ends_at").eq("user_id", viewer.user.id).in("kind", ["profile-limit", "profile-remove"]),
    ]);
    if (profile.error || restrictions.error) throw new ExternalServiceError("Account access");
    const now = Date.now();
    if (!profile.data || (restrictions.data ?? []).some(r => Date.parse(String(r.starts_at)) <= now && (!r.ends_at || Date.parse(String(r.ends_at)) > now))) {
      throw new AppError("ROAST_ACCOUNT_UNAVAILABLE", "This account cannot enter a live stage.", 403);
    }
    role = String(profile.data.role);
    name = String(profile.data.display_name || profile.data.handle || "Player").slice(0, 32);
  }
  const designated = (process.env.ROAST_PUBLIC_HOST_IDS ?? "").split(",").map(s => s.trim()).includes(viewer.user?.id ?? "none");
  return { ...viewer, ownerKey: viewer.user ? `user:${viewer.user.id}` : `guest:${viewer.guest.idempotencyScope}`, name,
    canHostPublic: Boolean(viewer.user && (designated || role === "admin" || role === "moderator")) };
}
function ownedMember(room: StoredRoastRoom, ownerKey: string): string | null {
  return Object.entries(room.owners).find(([, owner]) => owner.ownerKey === ownerKey)?.[0] ?? null;
}
function previousGuestMember(room: StoredRoastRoom, viewer: RoastViewer): string | null {
  // A newly minted provisional cookie is not proof of owning an existing guest.
  if (!viewer.user || viewer.guest.setCookie) return null;
  return Object.entries(room.owners).find(([, owner]) => !owner.userId && owner.ownerKey === `guest:${viewer.guest.idempotencyScope}`)?.[0] ?? null;
}
export function findRoastMember(room: StoredRoastRoom, viewer: RoastViewer): string | null {
  return ownedMember(room, viewer.ownerKey) ?? previousGuestMember(room, viewer);
}
/** Guest-to-account continuity retains the exact membership, vote and queue identity. */
export function claimRoastMember(room: StoredRoastRoom, viewer: RoastViewer): string | null {
  const current = ownedMember(room, viewer.ownerKey);
  if (current || !viewer.user) return current;
  const previous = previousGuestMember(room, viewer);
  if (!previous) return null;
  room.owners[previous] = {ownerKey: viewer.ownerKey, userId: viewer.user.id};
  if (room.state.members[previous]) room.state.members[previous].signedIn = true;
  return previous;
}

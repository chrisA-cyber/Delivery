import "server-only";
import { tickRoom, desiredPublish } from "@/lib/roast/engine";
import { ROAST_LIMITS } from "@/lib/roast/types";
import type { StoredRoastRoom, RoastLease } from "@/lib/server/roast-store";
import { activeRoastRooms, loadRoastRoom, forgetRoastRoom, withRoastLease, markRoastWorkerAlive } from "@/lib/server/roast-store";
import { deleteRoastMediaRoom, listRoastMediaParticipants, reconcileRoastMediaPermissions, removeRoastMediaParticipant, roastMediaConfigured } from "@/lib/server/roast-media";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function syncRoastMedia(room: StoredRoastRoom, lease: RoastLease): Promise<void> {
  if (!room.mediaCreated) return;
  await lease.assert();
  if (room.state.phase === "closed") {
    // Room deletion alone need not invalidate a refreshed join token. Revoke
    // every issued identity, including disconnected peers, before deleting it.
    const participants = await listRoastMediaParticipants(room.mediaRoom, true);
    const issuedIds = [...new Set([...Object.keys(room.owners), ...participants.map(participant => participant.identity)])];
    for (let offset = 0; offset < issuedIds.length; offset += 4) {
      const revoked = await Promise.allSettled(issuedIds.slice(offset, offset + 4).map(async identity => {
        await lease.assert();
        await removeRoastMediaParticipant(room.mediaRoom, identity);
      }));
      const failure = revoked.find(result => result.status === "rejected");
      if (failure?.status === "rejected") throw failure.reason;
    }
    await lease.assert();
    await deleteRoastMediaRoom(room.mediaRoom);
    room.mediaCreated = false;
    return;
  }
  for (const participant of await listRoastMediaParticipants(room.mediaRoom)) {
    const member = room.state.members[participant.identity];
    if (!member || member.removed || member.left || member.lastSeenAt + ROAST_LIMITS.presenceMs <= Date.now() || room.state.bannedIds.includes(participant.identity)) {
      await lease.assert();
      await removeRoastMediaParticipant(room.mediaRoom, participant.identity);
    }
  }
  const policies = Object.values(room.state.members).filter(m => !m.removed).map(member => {
    const desired = desiredPublish(room.state, member.id);
    return {identity: member.id, microphone: desired.audio, camera: desired.video};
  });
  await reconcileRoastMediaPermissions(room.mediaRoom, policies, lease.assert);
}

async function archiveResults(room: StoredRoastRoom, lease: RoastLease) {
  const admin = createSupabaseAdminClient();
  for (const result of room.state.history) {
    if (room.archivedResults.includes(result.id)) continue;
    await lease.assert();
    // Result IDs are deterministic per room incarnation/battle; conflict retries cannot double count.
    const saved = await admin.from("roast_battle_results").upsert({
      id: result.id, room_id: room.state.id, visibility: room.state.visibility,
      performer_names: result.performerNames, result,
      ended_at: new Date(result.endedAt).toISOString(), expires_at: new Date(result.endedAt + 30 * 86_400_000).toISOString(),
    }, {onConflict: "id", ignoreDuplicates: true});
    if (saved.error) throw new Error("Roast history could not be saved.");
    room.archivedResults.push(result.id);
  }
  room.archivedResults = room.archivedResults.slice(-40);
}

/** One existing-process worker owns clocks; browser refreshes never advance a phase. */
export async function runRoastTick(): Promise<void> {
  if (!roastMediaConfigured()) return;
  await withRoastLease(async lease => {
    for (const id of await activeRoastRooms()) {
      const room = await loadRoastRoom(id);
      if (!room) { await lease.assert(); await forgetRoastRoom(id); continue; }
      let connectedIds: string[] = [];
      let providerHealthy = true;
      try {
        if (room.mediaCreated) connectedIds = (await listRoastMediaParticipants(room.mediaRoom)).filter(p => p.connected).map(p => p.identity);
      } catch { providerHealthy = false; }
      const previousState = room.state;
      const decisionAt = Date.now();
      room.state = tickRoom(previousState, decisionAt, {connectedIds, providerHealthy});
      // Apply the SFU change before viewers see the next timed phase. A failure
      // starts from the previous phase, so a candidate result cannot become an
      // audience verdict when the media transition itself did not succeed.
      try { await syncRoastMedia(room, lease); }
      catch {
        room.state = tickRoom(previousState, Date.now(), {connectedIds: [], providerHealthy: false});
        await lease.save(room);
        // No grants or retries after an uncertain provider mutation.
        continue;
      }
      // A slow permission request must not consume the next performer's turn,
      // nor the listening buffer that begins after the final microphone closes.
      if (room.state.deadline !== null && room.state.deadline !== previousState.deadline) {
        const elapsed = Math.max(0, Date.now() - decisionAt);
        room.state.deadline += elapsed;
        if (room.state.battle?.startedAt === decisionAt && previousState.battle?.startedAt === null) room.state.battle.startedAt += elapsed;
      }
      await lease.save(room);
      await archiveResults(room, lease).catch(() => { console.error("Roast history will retry."); });
      await lease.save(room);
    }
    await markRoastWorkerAlive();
  });
}
export async function cleanupRoastHistory(): Promise<void> {
  const result = await createSupabaseAdminClient().from("roast_battle_results").delete().lt("expires_at", new Date().toISOString());
  if (result.error) throw new Error("Roast history cleanup will retry.");
}

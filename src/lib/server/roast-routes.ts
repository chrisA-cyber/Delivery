import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { addMember, applyAction, closeRoomForMediaFailure, createRoom, desiredPublish, RoastError, snapshotRoom, tickRoom } from "@/lib/roast/engine";
import { ROAST_LIMITS, type RoastAction } from "@/lib/roast/types";
import { AppError, jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { getRoastViewer, findRoastMember, claimRoastMember, type RoastViewer } from "@/lib/server/roast-identity";
import { createRoastMediaRoom, deleteRoastMediaRoom, issueRoastMediaToken, removeRoastMediaParticipant, roastMediaConfigured } from "@/lib/server/roast-media";
import { activeRoastRooms, loadRoastRoom, ROAST_MAX_ROOMS, roastRoomNeedsWorker, roastWorkerAlive, withRoastLease, type StoredRoastRoom } from "@/lib/server/roast-store";
import { syncRoastMedia } from "@/lib/server/roast-runtime";
import { enforceRateLimit, getClientKey } from "@/lib/server/rate-limit";
import { assertContentLength, assertJsonRequest, assertSameOrigin } from "@/lib/server/request";
import { insertReport, prepareReportActor } from "@/lib/server/reports";
import { createRequestFingerprint, runIdempotent } from "@/lib/server/idempotency";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const idSchema = z.union([z.literal("main"), z.string().uuid()]);
const nameSchema = z.string().trim().min(1).max(32).regex(/^[^\u0000-\u001f\u007f<>]+$/);
const headers = (cookie?: string) => ({"Cache-Control":"private, no-store", "Referrer-Policy":"no-referrer", ...(cookie ? {"Set-Cookie":cookie} : {})});
const notFound = () => new AppError("ROAST_NOT_FOUND", "This room is unavailable or its invitation has changed.", 404);
const reportReasons = z.enum(["harassment","hate","sexual","violence","self_harm","spam","privacy","copyright","other"]);
const commonFields = {
  requestId: z.string().uuid(), inviteToken: z.string().max(100).optional(),
  expectedRevision: z.number().int().nonnegative().optional(), battleId: z.string().uuid().optional(),
};
// Validate each command before passing it to the pure state machine. Optional
// fields on unrelated commands must never become undefined engine arguments.
const bodySchema = z.discriminatedUnion("action", [
  z.object({ ...commonFields, action:z.literal("join"), name:nameSchema.optional(), adult:z.literal(true) }).strict(),
  z.object({ ...commonFields, action:z.literal("heartbeat") }).strict(),
  z.object({ ...commonFields, action:z.literal("ready"), adultAcknowledged:z.literal(true), microphoneReady:z.literal(true), cameraEnabled:z.boolean().optional() }).strict(),
  z.object({ ...commonFields, action:z.literal("queue_join") }).strict(),
  z.object({ ...commonFields, action:z.literal("queue_leave") }).strict(),
  z.object({ ...commonFields, action:z.literal("offer_accept"), offerExpiresAt:z.number().int().positive() }).strict(),
  z.object({ ...commonFields, action:z.literal("offer_decline") }).strict(),
  z.object({ ...commonFields, action:z.literal("step_down") }).strict(),
  z.object({ ...commonFields, action:z.literal("leave") }).strict(),
  z.object({ ...commonFields, action:z.literal("camera"), enabled:z.boolean() }).strict(),
  z.object({ ...commonFields, action:z.literal("vote"), candidateId:z.string().uuid(), battleId:z.string().uuid() }).strict(),
  z.object({ ...commonFields, action:z.literal("chat"), text:z.string().trim().min(1).max(280) }).strict(),
  z.object({ ...commonFields, action:z.literal("react"), kind:z.enum(["fire","laugh","clap","wow"]) }).strict(),
  z.object({ ...commonFields, action:z.literal("block"), memberId:z.string().uuid(), blocked:z.boolean() }).strict(),
  z.object({ ...commonFields, action:z.literal("host_pause") }).strict(),
  z.object({ ...commonFields, action:z.literal("host_resume") }).strict(),
  z.object({ ...commonFields, action:z.literal("host_skip") }).strict(),
  z.object({ ...commonFields, action:z.literal("host_end") }).strict(),
  z.object({ ...commonFields, action:z.literal("host_queue_move"), memberId:z.string().uuid(), position:z.number().int().min(0).max(ROAST_LIMITS.queue - 1) }).strict(),
  z.object({ ...commonFields, action:z.literal("host_queue_remove"), memberId:z.string().uuid() }).strict(),
  z.object({ ...commonFields, action:z.literal("host_mute"), memberId:z.string().uuid(), muted:z.boolean() }).strict(),
  z.object({ ...commonFields, action:z.literal("host_remove"), memberId:z.string().uuid(), ban:z.boolean().optional() }).strict(),
  z.object({ ...commonFields, action:z.literal("host_chat_remove"), messageId:z.string().min(1).max(100) }).strict(),
  z.object({ ...commonFields, action:z.literal("report"), memberId:z.string().uuid(), reason:reportReasons, details:z.string().trim().max(700).optional() }).strict(),
  z.object({ ...commonFields, action:z.literal("revoke_invite") }).strict(),
]);
const RECEIPT_TTL_MS = 24 * 60 * 60_000;

function assertInvitation(room: StoredRoastRoom, viewer: RoastViewer, token?: string | null) {
  const memberId = findRoastMember(room, viewer);
  if (memberId && (room.state.members[memberId]?.removed || room.state.bannedIds.includes(memberId))) {
    throw new AppError("ROAST_REMOVED", "The host removed you from this room.", 403);
  }
  if (room.state.visibility === "public" || memberId) return;
  if (!token || !room.inviteHash || hash(token) !== room.inviteHash) throw notFound();
}
function assertMember(room: StoredRoastRoom, id: string | null): asserts id is string {
  if (!id || !room.state.members[id] || room.state.members[id].left) throw new AppError("ROAST_JOIN_REQUIRED", "Join the audience first.", 403);
  if (room.state.members[id].removed || room.state.bannedIds.includes(id)) throw new AppError("ROAST_REMOVED", "The host removed you from this room.", 403);
}
async function available() { return roastMediaConfigured() && await roastWorkerAlive(); }
async function assertAvailable() {
  if (!roastMediaConfigured()) throw new AppError("ROAST_MEDIA_NOT_CONFIGURED", "Live rooms are waiting for their media connection. Roast Off is not open yet.", 503);
  if (!await roastWorkerAlive()) throw new AppError("ROAST_CONTROL_OFFLINE", "The live stage is temporarily offline. Please try again shortly.", 503);
}
async function readBody(request: Request) {
  assertSameOrigin(request); assertJsonRequest(request); assertContentLength(request, 8192);
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 8192) throw new AppError("PAYLOAD_TOO_LARGE", "Keep that request short.", 413);
  return JSON.parse(raw) as unknown;
}

export async function handleRoastLobby(request: Request) {
  const requestId = requestIdFrom(request); let cookie: string | undefined;
  try {
    if (request.method === "GET") {
      const viewer = await getRoastViewer(request); cookie = viewer.setCookie;
      await enforceRateLimit(getClientKey(request,"roast-lobby"), {limit:120,windowMs:60_000});
      const configured = roastMediaConfigured();
      const live = configured && await available();
      const main = live ? await loadRoastRoom("main") : null;
      const summary = main && main.state.phase !== "closed" ? snapshotRoom(main.state, null, Date.now()) : null;
      return jsonOk({available:live, reason: live ? null : configured ? "The stage is temporarily offline." : "Live rooms are waiting for their media connection. Roast Off is not open yet.", signedIn:Boolean(viewer.user),canHostPublic:viewer.canHostPublic,
        capacity:ROAST_LIMITS.members, maxRooms:ROAST_MAX_ROOMS,
        main:summary ? {id:summary.id,name:summary.name,status:summary.phase,memberCount:summary.memberCount,performers:summary.stage.filter(Boolean)} : null},requestId,{headers:headers(cookie)});
    }
    const body = z.object({kind:z.enum(["private","public"]),name:nameSchema,adult:z.literal(true),requestId:z.string().uuid()}).strict().parse(await readBody(request));
    const viewer = await getRoastViewer(request,body.requestId); cookie=viewer.setCookie;
    if (!viewer.user) throw new AppError("UNAUTHORIZED","Sign in to host a live room.",401);
    if (body.kind === "public" && !viewer.canHostPublic) throw new AppError("ROAST_HOST_FORBIDDEN","An authorized moderator opens the public stage.",403);
    await enforceRateLimit(`roast-create:${viewer.ownerKey}`,{limit:6,windowMs:60*60_000});
    await assertAvailable();
    const receipt = await runIdempotent("roast-create", viewer.ownerKey, body.requestId,
      createRequestFingerprint(JSON.stringify(body)), RECEIPT_TTL_MS, () => withRoastLease(async lease => {
      const creationKey = hash(`${viewer.ownerKey}:${body.requestId}`);
      const ids = await activeRoastRooms();
      for (const id of ids) {
        const existing = await loadRoastRoom(id);
        if (existing?.creationKey === creationKey || (existing && existing.state.phase !== "closed" && existing.owners[existing.state.hostId]?.ownerKey === viewer.ownerKey)) {
          // A fresh invite on an idempotent creation response must not revoke the old one.
          return {roomId:existing.state.id,room:snapshotRoom(existing.state,existing.state.hostId,Date.now())};
        }
      }
      if (ids.length >= ROAST_MAX_ROOMS) throw new AppError("ROAST_ROOMS_FULL","Both live stages are occupied. Try again when a room closes.",409);
      if (body.kind === "public") {
        const current = await loadRoastRoom("main");
        if (current && current.state.phase !== "closed") throw new AppError("ROAST_PUBLIC_ACTIVE","The public stage is already open.",409);
        if (current && roastRoomNeedsWorker(current)) throw new AppError("ROAST_CLOSING","The previous public stage is still closing. Try again once cleanup finishes.",409);
      }
      const id = body.kind === "public" ? "main" : randomUUID(); const hostId = randomUUID();
      const inviteToken = body.kind === "private" ? randomBytes(32).toString("base64url") : null;
      const room:StoredRoastRoom = {state:createRoom({id,name:body.kind === "public" ? "The Roast Off stage" : body.name,visibility:body.kind,host:{id:hostId,name:viewer.name,signedIn:true,adultAcknowledged:true}},Date.now()),
        owners:{[hostId]:{ownerKey:viewer.ownerKey,userId:viewer.user!.id}},inviteHash:inviteToken ? hash(inviteToken) : null,
        mediaRoom:`roast-${randomUUID()}`,mediaCreated:false,archivedResults:[],creationKey,updatedAt:Date.now()};
      await lease.save(room);
      await lease.assert();
      try { await createRoastMediaRoom(room.mediaRoom,ROAST_LIMITS.members); room.mediaCreated=true; }
      catch { room.state=applyAction(room.state,hostId,{type:"host_end"},Date.now()); await lease.save(room); throw new AppError("ROAST_MEDIA_UNAVAILABLE","The live media service could not open this room.",503); }
      await lease.save(room);
      return {roomId:id,inviteToken,room:snapshotRoom(room.state,hostId,Date.now())};
    }));
    return jsonOk(receipt.value,requestId,{status:201,headers:headers(cookie)});
  } catch(error) { return jsonError(error instanceof RoastError ? new AppError(error.code,error.message,error.status) : error,requestId,headers(cookie)); }
}

export async function handleRoastRoom(request:Request, rawId:string, media=false) {
  const requestId=requestIdFrom(request); let cookie:string|undefined;
  try {
    const id=idSchema.parse(rawId);
    const raw = request.method === "GET" ? null : await readBody(request);
    const body = raw && !media ? bodySchema.parse(raw) : null;
    const mediaBody = media ? z.object({inviteToken:z.string().max(100).optional(),requestId:z.string().uuid().optional()}).strict().parse(raw) : null;
    const viewer=await getRoastViewer(request,body?.requestId ?? mediaBody?.requestId); cookie=viewer.setCookie;
    const readOnly = request.method === "GET";
    const rateNamespace = `roast-${readOnly ? "read" : "action"}`;
    // People in the same audience may share Wi-Fi. Bound each established
    // identity as well as the whole network without charging every heartbeat
    // against one small per-person IP bucket.
    await enforceRateLimit(getClientKey(request, rateNamespace), {limit:readOnly ? 1800 : 2400,windowMs:60_000});
    await enforceRateLimit(`${rateNamespace}:${viewer.ownerKey}`, {limit:readOnly ? 120 : 180,windowMs:60_000});
    if (request.method === "GET") {
      const room=await loadRoastRoom(id); if(!room)throw notFound();
      assertInvitation(room,viewer,new URL(request.url).searchParams.get("invite"));
      const memberId=findRoastMember(room,viewer);
      const snapshot=snapshotRoom(room.state,memberId,Date.now());
      if (!memberId) {snapshot.chat=[];snapshot.reactions=[];snapshot.history=[];snapshot.viewer.signedIn=Boolean(viewer.user);}
      if (!await roastWorkerAlive() && snapshot.phase !== "closed") {snapshot.mediaHealthy=false;snapshot.phaseLabel="The stage connection is unavailable";}
      return jsonOk({room:snapshot},requestId,{headers:headers(cookie)});
    }
    const result = await withRoastLease(async lease => {
      const room=await loadRoastRoom(id); if(!room)throw notFound();
      assertInvitation(room,viewer,body?.inviteToken ?? mediaBody?.inviteToken);
      let memberId=claimRoastMember(room,viewer);
      if(room.state.visibility==="public" && room.state.hostId===memberId && !viewer.canHostPublic &&
        !["leave","host_end"].includes(body?.action ?? "")) {
        throw new AppError("ROAST_HOST_FORBIDDEN","Public host authorization is unavailable.",403);
      }
      if (media) {
        assertMember(room,memberId); await assertAvailable();
        if(room.state.phase==="closed")throw new AppError("ROAST_CLOSED","This room has closed.",410);
        await enforceRateLimit(`roast-token:${viewer.ownerKey}`,{limit:12,windowMs:60_000});
        await lease.save(room);
        return await issueRoastMediaToken({roomId:room.mediaRoom,identity:memberId,name:room.state.members[memberId]!.name});
      }
      if (!body) throw new AppError("INVALID_REQUEST","Choose an action.",422);
      if(body.action === "join") {
        await assertAvailable();
        if(body.adult !== true)throw new AppError("ROAST_ADULT_REQUIRED","Roast Off is for adults. Acknowledge that you are 18 or older to enter.",422);
        if(!memberId && Object.keys(room.owners).length >= 512)throw new AppError("ROAST_SESSION_FULL","This stage has reached its session participation limit. The host can open a new room.",409);
        memberId ??= randomUUID();
        if(room.state.members[memberId]?.removed || room.state.bannedIds.includes(memberId))throw new AppError("ROAST_REMOVED","You cannot rejoin this room after host removal.",403);
        room.state=addMember(room.state,{id:memberId,name:viewer.user ? viewer.name : body.name ?? "Guest",signedIn:Boolean(viewer.user),adultAcknowledged:true},Date.now());
        room.owners[memberId]={ownerKey:viewer.ownerKey,userId:viewer.user?.id ?? null};
        await lease.save(room);
        return {room:snapshotRoom(room.state,memberId,Date.now())};
      }
      assertMember(room,memberId);
      if (body.action === "revoke_invite") {
        if(room.state.hostId!==memberId || room.state.visibility!=="private")throw new AppError("ROAST_HOST_FORBIDDEN","Only this private room's host can change its invitation.",403);
        const receipt = await runIdempotent("roast-invite", `${id}:${viewer.ownerKey}`, body.requestId,
          createRequestFingerprint(JSON.stringify(body)), RECEIPT_TTL_MS, async () => {
            const inviteToken=randomBytes(32).toString("base64url");
            room.inviteHash=hash(inviteToken);await lease.save(room);
            return {inviteToken};
          });
        return {room:snapshotRoom(room.state,memberId,Date.now()),inviteToken:receipt.value.inviteToken};
      }
      if (body.action === "report") {
        if(!body.memberId || !room.state.members[body.memberId] || !body.reason)throw new AppError("ROAST_REPORT_TARGET","Choose someone in this room and a reason.",422);
        const reportActor=await prepareReportActor(request,viewer.user,body.requestId);
        const target=room.state.members[body.memberId]!;
        await runIdempotent("roast-report",`${id}:${viewer.ownerKey}`,body.requestId,createRequestFingerprint(JSON.stringify(body)),RECEIPT_TTL_MS,async()=>({id:await insertReport(reportActor,{roastRoomId:id,roastMemberId:target.id,reason:body.reason!,details:`Roast Off / ${room.state.name} / ${target.name}: ${body.details??"Live room incident. No recording is retained."}`.slice(0,1000)})}));
        await lease.save(room);
        return {room:snapshotRoom(room.state,memberId,Date.now()),reported:true};
      }
      if(body.action === "chat" || body.action === "react") {
        await enforceRateLimit(`roast-${body.action}:${viewer.ownerKey}`,{limit:body.action==="chat"?8:12,windowMs:10_000});
      }
      if(!["leave","queue_leave","step_down","host_end","host_remove","host_mute"].includes(body.action))await assertAvailable();
      const {action, inviteToken: _invite, ...fields}=body;
      void _invite;
      const previous=room.state;
      const command = {type:action,...fields} as RoastAction;
      room.state=applyAction(room.state,memberId,command,Date.now());
      const revokeIds=Object.values(room.state.members).filter(m=>m.removed && !previous.members[m.id]?.removed).map(m=>m.id);
      if(body.action === "leave")revokeIds.push(memberId);
      try {
        for(const identity of [...new Set(revokeIds)]) {await lease.assert();await removeRoastMediaParticipant(room.mediaRoom,identity);}
        // Publish the new control state only after its media authority has
        // synchronized; plain chat and heartbeats need no provider traffic.
        const policiesChanged = Object.keys({...previous.members,...room.state.members}).some(identity =>
          JSON.stringify(desiredPublish(previous,identity)) !== JSON.stringify(desiredPublish(room.state,identity)));
        if(policiesChanged || room.state.phase === "closed")await syncRoastMedia(room,lease);
      } catch {
        // Failed synchronization must not preserve a newly calculated forfeit
        // from cached media observations. Retain revocation intent against an
        // explicitly unhealthy state, producing a technical no-contest instead.
        room.state=tickRoom(previous,Date.now(),{connectedIds:[],providerHealthy:false});
        if(["leave","step_down","host_remove","host_mute","host_end"].includes(body.action)) {
          room.state=applyAction(room.state,memberId,{...command,expectedRevision:undefined},Date.now());
        }
        if(revokeIds.length) {
          // Closing the control plane stops replacement tokens. Deleting the
          // provider room cannot prove cached/refreshed tokens were revoked;
          // retain its cleanup marker until the worker revokes every issued ID.
          room.state=closeRoomForMediaFailure(room.state,Date.now());
          room.mediaCreated=true;
          await lease.save(room);
          await lease.assert();
          await deleteRoastMediaRoom(room.mediaRoom).catch(()=>{});
        }
        await lease.save(room);
        throw new AppError("ROAST_MEDIA_UNAVAILABLE",revokeIds.length
          ? "The media service could not confirm removal. The stage closed while access is revoked."
          : "The live media change could not finish. The stage is paused while its connection recovers.",503);
      }
      await lease.save(room);
      return {room:snapshotRoom(room.state,memberId,Date.now())};
    });
    return jsonOk(result,requestId,{headers:headers(cookie)});
  }catch(error){return jsonError(error instanceof RoastError?new AppError(error.code,error.message,error.status):error,requestId,headers(cookie));}
}

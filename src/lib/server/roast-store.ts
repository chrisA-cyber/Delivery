import "server-only";

import { randomUUID } from "node:crypto";
import type { RoastRoomState } from "@/lib/roast/types";
import { AppError } from "@/lib/server/api-error";
import { redisCommand } from "@/lib/server/redis";

export const ROAST_PREFIX = "delivery:roast:v1:";
export const ROAST_MAX_ROOMS = 2;
const LOCK = `${ROAST_PREFIX}lock`;
const ACTIVE = `${ROAST_PREFIX}active`;
const LEASE_MS = 35_000;
const ROOM_TTL = 24 * 60 * 60;
export interface RoastOwner { ownerKey: string; userId: string | null }
export interface StoredRoastRoom {
  state: RoastRoomState;
  owners: Record<string, RoastOwner>;
  inviteHash: string | null;
  mediaRoom: string;
  mediaCreated: boolean;
  archivedResults: string[];
  creationKey: string;
  updatedAt: number;
}
export interface RoastLease { assert(): Promise<void>; save(room: StoredRoastRoom): Promise<void> }
const busy = () => new AppError("ROAST_BUSY", "The stage is updating. Try again in a moment.", 409);
export function roastRoomNeedsWorker(room: StoredRoastRoom): boolean {
  return room.state.phase !== "closed" || room.mediaCreated ||
    room.state.history.some(result => !room.archivedResults.includes(result.id));
}

/** All room writes and SFU effects share this short, fenced lease. Reads never hold it. */
export async function withRoastLease<T>(work: (lease: RoastLease) => Promise<T>): Promise<T> {
  const token = randomUUID();
  const acquired = await redisCommand(["SET", LOCK, token, "NX", "PX", LEASE_MS]);
  if (acquired !== "OK") throw busy();
  let lost = false;
  const assert = async () => {
    if (lost) throw busy();
    // Renew only our lease. A stalled/expired caller may never recover ownership.
    const ok = await redisCommand(["EVAL", "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('PEXPIRE',KEYS[1],ARGV[2]) else return 0 end", 1, LOCK, token, LEASE_MS]);
    if (ok !== 1) { lost = true; throw busy(); }
  };
  try {
    return await work({ assert, save: async (room) => {
      if (lost) throw busy();
      // Owner IDs also form the bounded revocation ledger for refreshed SFU
      // tokens. Retain them after presence pruning until this room closes.
      room.updatedAt = Date.now();
      const ok = await redisCommand(["EVAL", "if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end; redis.call('SET',KEYS[2],ARGV[2],'EX',ARGV[3]); if ARGV[4]=='true' then redis.call('SADD',KEYS[3],ARGV[5]) else redis.call('SREM',KEYS[3],ARGV[5]) end; return 1", 3, LOCK, `${ROAST_PREFIX}room:${room.state.id}`, ACTIVE, token, JSON.stringify(room), ROOM_TTL, String(roastRoomNeedsWorker(room)), room.state.id]);
      if (ok !== 1) { lost = true; throw busy(); }
    }});
  } finally {
    await redisCommand(["EVAL", "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end", 1, LOCK, token]).catch(() => {});
  }
}

export async function loadRoastRoom(id: string): Promise<StoredRoastRoom | null> {
  const raw = await redisCommand(["GET", `${ROAST_PREFIX}room:${id}`]);
  return typeof raw === "string" ? JSON.parse(raw) as StoredRoastRoom : null;
}
export async function activeRoastRooms(): Promise<string[]> {
  return (await redisCommand(["SMEMBERS", ACTIVE]) as string[]).slice(0, ROAST_MAX_ROOMS + 1);
}
export async function forgetRoastRoom(id: string): Promise<void> {
  await redisCommand(["SREM", ACTIVE, id]);
}
export async function markRoastWorkerAlive(): Promise<void> {
  await redisCommand(["SET", `${ROAST_PREFIX}worker`, Date.now(), "EX", 12]);
}
export async function roastWorkerAlive(): Promise<boolean> {
  const at = Number(await redisCommand(["GET", `${ROAST_PREFIX}worker`]));
  return at > Date.now() - 12_000;
}

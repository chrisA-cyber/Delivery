import "server-only";

import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import { EnvironmentError, getServerEnv } from "@/lib/server/env";
import { getClientKey } from "@/lib/server/rate-limit";

const COOKIE_NAME = "delivery_device";
const DEVICE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const localSecret = randomBytes(32).toString("base64url");

function secret(): string {
  const env = getServerEnv();
  if (env.DELIVERY_DEVICE_SECRET) return env.DELIVERY_DEVICE_SECRET;
  if (env.NODE_ENV === "production") {
    throw new EnvironmentError(
      "DELIVERY_DEVICE_SECRET is required for guest abuse protection.",
      ["DELIVERY_DEVICE_SECRET"],
    );
  }
  return localSecret;
}

function sign(id: string): string {
  return createHmac("sha256", secret()).update(id).digest("base64url");
}

function readCookie(request: Request): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === COOKIE_NAME) {
      try { return decodeURIComponent(value.join("=")); } catch { return null; }
    }
  }
  return null;
}

function verifiedDeviceId(value: string | null): string | null {
  if (!value || value.length > 128) return null;
  const separator = value.lastIndexOf(".");
  if (separator < 1) return null;
  const id = value.slice(0, separator);
  const supplied = Buffer.from(value.slice(separator + 1));
  if (!DEVICE_ID.test(id)) return null;
  const expected = Buffer.from(sign(id));
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return null;
  }
  return id;
}

export interface GuestIdentity {
  idempotencyScope: string;
  scope: string;
  setCookie?: string;
}

function deviceIdForAttempt(attemptKey: string): string {
  const bytes = createHmac("sha256", secret())
    .update("delivery:provisional-device\0")
    .update(attemptKey)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getGuestIdentity(
  request: Request,
  provisionalAttemptKey?: string,
): GuestIdentity {
  const existing = verifiedDeviceId(readCookie(request));
  // The same first-ever attempt deterministically receives the same signed
  // provisional device. That makes concurrent/lost-response retries converge
  // before the browser has accepted its first Set-Cookie header.
  const id = existing ??
    (provisionalAttemptKey ? deviceIdForAttempt(provisionalAttemptKey) : randomUUID());
  // Keep the two dimensions distinct. The quota layer reserves both counters
  // atomically, so neither a network change nor a cleared cookie resets the
  // entire daily guest allowance.
  const deviceScope = createHash("sha256").update(id).digest("hex");
  const ipScope = createHash("sha256")
    .update(getClientKey(request, "guest-ip"))
    .digest("hex");
  const scope = `${deviceScope}.${ipScope}`;
  if (existing) return { scope, idempotencyScope: deviceScope };

  const env = getServerEnv();
  const value = encodeURIComponent(`${id}.${sign(id)}`);
  return {
    scope,
    idempotencyScope: deviceScope,
    setCookie: [
      `${COOKIE_NAME}=${value}`,
      "Path=/",
      "Max-Age=31536000",
      "HttpOnly",
      "SameSite=Lax",
      env.NODE_ENV === "production" ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; "),
  };
}

export function getAnonymousReportHashes(identity: GuestIdentity): {
  deviceHash: string;
  networkHash: string;
} {
  const [deviceScope, networkScope] = identity.scope.split(".");
  if (!deviceScope || !networkScope) {
    throw new EnvironmentError("Guest report identity is invalid.");
  }
  const utcDay = new Date().toISOString().slice(0, 10);
  const digest = (label: string, value: string) =>
    createHmac("sha256", secret())
      .update(label)
      .update("\0")
      .update(utcDay)
      .update("\0")
      .update(value)
      .digest("hex");
  return {
    deviceHash: digest("delivery:anonymous-report-device", deviceScope),
    networkHash: digest("delivery:anonymous-report-network", networkScope),
  };
}

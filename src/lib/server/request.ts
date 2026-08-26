import "server-only";

import { AppError } from "@/lib/server/api-error";
import { getServerEnv } from "@/lib/server/env";

export function assertJsonRequest(request: Request): void {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new AppError("UNSUPPORTED_MEDIA_TYPE", "Expected a JSON request body.", 415);
  }
}

export function assertMultipartRequest(request: Request): void {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    throw new AppError(
      "UNSUPPORTED_MEDIA_TYPE",
      "Send the recording as multipart form data.",
      415,
    );
  }
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;

  try {
    const env = getServerEnv();
    const expected = env.NEXT_PUBLIC_APP_URL
      ? new URL(env.NEXT_PUBLIC_APP_URL).origin
      : new URL(request.url).origin;
    if (new URL(origin).origin === expected) return;
  } catch {
    // Invalid Origin headers are treated as cross-origin requests.
  }
  throw new AppError("INVALID_ORIGIN", "That request did not come from Delivery.", 403);
}

export function assertContentLength(request: Request, maxBytes: number): void {
  const value = request.headers.get("content-length");
  if (!value) return;
  const length = Number(value);
  if (!Number.isFinite(length) || length < 0 || length > maxBytes) {
    throw new AppError("PAYLOAD_TOO_LARGE", "That request is larger than this stage can handle.", 413);
  }
}

import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import type { ApiFailure, ApiSuccess } from "@/lib/types";
import { EnvironmentError } from "@/lib/server/env";

export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
    readonly details?: unknown,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AppError";
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, options?: ErrorOptions) {
    super(
      `${service.toUpperCase()}_UNAVAILABLE`,
      `${service} is temporarily unavailable. Please try that take again.`,
      503,
      undefined,
      options,
    );
    this.name = "ExternalServiceError";
  }
}

export function requestIdFrom(request?: Request): string {
  return request?.headers.get("x-request-id")?.slice(0, 128) ?? crypto.randomUUID();
}

export function jsonOk<T>(
  data: T,
  requestId: string,
  init?: ResponseInit,
): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true, data, requestId }, init);
}

export function jsonError(
  error: unknown,
  requestId: string,
  headers?: HeadersInit,
): NextResponse<ApiFailure> {
  const responseHeaders = new Headers(headers);
  if (error instanceof AppError) {
    const retryAfter =
      typeof error.details === "object" &&
      error.details !== null &&
      "retryAfterSeconds" in error.details
        ? Number(error.details.retryAfterSeconds)
        : null;
    if (retryAfter !== null && Number.isFinite(retryAfter)) {
      responseHeaders.set("Retry-After", String(Math.max(1, Math.ceil(retryAfter))));
    }
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: "Some of that submission needs another look.",
          details: error.flatten(),
        },
        requestId,
      },
      { status: 422, headers: responseHeaders },
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "MALFORMED_REQUEST",
          message: "That request body could not be read.",
        },
        requestId,
      },
      { status: 400, headers: responseHeaders },
    );
  }

  if (error instanceof EnvironmentError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "SERVER_NOT_CONFIGURED",
          message: "This feature has not been configured yet.",
          details:
            process.env.NODE_ENV === "production" ? undefined : { missing: error.missing },
        },
        requestId,
      },
      { status: 503, headers: responseHeaders },
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
        requestId,
      },
      { status: error.status, headers: responseHeaders },
    );
  }

  // Keep provider errors and secrets out of client responses. The request ID is
  // the join key for structured server-side observability.
  console.error("Unhandled API error", { requestId, error });
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Something broke backstage. Your take is safe—please try again.",
      },
      requestId,
    },
    { status: 500, headers: responseHeaders },
  );
}

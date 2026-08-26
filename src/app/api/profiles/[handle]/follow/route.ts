import { NextResponse } from "next/server";

import { assertAccountNotDeleting } from "@/lib/server/account-deletion";
import { requireUser } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AppError, ExternalServiceError, requestIdFrom } from "@/lib/server/api-error";
import { enforceRateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";
import { assertSameOrigin } from "@/lib/server/request";

async function target(handle: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("profiles").select("id").eq("handle", handle).maybeSingle();
  return { id: data ? String((data as Record<string, unknown>).id) : null, error };
}

function followError(error: unknown, requestId: string) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message, code: error.code, requestId },
      { status: error.status },
    );
  }
  console.error("Unhandled follow API error", { requestId, error });
  return NextResponse.json(
    { error: "Follow could not be saved.", code: "INTERNAL_ERROR", requestId },
    { status: 500 },
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await assertAccountNotDeleting(user.id);
    const rateLimit = await enforceRateLimit(`follow:${user.id}`, {
      limit: 60,
      windowMs: 10 * 60 * 1_000,
    });
    const { handle } = await params;
    const found = await target(handle);
    if (found.error) throw new ExternalServiceError("Supabase follows", { cause: found.error });
    if (!found.id) throw new AppError("PROFILE_NOT_FOUND", "Profile not found.", 404);
    if (found.id === user.id) {
      throw new AppError(
        "CANNOT_FOLLOW_SELF",
        "You already have front-row access to yourself.",
        422,
      );
    }
    const { error } = await createSupabaseAdminClient().from("follows").upsert(
      { follower_id: user.id, following_id: found.id },
      { onConflict: "follower_id,following_id", ignoreDuplicates: true },
    );
    if (error) throw new ExternalServiceError("Supabase follows", { cause: error });
    return NextResponse.json(
      { following: true },
      { headers: rateLimitHeaders(rateLimit) },
    );
  } catch (error) {
    return followError(error, requestId);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await assertAccountNotDeleting(user.id);
    const rateLimit = await enforceRateLimit(`follow:${user.id}`, {
      limit: 60,
      windowMs: 10 * 60 * 1_000,
    });
    const { handle } = await params;
    const found = await target(handle);
    if (found.error) throw new ExternalServiceError("Supabase follows", { cause: found.error });
    if (!found.id) throw new AppError("PROFILE_NOT_FOUND", "Profile not found.", 404);
    const { error } = await createSupabaseAdminClient()
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", found.id);
    if (error) throw new ExternalServiceError("Supabase follows", { cause: error });
    return NextResponse.json(
      { following: false },
      { headers: rateLimitHeaders(rateLimit) },
    );
  } catch (error) {
    return followError(error, requestId);
  }
}

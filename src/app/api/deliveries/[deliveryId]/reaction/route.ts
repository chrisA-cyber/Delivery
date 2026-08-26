import { z } from "zod";
import { NextResponse } from "next/server";

import { assertAccountNotDeleting } from "@/lib/server/account-deletion";
import { AppError, ExternalServiceError, jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { enforceRateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";
import { assertContentLength, assertJsonRequest, assertSameOrigin } from "@/lib/server/request";
import { requireUser } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ deliveryId: z.string().uuid() });
const bodySchema = z.object({ kind: z.enum(["fire", "crying", "skull", "aura", "committed"]) }).strict();

async function visibleDelivery(deliveryId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("deliveries")
    .select("id")
    .eq("id", deliveryId)
    .maybeSingle();
  if (error) throw new ExternalServiceError("Supabase reactions", { cause: error });
  if (!data) throw new AppError("DELIVERY_NOT_FOUND", "That take is unavailable.", 404);
  return supabase;
}

async function reactionCounts(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, deliveryId: string) {
  const { data, error } = await supabase
    .from("reactions")
    .select("kind")
    .eq("delivery_id", deliveryId);
  if (error) throw new ExternalServiceError("Supabase reactions", { cause: error });
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const kind = String(row.kind);
    counts[kind] = (counts[kind] ?? 0) + 1;
  }
  return counts;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ deliveryId: string }> },
) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    assertJsonRequest(request);
    assertContentLength(request, 2 * 1024);
    const user = await requireUser();
    await assertAccountNotDeleting(user.id);
    const rateLimit = await enforceRateLimit(`reaction:${user.id}`, {
      limit: 80,
      windowMs: 10 * 60 * 1_000,
    });
    const { deliveryId } = paramsSchema.parse(await context.params);
    const { kind } = bodySchema.parse(await request.json());
    const supabase = await visibleDelivery(deliveryId);
    const { data: existing, error: existingError } = await supabase
      .from("reactions")
      .select("kind")
      .eq("delivery_id", deliveryId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existingError) {
      throw new ExternalServiceError("Supabase reactions", { cause: existingError });
    }
    const active = !existing;
    const admin = createSupabaseAdminClient();
    const mutation = existing
      ? admin
          .from("reactions")
          .delete()
          .eq("delivery_id", deliveryId)
          .eq("user_id", user.id)
      : admin
          .from("reactions")
          .insert({ delivery_id: deliveryId, user_id: user.id, kind });
    const { error } = await mutation;
    if (error) throw new ExternalServiceError("Supabase reactions", { cause: error });
    const data = {
      deliveryId,
      active,
      kind: active ? kind : null,
      counts: await reactionCounts(supabase, deliveryId),
    };
    return NextResponse.json(
      { ok: true, ...data, data, requestId },
      { headers: rateLimitHeaders(rateLimit) },
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ deliveryId: string }> },
) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    assertJsonRequest(request);
    assertContentLength(request, 2 * 1024);
    const user = await requireUser();
    await assertAccountNotDeleting(user.id);
    const rateLimit = await enforceRateLimit(`reaction:${user.id}`, {
      limit: 80,
      windowMs: 10 * 60 * 1_000,
    });
    const { deliveryId } = paramsSchema.parse(await context.params);
    const { kind } = bodySchema.parse(await request.json());
    const supabase = await visibleDelivery(deliveryId);
    const { error } = await createSupabaseAdminClient().from("reactions").upsert(
      { delivery_id: deliveryId, user_id: user.id, kind },
      { onConflict: "delivery_id,user_id" },
    );
    if (error) throw new ExternalServiceError("Supabase reactions", { cause: error });
    return jsonOk(
      { deliveryId, kind, counts: await reactionCounts(supabase, deliveryId) },
      requestId,
      { headers: rateLimitHeaders(rateLimit) },
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ deliveryId: string }> },
) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await assertAccountNotDeleting(user.id);
    const rateLimit = await enforceRateLimit(`reaction:${user.id}`, {
      limit: 80,
      windowMs: 10 * 60 * 1_000,
    });
    const { deliveryId } = paramsSchema.parse(await context.params);
    const supabase = await visibleDelivery(deliveryId);
    const { error } = await createSupabaseAdminClient()
      .from("reactions")
      .delete()
      .eq("delivery_id", deliveryId)
      .eq("user_id", user.id);
    if (error) throw new ExternalServiceError("Supabase reactions", { cause: error });
    return jsonOk(
      { deliveryId, kind: null, counts: await reactionCounts(supabase, deliveryId) },
      requestId,
      { headers: rateLimitHeaders(rateLimit) },
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}

import { cameraResponse } from "@/lib/server/camera-media";
import { z } from "zod";

import { assertAccountNotDeleting } from "@/lib/server/account-deletion";
import { AppError, ExternalServiceError, jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { enforceRateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";
import { assertSameOrigin } from "@/lib/server/request";
import { requireUser } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const deliveryIdSchema = z.string().uuid();

function isOwnerStoragePath(path: string, ownerId: string): boolean {
  return (
    path.length > ownerId.length + 1 &&
    path.length <= 512 &&
    !path.includes("\\") &&
    !path.includes("\0") &&
    path.startsWith(`${ownerId}/`) &&
    path.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ deliveryId: string }> },
) {
  const requestId = requestIdFrom(request);
  try {
    const user = await requireUser();
    await assertAccountNotDeleting(user.id);
    const rateLimit = await enforceRateLimit(`delivery-audio:${user.id}`, {
      limit: 120,
      windowMs: 60 * 60 * 1_000,
    });
    const deliveryId = deliveryIdSchema.parse((await params).deliveryId);
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("deliveries")
      .select("id,recording_path,mime_type,duration_ms,state,visibility")
      .eq("id", deliveryId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw new ExternalServiceError("Supabase delivery audio", { cause: error });
    if (!data) throw new AppError("DELIVERY_NOT_FOUND", "That take is unavailable.", 404);
    const row = data as Record<string, unknown>;
    const recordingPath = typeof row.recording_path === "string" ? row.recording_path : null;
    if (!recordingPath || !isOwnerStoragePath(recordingPath, user.id)) {
      throw new AppError("DELIVERY_AUDIO_UNAVAILABLE", "That take has no playable audio.", 404);
    }
    const camera = await cameraResponse("delivery", deliveryId, request); if (camera) return camera;
    const { data: signed, error: signError } = await admin.storage
      .from("delivery-audio")
      .createSignedUrl(recordingPath, 5 * 60);
    if (signError || !signed?.signedUrl) {
      throw new ExternalServiceError("Supabase delivery audio", { cause: signError });
    }
    return jsonOk(
      {
        id: deliveryId,
        audioUrl: signed.signedUrl,
        expiresIn: 300,
        mimeType: row.mime_type ?? null,
        durationMs: row.duration_ms ?? null,
        state: row.state,
        visibility: row.visibility,
      },
      requestId,
      {
        headers: {
          ...rateLimitHeaders(rateLimit),
          "Cache-Control": "private, no-store, max-age=0",
          Vary: "Cookie, Authorization",
        },
      },
    );
  } catch (error) {
    return jsonError(error, requestId, {
      "Cache-Control": "private, no-store, max-age=0",
      Vary: "Cookie, Authorization",
    });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ deliveryId: string }> }) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const rateLimit = await enforceRateLimit(`delivery-delete:${user.id}`, { limit: 30, windowMs: 60 * 60 * 1000 });
    const deliveryId = deliveryIdSchema.parse((await params).deliveryId);
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("deliveries").select("id,recording_path,share_asset_path").eq("id", deliveryId).eq("user_id", user.id).maybeSingle();
    if (error) throw new ExternalServiceError("Supabase delivery deletion", { cause: error });
    if (!data) throw new AppError("DELIVERY_NOT_FOUND", "That take is unavailable.", 404);
    const row = data as Record<string, unknown>;
    const cancelled = await admin.rpc("cancel_video_exports", { p_source_kind: "delivery", p_attempt_id: deliveryId });
    if (cancelled.error) throw new ExternalServiceError("Video deletion containment", { cause: cancelled.error });
    if (
      typeof row.recording_path === "string" &&
      isOwnerStoragePath(row.recording_path, user.id)
    ) {
      const { error: storageError } = await admin.storage.from("delivery-audio").remove([row.recording_path]);
      if (storageError) throw new ExternalServiceError("Supabase storage deletion", { cause: storageError });
    }
    if (
      typeof row.share_asset_path === "string" &&
      isOwnerStoragePath(row.share_asset_path, user.id)
    ) {
      const { error: shareError } = await admin.storage.from("delivery-share").remove([row.share_asset_path]);
      if (shareError) throw new ExternalServiceError("Supabase share deletion", { cause: shareError });
    }
    const { error: deleteError } = await admin.from("deliveries").delete().eq("id", deliveryId).eq("user_id", user.id);
    if (deleteError) throw new ExternalServiceError("Supabase delivery deletion", { cause: deleteError });
    return jsonOk({ deleted: true, deliveryId }, requestId, { headers: rateLimitHeaders(rateLimit) });
  } catch (error) { return jsonError(error, requestId); }
}

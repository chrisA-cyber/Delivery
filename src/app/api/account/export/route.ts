import { AppError, jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { enforceRateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";
import { assertSameOrigin } from "@/lib/server/request";
import { requireUser } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const EXPORT_PAGE_SIZE = 500;
const EXPORT_COLLECTION_LIMIT = 100_000;
type ExportRow = Record<string, unknown>;
type ExportPage = { data: ExportRow[] | null; error: unknown };

function isOwnerStoragePath(path: string, ownerId: string): boolean {
  return path.length > ownerId.length + 1 && path.length <= 512 && path.startsWith(`${ownerId}/`) && !path.includes("\\") && !path.includes("\0") && path.split("/").every((segment) => segment && segment !== "." && segment !== "..");
}

async function allRows(load: (from: number, to: number) => PromiseLike<ExportPage>) {
  const rows: ExportRow[] = [];
  while (rows.length < EXPORT_COLLECTION_LIMIT) {
    const page = await load(rows.length, rows.length + EXPORT_PAGE_SIZE - 1);
    if (page.error) throw page.error;
    const next = page.data ?? [];
    rows.push(...next);
    if (next.length < EXPORT_PAGE_SIZE) return rows;
  }
  throw new AppError("EXPORT_TOO_LARGE", "This account needs an asynchronous full archive. Contact the published support channel.", 413);
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const rateLimit = await enforceRateLimit(`account-export:${user.id}`, {
      limit: 3,
      windowMs: 24 * 60 * 60 * 1_000,
    });
    const admin = createSupabaseAdminClient();
    const [
      profile,
      preferences,
      deliveries,
      reactions,
      follows,
      blocks,
      challenges,
      challengeEntries,
      submissions,
      reports,
      badges,
      subscription,
      sayAttempts,
      sayChallenges,
    ] = await Promise.all([
      admin.from("profiles").select("handle,display_name,bio,avatar_path,is_private,is_verified,locale,created_at,updated_at,last_active_at").eq("id", user.id).maybeSingle(),
      admin.from("profile_preferences").select("timezone,autoplay,captions,reduced_motion,email_challenges,email_product_updates,default_delivery_visibility,created_at,updated_at").eq("user_id", user.id).maybeSingle(),
      allRows((from, to) => admin.from("deliveries").select("id,prompt_id,energy_modifier_id,challenge_id,stream_session_id,daily_challenge_date,daily_challenge_market,daily_ranked,state,visibility,recording_path,mime_type,duration_ms,byte_size,transcript,moderation_labels,published_at,scored_at,created_at,updated_at").eq("user_id", user.id).order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to)),
      allRows((from, to) => admin.from("reactions").select("delivery_id,kind,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).order("delivery_id", { ascending: false }).range(from, to)),
      allRows((from, to) => admin.from("follows").select("follower_id,following_id,created_at").or(`follower_id.eq.${user.id},following_id.eq.${user.id}`).order("created_at", { ascending: false }).range(from, to)),
      allRows((from, to) => admin.from("blocks").select("blocked_id,created_at").eq("blocker_id", user.id).order("created_at", { ascending: false }).range(from, to)),
      allRows((from, to) => admin.from("challenges").select("id,code,created_by,recipient_user_id,prompt_id,energy_modifier_id,state,visibility,message,max_entries,expires_at,completed_at,created_at,updated_at").or(`created_by.eq.${user.id},recipient_user_id.eq.${user.id}`).order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to)),
      allRows((from, to) => admin.from("challenge_entries").select("challenge_id,delivery_id,entrant_id,created_at").eq("entrant_id", user.id).order("created_at", { ascending: false }).range(from, to)),
      allRows((from, to) => admin.from("line_submissions").select("id,proposed_body,proposed_category,proposed_tags,suggested_energy,state,reviewer_note,promoted_prompt_id,created_at,reviewed_at").eq("submitted_by", user.id).order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to)),
      allRows((from, to) => admin.from("reports").select("id,delivery_id,profile_id,prompt_id,submission_id,reason,details,state,created_at,resolved_at").eq("reporter_id", user.id).order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to)),
      allRows((from, to) => admin.from("user_badges").select("badge_id,delivery_id,awarded_at,metadata").eq("user_id", user.id).order("awarded_at", { ascending: false }).order("badge_id", { ascending: true }).range(from, to)),
      admin.from("subscriptions").select("tier,state,provider,current_period_start,current_period_end,cancel_at_period_end,canceled_at,created_at,updated_at").eq("user_id", user.id).maybeSingle(),
      allRows((from, to) => admin.from("say_attempts").select("id,clip_snapshot,role_id,scoring_version,recording_path,audio_mime,audio_hash,duration_ms,recording_offset_ms,status,score,created_at,challenge_id,shared_with_challenge").eq("user_id", user.id).order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to)),
      allRows((from, to) => admin.from("say_challenges").select("id,attempt_id,clip_version_id,role_id,scoring_version,revoked_at,expires_at,created_at").eq("created_by", user.id).order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to)),
    ]);

    const results = [profile, preferences, subscription];
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;

    const deliveryRows = deliveries;
    const deliveryIds = deliveryRows.map((delivery) => String(delivery.id));
    const scoreRows: unknown[] = [];
    for (let index = 0; index < deliveryIds.length; index += 200) {
      const scores = await admin.from("delivery_scores").select("delivery_id,overall,commitment,comedy,accuracy,chaos,confidence,headline,verdict,rubric_version,provider,model,evidence,safety,created_at").in("delivery_id", deliveryIds.slice(index, index + 200));
      if (scores.error) throw scores.error;
      scoreRows.push(...(scores.data ?? []));
    }

    const paths = [...deliveryRows, ...sayAttempts].flatMap((delivery) => typeof delivery.recording_path === "string" && isOwnerStoragePath(delivery.recording_path, user.id) ? [delivery.recording_path] : []);
    const signedRows: Array<{ signedUrl?: string | null }> = [];
    for (let index = 0; index < paths.length; index += 100) {
      const batch = paths.slice(index, index + 100);
      const signed = await admin.storage.from("delivery-audio").createSignedUrls(batch, 10 * 60);
      if (signed.error) throw signed.error;
      signedRows.push(...(signed.data ?? []));
    }
    const audioUrls = new Map(paths.map((path, index) => [path, signedRows[index]?.signedUrl ?? null]));
    const safeDeliveries = deliveryRows.map(({ recording_path: recordingPath, ...delivery }) => ({
      ...delivery,
      recordingDownloadUrl: typeof recordingPath === "string" ? audioUrls.get(recordingPath) ?? null : null,
    }));

    return jsonOk({
      generatedAt: new Date().toISOString(),
      recordingLinksExpireAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      exportLimits: { maximumRowsPerCollection: EXPORT_COLLECTION_LIMIT, truncatedCollections: [] },
      account: { id: user.id, email: user.email ?? null, createdAt: user.created_at },
      profile: profile.data,
      preferences: preferences.data,
      deliveries: safeDeliveries,
      scores: scoreRows,
      sayItBack: {
        attempts: sayAttempts.map(({ recording_path: recordingPath, ...attempt }) => ({
          ...attempt,
          recordingDownloadUrl: typeof recordingPath === "string" ? audioUrls.get(recordingPath) ?? null : null,
        })),
        challenges: sayChallenges,
      },
      reactions,
      follows,
      blocks,
      challenges,
      challengeEntries,
      lineSubmissions: submissions,
      reports,
      badges,
      subscription: subscription.data,
    }, requestId, {
      headers: {
        ...rateLimitHeaders(rateLimit),
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `attachment; filename="delivery-data-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    return jsonError(error, requestId, { "Cache-Control": "private, no-store, max-age=0" });
  }
}

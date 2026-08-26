import { z } from "zod";

import { AppError, ExternalServiceError, jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import { enforceRateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";
import {
  attemptImmediateModerationCleanup,
  processModerationStorageCleanup,
} from "@/lib/server/moderation-cleanup";
import { assertContentLength, assertJsonRequest, assertSameOrigin } from "@/lib/server/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/supabase/auth";
import type { ModerationQueueItem, ReportReason, ReportState } from "@/types/moderation";

export const dynamic = "force-dynamic";

const stateSchema = z.enum(["open", "triaged", "actioned", "dismissed"]);
const actionSchema = z.object({
  reportId: z.string().uuid(),
  decision: z.enum(["allow", "limit", "remove"]),
  reason: z.string().trim().min(3).max(500),
  internalNote: z.string().trim().max(2_000).optional(),
}).strict();

const rowsById = (rows: Array<Record<string, unknown>>) => new Map(rows.map((row) => [String(row.id), row]));
const stringOrNull = (value: unknown) => typeof value === "string" && value ? value : null;
const reportFields = "id,reporter_id,delivery_id,profile_id,prompt_id,submission_id,reason,details,state,assigned_to,created_at,updated_at";
const urgentReasons: ReportReason[] = ["violence", "self_harm", "privacy", "hate"];

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const { user } = await requireStaff();
    const rateLimit = await enforceRateLimit(`moderation:list:${user.id}`, { limit: 120, windowMs: 5 * 60 * 1_000 });
    const url = new URL(request.url);
    const state = stateSchema.catch("open").parse(url.searchParams.get("state") ?? "open");
    const admin = createSupabaseAdminClient();
    let reports: Array<Record<string, unknown>> = [];
    if (state === "open" || state === "triaged") {
      const urgentResult = await admin.from("reports").select(reportFields).eq("state", state).in("reason", urgentReasons).order("created_at", { ascending: true }).limit(100);
      if (urgentResult.error) throw new ExternalServiceError("Supabase moderation", { cause: urgentResult.error });
      reports = (urgentResult.data ?? []) as Array<Record<string, unknown>>;
      if (reports.length < 100) {
        const routineResult = await admin.from("reports").select(reportFields).eq("state", state).not("reason", "in", `(${urgentReasons.join(",")})`).order("created_at", { ascending: true }).limit(100 - reports.length);
        if (routineResult.error) throw new ExternalServiceError("Supabase moderation", { cause: routineResult.error });
        reports.push(...((routineResult.data ?? []) as Array<Record<string, unknown>>));
      }
    } else {
      const historyResult = await admin.from("reports").select(reportFields).eq("state", state).order("updated_at", { ascending: false }).limit(100);
      if (historyResult.error) throw new ExternalServiceError("Supabase moderation", { cause: historyResult.error });
      reports = (historyResult.data ?? []) as Array<Record<string, unknown>>;
    }
    const deliveryIds = reports.flatMap((row) => stringOrNull(row.delivery_id) ?? []);
    const profileTargetIds = reports.flatMap((row) => stringOrNull(row.profile_id) ?? []);
    const reportedPromptIds = reports.flatMap((row) => stringOrNull(row.prompt_id) ?? []);
    const submissionIds = reports.flatMap((row) => stringOrNull(row.submission_id) ?? []);

    const [deliveryResult, targetProfileResult, submissionResult] = await Promise.all([
      deliveryIds.length ? admin.from("deliveries").select("id,user_id,prompt_id,state,visibility,transcript,moderation_labels,created_at").in("id", deliveryIds) : Promise.resolve({ data: [], error: null }),
      profileTargetIds.length ? admin.from("profiles").select("id,handle,display_name,bio").in("id", profileTargetIds) : Promise.resolve({ data: [], error: null }),
      submissionIds.length ? admin.from("line_submissions").select("id,submitted_by,proposed_body,state,automated_labels").in("id", submissionIds) : Promise.resolve({ data: [], error: null }),
    ]);
    const targetError = deliveryResult.error ?? targetProfileResult.error ?? submissionResult.error;
    if (targetError) throw new ExternalServiceError("Supabase moderation", { cause: targetError });
    const deliveries = rowsById((deliveryResult.data ?? []) as Array<Record<string, unknown>>);
    const targetProfiles = rowsById((targetProfileResult.data ?? []) as Array<Record<string, unknown>>);
    const submissions = rowsById((submissionResult.data ?? []) as Array<Record<string, unknown>>);
    const promptIds = [...new Set(reportedPromptIds.concat([...deliveries.values()].flatMap((row) => stringOrNull(row.prompt_id) ?? [])))];
    const promptResult = promptIds.length ? await admin.from("prompts").select("id,slug,body,state").in("id", promptIds) : { data: [], error: null };
    if (promptResult.error) throw new ExternalServiceError("Supabase moderation", { cause: promptResult.error });
    const prompts = rowsById((promptResult.data ?? []) as Array<Record<string, unknown>>);
    const identityIds = [...new Set(reports.flatMap((row) => [stringOrNull(row.reporter_id), stringOrNull(row.assigned_to)]).concat(
      [...deliveries.values()].map((row) => stringOrNull(row.user_id)),
      [...submissions.values()].map((row) => stringOrNull(row.submitted_by)),
    ).filter((id): id is string => Boolean(id)))];
    const { data: identityData, error: identityError } = identityIds.length
      ? await admin.from("profiles").select("id,handle,display_name").in("id", identityIds)
      : { data: [], error: null };
    if (identityError) throw new ExternalServiceError("Supabase moderation", { cause: identityError });
    const identities = rowsById((identityData ?? []) as Array<Record<string, unknown>>);
    const profileSummary = (id: string | null) => {
      const row = id ? identities.get(id) ?? targetProfiles.get(id) : null;
      return row ? { handle: String(row.handle), displayName: String(row.display_name) } : null;
    };

    const items = reports.flatMap((row): ModerationQueueItem[] => {
      const base = {
        id: String(row.id),
        reason: String(row.reason) as ReportReason,
        details: stringOrNull(row.details),
        state: String(row.state) as ReportState,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
        reporter: profileSummary(stringOrNull(row.reporter_id)),
      };
      const deliveryId = stringOrNull(row.delivery_id);
      if (deliveryId) {
        const delivery = deliveries.get(deliveryId);
        if (!delivery) return [];
        const prompt = prompts.get(String(delivery.prompt_id));
        const owner = profileSummary(stringOrNull(delivery.user_id));
        return [{ ...base, target: { kind: "delivery", id: deliveryId, title: String(prompt?.body ?? "Delivery recording"), owner, context: stringOrNull(delivery.transcript), href: `/d/${deliveryId}`, state: `${String(delivery.state)} · ${String(delivery.visibility)}`, moderationLabels: Array.isArray(delivery.moderation_labels) ? delivery.moderation_labels.map(String) : [] } }];
      }
      const profileId = stringOrNull(row.profile_id);
      if (profileId) {
        const profile = targetProfiles.get(profileId);
        if (!profile) return [];
        return [{ ...base, target: { kind: "profile", id: profileId, title: `@${String(profile.handle)}`, owner: profileSummary(profileId), context: stringOrNull(profile.bio), href: `/u/${String(profile.handle)}` } }];
      }
      const promptId = stringOrNull(row.prompt_id);
      if (promptId) {
        const prompt = prompts.get(promptId);
        if (!prompt) return [];
        return [{ ...base, target: { kind: "prompt", id: promptId, title: String(prompt.body), context: String(prompt.slug), state: String(prompt.state) } }];
      }
      const submissionId = stringOrNull(row.submission_id);
      const submission = submissionId ? submissions.get(submissionId) : null;
      if (!submissionId || !submission) return [];
      return [{ ...base, target: { kind: "submission", id: submissionId, title: String(submission.proposed_body), owner: profileSummary(stringOrNull(submission.submitted_by)), state: String(submission.state), moderationLabels: Array.isArray(submission.automated_labels) ? submission.automated_labels.map(String) : [] } }];
    });
    return jsonOk({ items, state, capped: reports.length === 100 }, requestId, { headers: { ...rateLimitHeaders(rateLimit), "Cache-Control": "private, no-store" } });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    assertJsonRequest(request);
    assertContentLength(request, 8 * 1024);
    const { user } = await requireStaff();
    const rateLimit = await enforceRateLimit(`moderation:action:${user.id}`, { limit: 60, windowMs: 10 * 60 * 1_000 });
    const body = actionSchema.parse(await request.json());
    const { data, error } = await createSupabaseAdminClient().rpc("resolve_moderation_report", {
      p_report_id: body.reportId,
      p_actor_id: user.id,
      p_decision: body.decision,
      p_reason: body.reason,
      p_internal_note: body.internalNote ?? null,
    });
    if (error) {
      if (error.code === "23503") throw new AppError("REPORT_NOT_FOUND", "That report is no longer in the queue.", 404);
      if (error.code === "55000") throw new AppError("REPORT_ALREADY_RESOLVED", "Another reviewer already handled this report.", 409);
      if (error.code === "22023") throw new AppError("MODERATION_DECISION_INVALID", "That moderation action is not valid for this report.", 422);
      if (error.code === "42501") throw new AppError("MODERATION_FORBIDDEN", "Your moderation access changed. Refresh before continuing.", 403);
      throw new ExternalServiceError("Supabase moderation", { cause: error });
    }
    const cleanup: {
      immediate: { attempted: number; failed: number };
      drain: Awaited<ReturnType<typeof processModerationStorageCleanup>> | null;
      pending: boolean;
    } = {
      immediate: { attempted: 0, failed: 0 },
      drain: null,
      pending: false,
    };
    try {
      cleanup.immediate = await attemptImmediateModerationCleanup(data);
      cleanup.drain = await processModerationStorageCleanup(100);
      cleanup.pending = cleanup.immediate.failed > 0 || cleanup.drain.retrying > 0 || cleanup.drain.dead > 0;
    } catch (cleanupError) {
      // The moderation action and its outbox rows committed atomically. A worker
      // retry owns provider cleanup; do not roll back or misreport containment.
      cleanup.pending = true;
      console.error("Moderation media cleanup deferred", {
        requestId,
        actionId: data && typeof data === "object" && !Array.isArray(data)
          ? (data as Record<string, unknown>).actionId
          : undefined,
        cleanupErrorName: cleanupError instanceof Error ? cleanupError.name : "unknown",
      });
    }
    const response = data && typeof data === "object" && !Array.isArray(data)
      ? { ...(data as Record<string, unknown>), cleanup }
      : { result: data, cleanup };
    return jsonOk(response, requestId, { headers: rateLimitHeaders(rateLimit) });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

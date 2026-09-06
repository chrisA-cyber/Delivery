import { NextResponse } from "next/server";
import { z } from "zod";

import { assertAccountNotDeleting } from "@/lib/server/account-deletion";
import { AppError, jsonError, requestIdFrom } from "@/lib/server/api-error";
import { validateAudio } from "@/lib/server/audio";
import { assertChallengeReceiptAccess, resolveCanonicalDeliveryContent } from "@/lib/server/content";
import {
  getViewerDailyLeaderboardPosition,
  persistDelivery,
  setDeliveryVisibility,
} from "@/lib/server/deliveries";
import {
  preflightJudgingUsage,
  releaseJudgedPlay,
  reserveJudgedPlay,
} from "@/lib/server/entitlements";
import { authorizeClassicRoundJudge, attachClassicRoundJudge, getRoundViewer } from "@/lib/server/group-rounds";
import { getGuestIdentity } from "@/lib/server/guest";
import {
  createRequestFingerprint,
  runIdempotent,
} from "@/lib/server/idempotency";
import { resolvePublicClassicAssignment } from "@/lib/server/public-assignments";
import { moderateLine } from "@/lib/server/moderation";
import { judgeDelivery } from "@/lib/server/openai";
import {
  enforceRateLimit,
  getClientKey,
  rateLimitHeaders,
  type RateLimitResult,
} from "@/lib/server/rate-limit";
import {
  assertContentLength,
  assertMultipartRequest,
  assertSameOrigin,
} from "@/lib/server/request";
import { getOptionalUser } from "@/lib/supabase/auth";
import { DELIVERY_MODES } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9:_.-]+$/);

const formSchema = z.object({
  promptText: z.string().trim().min(2).max(500),
  energy: z.string().trim().min(2).max(180),
  maxRating: z.enum(["everyone", "teen", "mature"]).default("everyone"),
  category: z.string().trim().min(2).max(80).optional(),
  mode: z.enum(DELIVERY_MODES).default("classic"),
  promptId: z.string().trim().min(1).max(120),
  challengeId: z.string().uuid().optional(),
  challengeToken: z
    .string()
    .trim()
    .min(20)
    .max(120)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  dailyDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dailyMarket: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9-]+$/i)
    .optional(),
  assignmentCode: z.string().regex(/^[a-f0-9]{12}$/).optional(),
  roundToken: z.string().regex(/^[A-Za-z0-9_-]{40,80}$/).optional(),
  roundTakeId: z.string().uuid().optional(),
  durationMs: z.coerce.number().int().min(250).max(20_000),
  attemptId: idempotencyKeySchema.optional(),
  isPublic: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

function optionalFormString(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  return typeof value === "string" && value.trim() ? value : undefined;
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  let rateLimit: RateLimitResult | undefined;
  let responseCookie: string | undefined;
  try {
    assertSameOrigin(request);
    assertMultipartRequest(request);
    assertContentLength(request, MAX_AUDIO_BYTES + 64 * 1024);
    rateLimit = await enforceRateLimit(getClientKey(request, "judge"), {
      limit: 15,
      windowMs: 10 * 60 * 1_000,
    });

    const form = await request.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File)) {
      throw new AppError(
        "AUDIO_REQUIRED",
        "Record a take before asking for a score.",
        422,
      );
    }
    if (audio.size < 512) {
      throw new AppError(
        "AUDIO_EMPTY",
        "That recording was too short to judge.",
        422,
      );
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      throw new AppError(
        "AUDIO_TOO_LARGE",
        "Keep recordings under 15 MB.",
        413,
      );
    }
    const fields = formSchema.parse({
      promptText: form.get("line") ?? form.get("promptText"),
      energy: form.get("energy"),
      maxRating: optionalFormString(form, "maxRating"),
      category: optionalFormString(form, "category"),
      mode: optionalFormString(form, "mode") ?? "classic",
      promptId:
        optionalFormString(form, "promptId") ??
        optionalFormString(form, "lineId"),
      challengeId: optionalFormString(form, "challengeId"),
      challengeToken: optionalFormString(form, "challengeToken"),
      dailyDate: optionalFormString(form, "dailyDate"),
      dailyMarket: optionalFormString(form, "dailyMarket"),
      assignmentCode: optionalFormString(form, "assignmentCode"),
      roundToken: optionalFormString(form, "roundToken"),
      roundTakeId: optionalFormString(form, "roundTakeId"),
      durationMs: optionalFormString(form, "durationMs"),
      attemptId: optionalFormString(form, "attemptId"),
      isPublic: optionalFormString(form, "isPublic") ?? "false",
    });
    if (Boolean(fields.roundToken) !== Boolean(fields.roundTakeId) || (fields.roundToken && (fields.mode !== "classic" || fields.challengeId || fields.isPublic))) {
      throw new AppError("ROUND_JUDGE_INVALID", "Use the private Classic recorder for this round.", 422);
    }
    if (fields.assignmentCode && (fields.roundToken || fields.challengeId || fields.challengeToken || fields.mode !== "classic")) throw new AppError("ASSIGNMENT_MISMATCH", "Use the exact public Classic assignment for this take.", 422);
    const validatedAudio = await validateAudio(audio, fields.durationMs);
    if (validatedAudio.durationMs > 20_000)
      throw new AppError(
        "INVALID_AUDIO",
        "Takes must be 20 seconds or less.",
        400,
      );
    const user = await getOptionalUser();
    if (user) await assertAccountNotDeleting(user.id);
    const headerIdempotencyKey =
      request.headers.get("idempotency-key")?.trim() || undefined;
    if (
      headerIdempotencyKey &&
      fields.attemptId &&
      headerIdempotencyKey !== fields.attemptId
    ) {
      throw new AppError(
        "IDEMPOTENCY_KEY_MISMATCH",
        "The retry key does not match this recording attempt.",
        422,
      );
    }
    const suppliedKey = headerIdempotencyKey ?? fields.attemptId;
    if (
      !user &&
      suppliedKey &&
      (suppliedKey.length < 20 || new Set(suppliedKey.toLowerCase()).size < 6)
    ) {
      throw new AppError(
        "IDEMPOTENCY_KEY_WEAK",
        "Refresh the stage to create a secure recording attempt.",
        422,
      );
    }
    const idempotencyKey = suppliedKey
      ? idempotencyKeySchema.parse(suppliedKey)
      : crypto.randomUUID();
    const guestIdentity = user
      ? null
      : getGuestIdentity(request, idempotencyKey);
    responseCookie = guestIdentity?.setCookie;
    const roundViewer = fields.roundToken ? await getRoundViewer(request, idempotencyKey) : null;
    if (roundViewer?.setCookie) responseCookie = roundViewer.setCookie;
    const guestScope = guestIdentity?.scope ?? `signed:${user!.id}`;
    // Quota keeps signed-device and IP dimensions. The provisional signed
    // device is deterministic for a first attempt, then remains cookie-bound.
    const scope = user?.id ?? `guest-device:${guestIdentity!.idempotencyScope}`;
    const { value, replayed } = await runIdempotent(
      "judge",
      scope,
      idempotencyKey,
      createRequestFingerprint(
        validatedAudio.contentHash,
        // Match the entire validated request, not mutable catalog/admission
        // state. Canonical validation still runs for every new operation below.
        fields.promptId,
        fields.promptText,
        fields.energy,
        fields.category ?? "",
        fields.mode,
        fields.challengeId ?? "",
        fields.challengeToken ?? "",
        fields.dailyDate ?? "",
        fields.dailyMarket ?? "",
        String(fields.durationMs),
        String(validatedAudio.durationMs),
        audio.type,
        String(fields.isPublic),
        fields.maxRating,
        fields.roundToken ?? "",
        fields.roundTakeId ?? "",
        fields.assignmentCode ?? "",
      ),
      15 * 60 * 1_000,
      async () => {
        // Admission can change because this very operation succeeded (challenge
        // entries) or time passed (Daily midnight). Completed exact retries must
        // replay before those gates, while new attempts still pass all of them.
        const usageBefore = await preflightJudgingUsage(user);
        const canonical = fields.roundToken && fields.roundTakeId && roundViewer
          ? await authorizeClassicRoundJudge({ token: fields.roundToken, takeId: fields.roundTakeId, audioHash: validatedAudio.contentHash, maxRating: fields.maxRating }, roundViewer)
          : fields.assignmentCode ? await resolvePublicClassicAssignment(fields.assignmentCode, fields.maxRating, user, usageBefore)
          : await resolveCanonicalDeliveryContent({
          promptId: fields.promptId,
          promptText: fields.promptText,
          energy: fields.energy,
          category: fields.category,
          maxRating: fields.maxRating,
          mode: fields.mode,
          challengeId: fields.challengeId,
          challengeToken: fields.challengeToken,
          dailyDate: fields.dailyDate,
          dailyMarket: fields.dailyMarket,
          user,
          usage: usageBefore,
        });
        if (fields.assignmentCode && (canonical.promptId !== fields.promptId || canonical.promptText !== fields.promptText || canonical.energy !== fields.energy)) throw new AppError("ASSIGNMENT_MISMATCH", "Record the exact line and direction from this assignment.", 409);
        const reservation = await reserveJudgedPlay(
          user,
          idempotencyKey,
          guestScope,
        );
        if (reservation.replayed) {
          throw new AppError(
            "IDEMPOTENCY_REPLAY_UNAVAILABLE",
            "That take is already being judged or was completed on another stage. Use the original result or record a new take.",
            409,
          );
        }

        // The preflight check keeps premium rounds fast, while the durable
        // reservation is the final entitlement snapshot. Re-check it here so
        // a subscription expiring between those two operations cannot unlock
        // a Pro-only line or mode for the provider call.
        if (canonical.requiresPro && reservation.usage.tier !== "pro") {
          try {
            await releaseJudgedPlay(reservation, user, guestScope);
          } catch (releaseError) {
            console.error("Premium entitlement reservation release failed", {
              requestId,
              releaseError,
            });
          }
          throw new AppError(
            "PRO_REQUIRED",
            "That round is on the Pro stage. Upgrade to judge this take, or pick a free round.",
            402,
            {
              upgradeCode: "DELIVERY_PRO",
              tier: reservation.usage.tier,
              usage: reservation.usage,
            },
          );
        }

        let judgment;
        try {
          judgment = await judgeDelivery({
            audio,
            promptText: canonical.promptText,
            energy: canonical.energy,
            mode: fields.mode,
            durationMs: validatedAudio.durationMs,
            safetyIdentifier: scope,
            requestId,
          });
        } catch (error) {
          try {
            await releaseJudgedPlay(reservation, user, guestScope);
          } catch (releaseError) {
            console.error("Judged-play reservation release failed", {
              requestId,
              releaseError,
            });
          }
          throw error;
        }
        const usage = reservation.usage;
        const quotaWarning = !usage.tracked
          ? "Daily play protection is running in local fallback mode."
          : undefined;

        let approvedForPublish = false;
        let moderationLabels: string[] = [];
        let publishingWarning: string | undefined;
        if (fields.isPublic && judgment.source === "mock") {
          publishingWarning = "Demo results cannot be published or entered into competitions.";
        } else if (fields.isPublic && canonical.rating === "mature") {
          publishingWarning =
            "Mature takes stay private while Delivery’s public age and audience policy is finalized.";
        } else if (fields.isPublic && user) {
          try {
            const moderation = await moderateLine(
              [
                canonical.promptText,
                canonical.energy,
                judgment.transcript,
                judgment.transcription?.text ?? "",
                judgment.verdict,
                ...judgment.highlights,
                judgment.coachNote,
              ].join("\n"),
            );
            moderationLabels = moderation.categories;
            if (moderation.decision === "approved") {
              approvedForPublish = true;
              moderationLabels = [
                ...new Set([...moderationLabels, "publish-approved"]),
              ];
            } else {
              moderationLabels = [
                ...new Set([
                  ...moderationLabels,
                  `publish-${moderation.decision}`,
                ]),
              ];
              publishingWarning =
                "This take was saved privately while it waits for a safety review.";
            }
          } catch (error) {
            moderationLabels = ["publish-moderation-unavailable"];
            publishingWarning =
              "Publishing checks were unavailable, so this take was saved privately.";
            console.error("Publish moderation failed closed", {
              requestId,
              error,
            });
          }
        } else if (fields.isPublic) {
          publishingWarning =
            "Sign in to publish this take. Your score is still ready.";
        }

        let delivery;
        let dailyPositionWarning: string | undefined;
        try {
          if (fields.roundToken && fields.roundTakeId && roundViewer) {
            delivery = { id: fields.roundTakeId, persisted: true };
          } else delivery = await persistDelivery({
            contentRating: canonical.rating,
            user,
            audio,
            promptId: canonical.promptId,
            energyId: canonical.energyId,
            challengeId: fields.challengeId,
            dailyDate: canonical.dailyDate,
            dailyMarket: canonical.dailyMarket,
            promptText: canonical.promptText,
            energy: canonical.energy,
            mode: fields.mode,
            durationMs: validatedAudio.durationMs,
            judgment,
            moderationLabels,
          });
          if (delivery.persisted && delivery.id && approvedForPublish && user) {
            try {
              const published = await setDeliveryVisibility(
                delivery.id,
                user.id,
                "public",
              );
              delivery = { ...delivery, ...published };
            } catch (error) {
              publishingWarning =
                "Your take was scored and saved privately, but publishing is temporarily unavailable.";
              console.error("Delivery publish transition failed closed", {
                requestId,
                error,
              });
            }
          }
          if (
            canonical.dailyDate &&
            delivery.persisted &&
            delivery.dailyRanked === true &&
            user
          ) {
            try {
              const position = await getViewerDailyLeaderboardPosition(user.id);
              if (position) delivery = { ...delivery, ...position };
            } catch (error) {
              dailyPositionWarning =
                "Your Daily score is locked, but its live board position is still refreshing.";
              console.error("Daily leaderboard position lookup failed", {
                requestId,
                errorName: error instanceof Error ? error.name : "unknown",
              });
            }
          }
        } catch (error) {
          console.error("Delivery persistence failed", { requestId, error });
          delivery = {
            id: null,
            persisted: false,
            warning:
              "Your score is ready, but this take could not be saved. Download it before retrying.",
          };
        }

        const result = {
          id: delivery.id ?? crypto.randomUUID(),
          scores: judgment.scores,
          verdict: judgment.verdict,
          title: judgment.verdictTag.replaceAll("_", " "),
          moment: judgment.highlights[0] ?? judgment.coachNote,
          transcript: judgment.transcript,
          coachNote: judgment.coachNote,
          highlights: judgment.highlights,
          rubricVersion: judgment.rubricVersion,
          scoringVersion: judgment.scoringVersion,
          transcription: judgment.transcription,
          badge: judgment.verdictTag,
          xp: 35,
          source:
            judgment.source === "openai"
              ? ("ai" as const)
              : ("fallback" as const),
        };

        const dailyWarning =
          canonical.dailyDate &&
          delivery.persisted &&
          delivery.dailyRanked === false
            ? "This replay is saved as unranked Daily practice; your first result stays on the board."
            : undefined;

        return {
          result,
          delivery,
          usage,
          roundJudgment: fields.roundToken ? judgment : undefined,
          warning:
            [
              judgment.warning,
              quotaWarning,
              publishingWarning,
              dailyWarning,
              dailyPositionWarning,
              delivery.warning,
            ]
              .filter((value): value is string => Boolean(value))
              .join(" ") || undefined,
        };
      },
    );

    if (replayed && fields.challengeId) {
      // Expiry/completion does not revoke access to one's own receipt. Current
      // participant/invite scope, blocks, and account restrictions still do.
      await assertChallengeReceiptAccess({ user, challengeId: fields.challengeId, challengeToken: fields.challengeToken });
    }

    const { roundJudgment, ...publicValue } = value;
    if (fields.roundToken && fields.roundTakeId && roundViewer && roundJudgment) {
      try {
        await attachClassicRoundJudge({ token: fields.roundToken, takeId: fields.roundTakeId, score: roundJudgment }, roundViewer);
      } catch (error) {
        console.error("Round score attachment failed", { requestId, errorName: error instanceof Error ? error.name : "unknown" });
        publicValue.warning = [publicValue.warning, "Your audio is saved, but the round score could not finish saving. Retry this judgment to reuse its receipt."].filter(Boolean).join(" ");
      }
    }
    return NextResponse.json(
      {
        ...publicValue,
        requestId,
      },
      {
        status: value.delivery.persisted ? 201 : 200,
        headers: {
          ...rateLimitHeaders(rateLimit),
          "Idempotency-Replayed": replayed ? "true" : "false",
          ...(responseCookie ? { "Set-Cookie": responseCookie } : {}),
        },
      },
    );
  } catch (error) {
    const headers = new Headers(
      rateLimit ? rateLimitHeaders(rateLimit) : undefined,
    );
    if (responseCookie) headers.set("Set-Cookie", responseCookie);
    return jsonError(error, requestId, headers);
  }
}

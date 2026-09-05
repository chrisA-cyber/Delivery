import { z } from "zod";

import { getDailyPrompt } from "@/data/content";
import { AppError, ExternalServiceError, jsonError, jsonOk, requestIdFrom } from "@/lib/server/api-error";
import {
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "@/lib/server/env";
import { enforceRateLimit, getClientKey, rateLimitHeaders } from "@/lib/server/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
const marketSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,32}$/).default("global");

interface DailyRow {
  challenge_date: string;
  market: string;
  prompts:
    | {
        slug: string;
        body: string;
        category: string;
        difficulty: number;
        rating: "everyone" | "teen" | "mature";
        tags: string[];
        scoring_focus: string[];
        locale: string;
        is_mimic: boolean;
      }
    | {
        slug: string;
        body: string;
        category: string;
        difficulty: number;
        rating: "everyone" | "teen" | "mature";
        tags: string[];
        scoring_focus: string[];
        locale: string;
        is_mimic: boolean;
      }[];
  energy_modifiers:
    | {
        slug: string;
        instruction: string;
        short_label: string;
        intensity: number;
        tags: string[];
        compatible_difficulties: number[] | null;
      }
    | {
        slug: string;
        instruction: string;
        short_label: string;
        intensity: number;
        tags: string[];
        compatible_difficulties: number[] | null;
      }[];
}

const difficultyName = ["easy", "easy", "medium", "hard", "impossible"] as const;

async function databaseDaily(dateKey: string, market: string, mayEnsure: boolean) {
  if (mayEnsure && isSupabaseAdminConfigured()) {
    const { error } = await createSupabaseAdminClient().rpc("ensure_daily_challenge", {
      p_date: dateKey,
      p_market: market,
    });
    if (error) throw new ExternalServiceError("Supabase daily challenge", { cause: error });
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("daily_challenges")
    .select(
      "challenge_date,market,prompts!inner(slug,body,category,difficulty,rating,tags,scoring_focus,locale,is_mimic),energy_modifiers!inner(slug,instruction,short_label,intensity,tags,compatible_difficulties)",
    )
    .eq("challenge_date", dateKey)
    .eq("market", market)
    .maybeSingle();
  if (error) throw new ExternalServiceError("Supabase daily challenge", { cause: error });
  const row = data as unknown as DailyRow | null;
  if (!row) {
    throw new AppError(
      "DAILY_NOT_READY",
      "Today’s Daily Drop is still getting dressed. Try again in a moment.",
      503,
    );
  }
  const prompt = Array.isArray(row.prompts) ? row.prompts[0] : row.prompts;
  const energy = Array.isArray(row.energy_modifiers)
    ? row.energy_modifiers[0]
    : row.energy_modifiers;
  if (!prompt || !energy) throw new ExternalServiceError("Supabase daily challenge");

  return {
    dateKey: row.challenge_date,
    market: row.market,
    prompt: {
      id: prompt.slug,
      line: prompt.body,
      category: prompt.category,
      packIds: [] as string[],
      tags: prompt.tags,
      difficulty: difficultyName[prompt.difficulty] ?? "medium",
      rating: prompt.rating,
      scoringFocus: prompt.scoring_focus,
      locale: prompt.locale,
      isMimic: prompt.is_mimic,
    },
    energy: {
      id: energy.slug,
      instruction: energy.instruction,
      shortLabel: energy.short_label,
      intensity: energy.intensity,
      tags: energy.tags,
      compatibleDifficulties: energy.compatible_difficulties?.map(
        (difficulty) => difficultyName[difficulty] ?? "medium",
      ),
    },
    shareSlug: `${row.challenge_date}-${market}-${prompt.slug}-${energy.slug}`,
  };
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const rateLimit = await enforceRateLimit(getClientKey(request, "daily"), {
      limit: 120,
      windowMs: 60 * 1_000,
    });
    const url = new URL(request.url);
    const dateParam = dateSchema.parse(url.searchParams.get("date") ?? undefined);
    const market = marketSchema.parse(url.searchParams.get("market") ?? undefined);
    const date = dateParam ? new Date(`${dateParam}T12:00:00.000Z`) : new Date();
    if (
      Number.isNaN(date.getTime()) ||
      (dateParam !== undefined && date.toISOString().slice(0, 10) !== dateParam)
    ) {
      throw new AppError("INVALID_DATE", "Use a real date in YYYY-MM-DD format.", 422);
    }
    const dateKey = date.toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    if (dateKey > today) {
      throw new AppError(
        "DAILY_NOT_AVAILABLE",
        "Future Daily Drops stay backstage until their day arrives.",
        404,
      );
    }
    const daily = isSupabaseConfigured()
      ? await databaseDaily(dateKey, market, dateKey === today && market === "global")
      : { ...getDailyPrompt(date), market: "global" };
    return jsonOk(daily, requestId, {
      headers: {
        ...rateLimitHeaders(rateLimit),
        "Cache-Control": "public, max-age=60, s-maxage=900, stale-while-revalidate=1800",
      },
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}

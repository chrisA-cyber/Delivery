import "server-only";

import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().url().optional(),
);

const booleanString = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => value === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  OPENAI_API_KEY: optionalString,
  OPENAI_AUDIO_JUDGE_MODEL: optionalString.default("gpt-audio-1.5"),
  OPENAI_MODERATION_MODEL: optionalString.default("omni-moderation-latest"),
  DELIVERY_AI_MODE: z.enum(["live", "mock"]).default("live"),
  DELIVERY_AI_ALLOW_MOCK_FALLBACK: booleanString,
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  STRIPE_PRO_MONTHLY_PRICE_ID: optionalString,
  STRIPE_PRO_ANNUAL_PRICE_ID: optionalString,
  STRIPE_ENABLE_AUTOMATIC_TAX: booleanString,
  DELIVERY_DEVICE_SECRET: optionalString,
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalString,
  MODERATION_CLEANUP_SECRET: optionalString,
}).superRefine((env, context) => {
  if (Boolean(env.UPSTASH_REDIS_REST_URL) !== Boolean(env.UPSTASH_REDIS_REST_TOKEN)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [env.UPSTASH_REDIS_REST_URL ? "UPSTASH_REDIS_REST_TOKEN" : "UPSTASH_REDIS_REST_URL"],
      message: "Both Upstash REST variables must be configured together.",
    });
  }

  const validateUrl = (
    key: "NEXT_PUBLIC_APP_URL" | "NEXT_PUBLIC_SUPABASE_URL" | "UPSTASH_REDIS_REST_URL",
    value: string | undefined,
    originOnly = false,
  ) => {
    if (!value) return;
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
    const transportAllowed =
      url.protocol === "https:" ||
      (env.NODE_ENV !== "production" && local && url.protocol === "http:");
    if (!transportAllowed || url.username || url.password) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: "Use credential-free HTTPS (HTTP is local-development only).",
      });
    }
    if (
      originOnly &&
      (url.pathname !== "/" || url.search !== "" || url.hash !== "")
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: "Use only the canonical origin, without a path, query, or fragment.",
      });
    }
  };

  validateUrl("NEXT_PUBLIC_APP_URL", env.NEXT_PUBLIC_APP_URL, true);
  validateUrl("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL);
  validateUrl("UPSTASH_REDIS_REST_URL", env.UPSTASH_REDIS_REST_URL);
  if (env.MODERATION_CLEANUP_SECRET && env.MODERATION_CLEANUP_SECRET.length < 32) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["MODERATION_CLEANUP_SECRET"],
      message: "Use at least 32 random characters for the cleanup worker secret.",
    });
  }

  if (
    env.NODE_ENV === "production" &&
    env.DELIVERY_DEVICE_SECRET &&
    env.DELIVERY_DEVICE_SECRET.length < 32
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["DELIVERY_DEVICE_SECRET"],
      message: "Use at least 32 characters of high-entropy secret material in production.",
    });
  }
});

export type ServerEnv = z.infer<typeof envSchema>;

let cachedEnv: ServerEnv | undefined;

export class EnvironmentError extends Error {
  readonly missing: string[];

  constructor(message: string, missing: string[] = []) {
    super(message);
    this.name = "EnvironmentError";
    this.missing = missing;
  }
}

export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    throw new EnvironmentError("The server environment is invalid.");
  }

  cachedEnv = result.data;
  return result.data;
}

export function requireEnv<K extends keyof ServerEnv>(
  ...keys: K[]
): ServerEnv & Required<Pick<ServerEnv, K>> {
  const env = getServerEnv();
  const missing = keys.filter((key) => !env[key]).map(String);
  if (missing.length > 0) {
    throw new EnvironmentError(
      `Missing required server configuration: ${missing.join(", ")}`,
      missing,
    );
  }
  return env as ServerEnv & Required<Pick<ServerEnv, K>>;
}

export function isSupabaseConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function isSupabaseAdminConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function isCanonicalHttpsOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      value === url.origin
    );
  } catch {
    return false;
  }
}

function isCredentialFreeHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function assertProductionConfiguration(): void {
  const env = getServerEnv();
  if (env.NODE_ENV !== "production") return;

  const required: (keyof ServerEnv)[] = [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENAI_API_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRO_MONTHLY_PRICE_ID",
    "STRIPE_PRO_ANNUAL_PRICE_ID",
    "DELIVERY_DEVICE_SECRET",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "MODERATION_CLEANUP_SECRET",
  ];
  const missing = required.filter((key) => !env[key]).map(String);

  if (
    env.NEXT_PUBLIC_APP_URL &&
    !isCanonicalHttpsOrigin(env.NEXT_PUBLIC_APP_URL)
  ) {
    missing.push("NEXT_PUBLIC_APP_URL=canonical HTTPS origin");
  }
  if (
    env.NEXT_PUBLIC_SUPABASE_URL &&
    !isCredentialFreeHttpsUrl(env.NEXT_PUBLIC_SUPABASE_URL)
  ) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL=https:// project URL");
  }

  if (env.DELIVERY_AI_MODE === "mock") missing.push("DELIVERY_AI_MODE=live");
  if (env.DELIVERY_AI_ALLOW_MOCK_FALLBACK) {
    missing.push("DELIVERY_AI_ALLOW_MOCK_FALLBACK=false");
  }
  if (missing.length > 0) {
    throw new EnvironmentError(
      `Production configuration is incomplete: ${missing.join(", ")}`,
      missing,
    );
  }
}

export function resetEnvCacheForTests(): void {
  cachedEnv = undefined;
}

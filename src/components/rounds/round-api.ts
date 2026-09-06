export class RoundApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

export async function roundApi<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(path, { cache: "no-store", ...init, signal: controller.signal });
    const body = await response.json().catch(() => null) as { data?: T; error?: { message?: string; code?: string } } | null;
    if (!response.ok || !body?.data) throw new RoundApiError(body?.error?.message ?? "That request did not finish. Please try again.", response.status, body?.error?.code);
    return body.data;
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") throw new RoundApiError("The connection took too long. Your last change may already be saved; retry to recover it.", 0);
    throw cause;
  } finally { clearTimeout(timer); }
}

export function roundPost<T>(path: string, body: unknown) {
  return roundApi<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export function roundDate(value: string) {
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
}

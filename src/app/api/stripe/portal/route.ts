import {
  AppError,
  ExternalServiceError,
  jsonError,
  jsonOk,
  requestIdFrom,
} from "@/lib/server/api-error";
import { assertAccountNotDeleting } from "@/lib/server/account-deletion";
import { enforceRateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";
import { assertSameOrigin } from "@/lib/server/request";
import { getAppOrigin, getStripe } from "@/lib/server/stripe";
import { requireUser } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await assertAccountNotDeleting(user.id);
    const rateLimit = await enforceRateLimit(`portal:${user.id}`, {
      limit: 10,
      windowMs: 10 * 60 * 1_000,
    });
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();
    if (error) throw new ExternalServiceError("Supabase", { cause: error });
    const customerId = data.stripe_customer_id as string | null;
    if (!customerId) {
      throw new AppError(
        "NO_BILLING_ACCOUNT",
        "No billing account exists for this profile yet.",
        404,
      );
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getAppOrigin(request)}/settings#account`,
    });
    return jsonOk(
      { url: session.url },
      requestId,
      { status: 201, headers: rateLimitHeaders(rateLimit) },
    );
  } catch (error) {
    return jsonError(error, requestId);
  }
}

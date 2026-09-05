import "server-only";

import { AppError } from "@/lib/server/api-error";

/** Deliberate launch boundary: opting into private play is not public-audience consent. */
export const MATURE_CONTENT_LABEL = "mature-content";
export function isMatureTake(rating: unknown, labels: readonly string[] = []): boolean {
  return rating === "mature" || labels.includes(MATURE_CONTENT_LABEL);
}
export function assertPublicContentAllowed(rating: unknown, labels: readonly string[] = []): void {
  if (isMatureTake(rating, labels)) {
    throw new AppError("MATURE_PUBLICATION_UNAVAILABLE", "Mature takes stay private while Delivery’s public age and audience policy is being finalized. You can keep playing privately.", 403);
  }
  if (rating !== "everyone" && rating !== "teen") {
    throw new AppError("CONTENT_RATING_UNAVAILABLE", "This take’s audience rating could not be verified. It stays private until the rating is available.", 409);
  }
}

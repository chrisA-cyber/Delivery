import type { DeliveryHistoryItem } from "@/types/game";

/** Untagged AI receipts use the original v1 score contract. Unknown sources or
 * explicit alternative versions remain in history, outside this comparison. */
export function comparableProfileHistory(history: readonly DeliveryHistoryItem[]): DeliveryHistoryItem[] {
  return history.filter((receipt) => receipt.source === "ai" && (receipt.scoringVersion === undefined || receipt.scoringVersion === "delivery-voice-v1"));
}

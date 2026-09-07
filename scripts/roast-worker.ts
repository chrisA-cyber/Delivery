import { runRoastTick, cleanupRoastHistory } from "../src/lib/server/roast-runtime";
import { roastMediaConfigured } from "../src/lib/server/roast-media";
let stopping = false;
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });
async function main() {
  if (!roastMediaConfigured()) { console.log("Roast Off live media is not configured; stage remains offline."); return; }
  console.log("Roast Off worker ready: two rooms maximum, no recording.");
  let cleanupAt = 0;
  while (!stopping) {
    try {
      await runRoastTick();
      if (Date.now() > cleanupAt) { await cleanupRoastHistory(); cleanupAt = Date.now() + 60 * 60_000; }
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ROAST_BUSY")) console.error("Roast Off control service unavailable; stages cannot advance.");
    }
    await new Promise(resolve => setTimeout(resolve, 750));
  }
}
void main().catch(() => { console.error("Roast Off worker could not start."); process.exitCode = 1; });

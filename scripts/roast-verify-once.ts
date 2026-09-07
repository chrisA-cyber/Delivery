import { spawn } from "node:child_process";
import { redisCommand } from "../src/lib/server/redis";

// Explicit operational opt-in, claimed once in the existing distributed store.
// No HTTP test endpoint, credential export, auth bypass or default test traffic.
const runId = process.env.ROAST_VERIFY_RUN_ID;
async function main() {
  if (!runId || !/^[0-9a-f-]{36}$/i.test(runId)) return;
  if (!process.env.LIVEKIT_API_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const claim = await redisCommand(["SET", `delivery:roast:verification:${runId}`, "started", "NX", "EX", 30 * 86_400]);
  if (claim !== "OK") { console.log("Roast verification already claimed; no repeated test traffic."); return; }
  const child = (command: string, args: string[], env: NodeJS.ProcessEnv, timeoutMs: number) => new Promise<number>((resolve) => {
    const proc = spawn(command, args, {stdio:"inherit", env});
    const timer = setTimeout(() => proc.kill("SIGTERM"), timeoutMs);
    proc.once("error", () => {clearTimeout(timer);resolve(1);});
    proc.once("exit", code => {clearTimeout(timer);resolve(code ?? 1);});
  });
  // Install the test-only native RTC client into disposable disk, with no
  // application credentials passed to package lifecycle scripts.
  const installationEnv:NodeJS.ProcessEnv={PATH:process.env.PATH,NODE_ENV:"production",npm_config_cache:"/tmp/roast-npm-cache"};
  const installed = await child("npm", ["install","--prefix","/tmp/delivery-roast-rtc","--no-audit","--no-fund","--save-exact","@livekit/rtc-node@0.13.34"], installationEnv, 90_000);
  if (installed !== 0) {console.error("ROAST_VERIFY_SETUP_FAILED: temporary RTC client unavailable; no users or media rooms created.");return;}
  const code=await child(process.execPath,["scripts/verify-roast-live.mjs"],process.env,9*60_000);
  await redisCommand(["SET",`delivery:roast:verification:${runId}`,code===0?"passed":"failed","EX",30*86_400]);
}
void main().catch(()=>{console.error("ROAST_VERIFY_SETUP_FAILED: verification could not start; inspect the bounded run before retrying.");process.exitCode=1;});

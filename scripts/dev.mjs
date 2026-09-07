import { spawn } from "node:child_process";

// Accept the standard preview flags while preserving Next.js development behavior.
const args = process.argv.slice(2)
  .filter((arg) => arg !== "--strictPort")
  .map((arg) => arg === "--host" ? "--hostname" : arg);
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--turbopack", ...args], { stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));

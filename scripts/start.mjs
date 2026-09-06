import {spawn} from "node:child_process";
const next=spawn(process.execPath,["node_modules/next/dist/bin/next","start",...process.argv.slice(2)],{stdio:"inherit",env:process.env});
const worker=process.env.DELIVERY_EXPORT_WORKER_DISABLED === "true" ? null : spawn(process.execPath,["--conditions=react-server","--import","tsx","scripts/export-worker.ts"],{stdio:"inherit",env:process.env});
let ending=false;
function stop(code=0){if(ending)return;ending=true;next.kill("SIGTERM");worker?.kill("SIGTERM");setTimeout(()=>process.exit(code),2000).unref();}
process.on("SIGTERM",()=>stop());process.on("SIGINT",()=>stop());
next.on("exit",code=>stop(code??1));worker?.on("exit",code=>{if(!ending){console.error("Video worker stopped; restarting service safely.");stop(code||1);}});

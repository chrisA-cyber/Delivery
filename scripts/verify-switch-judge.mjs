// Bounded opt-in production check. Stock synthetic WAVs only. No provider keys.
// Usage: node scripts/verify-switch-judge.mjs emotion|speed /absolute/fixture.wav
// The existing ledger is the cap and dispatch receipt; no automatic retries.
import fs from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
const [label,file]=process.argv.slice(2);
if(!['emotion','speed'].includes(label)||!file)throw new Error('Choose emotion or speed and an explicit WAV fixture');
const ledgerPath='docs/evidence/say-it-back/testing-budget.json';
const lock='/tmp/delivery-switch-judge.lock';
const fd=fs.openSync(lock,'wx');
const base='https://delivery-production-0577.up.railway.app';
let cookie='';
const evidence={label,at:new Date().toISOString(),checks:[],providerDispatches:0};
function check(name,condition){evidence.checks.push({name,passed:!!condition});if(!condition)throw new Error(name);}
async function req(path,init={}){
 const res=await fetch(base+path,{...init,headers:{Origin:base,...(cookie?{Cookie:cookie}:{}),...init.headers},signal:AbortSignal.timeout(65000)});
 if(res.headers.getSetCookie().length)cookie=res.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
 const body=await res.json();return {status:res.status,body,replayed:res.headers.get('idempotency-replayed')};
}
try {
 const d=JSON.parse(fs.readFileSync(ledgerPath));
 const reservation=d.reservations.find(x=>x.id==='switch-live-01');
 if(!reservation || d.reservedUpperBoundUsd>d.ceilingUsd || reservation.newJudgeAppRequests>=reservation.maximumNewJudgeAppRequests || d.requests.some(x=>x.reservation==='switch-live-01'&&x.label===label))throw new Error('Budget dispatch already used or unavailable. Do not rerun an unknown outcome.');
 const cat=await req('/api/switch/catalog');check('catalog200',cat.status===200);
 const challenge=cat.body.data.challenges.find(x=>x.id===(label==='emotion'?'not-my-problem':'speed-not-my-problem'));check('five identical phrases',challenge.cues.length===5&&new Set(challenge.cues.map(x=>x.text)).size===1);
 const audio=fs.readFileSync(file);evidence.audioSha256=createHash('sha256').update(audio).digest('hex');
 const form=new FormData();form.set('audio',new Blob([audio],{type:'audio/wav'}),'synthetic-switch.wav');form.set('challengeId',challenge.id);form.set('challengeVersion',challenge.version);form.set('durationMs','20000');form.set('attemptId',randomUUID());form.set('maxRating','everyone');
 const upload=await req('/api/switch/attempts',{method:'POST',body:form});check('private upload201',upload.status===201);const id=upload.body.data.attempt.id;fs.writeFileSync(`/tmp/delivery-switch-qa/${label}-session.json`,JSON.stringify({id,cookie}),{mode:0o600});
 const repeat=await req('/api/switch/attempts',{method:'POST',body:form});check('same-key upload recovered without duplicate',repeat.status===200&&repeat.body.data.attempt.id===id&&repeat.replayed==='true');
 const reopened=await req(`/api/switch/attempts/${id}`);check('saved cue snapshot preserved',isDeepStrictEqual(reopened.body.data.attempt.challenge,challenge));
 // Durable intent before dispatch. A failed/timed-out request still consumes
 // this test reservation and is never automatically sent again.
 reservation.newJudgeAppRequests++;reservation.state='running';
 const receipt={reservation:'switch-live-01',label,audioSha256:evidence.audioSha256,newJudgeRequest:true,conservativeUpperBoundUsd:.5,outcome:'dispatch-reserved'};d.requests.push(receipt);fs.writeFileSync(ledgerPath,JSON.stringify(d,null,2)+'\n');
 evidence.providerDispatches=1;
 const judged=await req(`/api/switch/attempts/${id}/judge`,{method:'POST'});
 receipt.outcome='response-received';receipt.status=judged.status;
 if(judged.body.data?.attempt?.score)evidence.score=judged.body.data.attempt.score;
 evidence.judgeStatus=judged.status;evidence.judgeError=judged.body.error?.code;
 fs.writeFileSync(ledgerPath,JSON.stringify(d,null,2)+'\n');
 check('actual full-audio score returned',judged.status===200&&judged.body.data?.attempt?.status==='scored');
 check('separate beta rubric',evidence.score.version==='switch-audio-v1-beta'&&evidence.score.beta===true&&evidence.score.ranked===false);
 check('five segment feedback entries',evidence.score.segments.length===5);
 check('heard repeated words',evidence.score.words!==null&&evidence.score.words>=90);
 // Only retry after a confirmed scored response: the server short-circuits
 // before its paid boundary. No unknown-outcome retry.
 const cached=await req(`/api/switch/attempts/${id}/judge`,{method:'POST'});check('cached scoring replay no extra play',cached.status===200&&cached.replayed==='true'&&isDeepStrictEqual(cached.body.data.attempt.score,evidence.score));
 const removal=await req(`/api/switch/attempts/${id}`,{method:'DELETE'});check('test take deletion',removal.status===200);
 if(reservation.newJudgeAppRequests===2)reservation.state='completed';
 fs.writeFileSync(ledgerPath,JSON.stringify(d,null,2)+'\n');
} catch(error){evidence.error=error.message;process.exitCode=1;}
finally{fs.mkdirSync('docs/evidence/switch',{recursive:true});fs.writeFileSync(`docs/evidence/switch/live-judge-${label}.json`,JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));fs.closeSync(fd);fs.unlinkSync(lock);}

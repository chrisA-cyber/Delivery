/** Test-only native WebRTC clients. These connect to actual LiveKit transport;
 * they do not exercise browser permission prompts, autoplay, or physical devices.
 * Install separately: npm install --prefix /tmp/delivery-roast-rtc --no-audit --no-fund @livekit/rtc-node@0.13.34
 * Import createRoastRtcClients(), then connect with ordinary app-issued tokens.
 * No provider admin tokens, room creation, or application-state shortcuts here.
 */
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

function bounded(promise, ms, message) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); })]).finally(() => clearTimeout(timer));
}

export async function createRoastRtcClients({ sdkPath = process.env.ROAST_RTC_SDK_PATH || "/tmp/delivery-roast-rtc/node_modules/@livekit/rtc-node/dist/index.js", maxDurationMs = 8 * 60_000 } = {}) {
  const sdk = await import(pathToFileURL(sdkPath).href);
  const clients = [];
  const pulseSentAt = new Map();
  let disposed = false;
  const deadline = setTimeout(() => { void dispose(); }, Math.min(maxDurationMs, 10 * 60_000));
  deadline.unref();

  async function connect({ url, token, label, identity }) {
    if (disposed || clients.length >= 8) throw new Error("RTC test session is closed or at its eight-client cap.");
    const room = new sdk.Room();
    const stats = { label, identity, connectMs: null, reconnectMs: [], disconnectedReason: null, publishRejected: 0, remote: {} };
    const local = { audio: null, video: null };
    const desired = { audio: false, video: false };
    const readers = new Map();
    const streams = new Set();
    let active = true;
    let syncWork = Promise.resolve();
    let reconnectAt = null;
    let audioLoop = null;
    let videoTimer = null;

    function reception(participant) {
      return stats.remote[participant.identity] ??= { audioFrames: 0, audibleFrames: 0, videoFrames: 0, firstAudioAt: null, lastAudioAt: null, firstVideoAt: null, lastVideoAt: null, audioTrackSids: [], videoTrackSids: [], pulseDelaysMs: [] };
    }
    room.on(sdk.RoomEvent.TrackSubscribed, (track, publication, participant) => {
      const remote = reception(participant);
      const audio = track.kind === sdk.TrackKind.KIND_AUDIO;
      const sids = audio ? remote.audioTrackSids : remote.videoTrackSids;
      sids.push(publication.sid);
      const stream = audio ? new sdk.AudioStream(track, 48_000, 1) : new sdk.VideoStream(track);
      const reader = stream.getReader(); readers.set(publication.sid, reader); streams.add(reader);
      void (async () => {
        let quietFrames = 10;
        while (active) {
          const { value, done } = await reader.read(); if (done) break;
          const now = Date.now();
          if (audio) {
            remote.audioFrames += 1; remote.firstAudioAt ??= now; remote.lastAudioAt = now;
            let energy = 0;
            for (const sample of value.data) energy += sample * sample;
            const audible = Math.sqrt(energy / value.data.length) > 1_500;
            if (audible) {
              remote.audibleFrames += 1;
              if (quietFrames >= 3) {
                const sent = pulseSentAt.get(participant.identity);
                // All generated sources/receivers use this process's clock.
                // This includes encoding, SFU transit and decode, not speakers.
                if (sent && now >= sent && now - sent < 1_500) remote.pulseDelaysMs.push(now - sent);
              }
              quietFrames = 0;
            } else quietFrames += 1;
          } else { remote.videoFrames += 1; remote.firstVideoAt ??= now; remote.lastVideoAt = now; }
        }
      })().catch(() => {}).finally(() => { streams.delete(reader); });
    });
    room.on(sdk.RoomEvent.TrackUnsubscribed, (_track, publication, participant) => {
      const remote = reception(participant);
      remote.audioTrackSids = remote.audioTrackSids.filter(sid => sid !== publication.sid);
      remote.videoTrackSids = remote.videoTrackSids.filter(sid => sid !== publication.sid);
      const reader = readers.get(publication.sid); readers.delete(publication.sid); void reader?.cancel().catch(() => {});
    });
    room.on(sdk.RoomEvent.LocalTrackUnpublished, publication => {
      for (const entry of Object.values(local)) if (entry?.publication?.sid === publication.sid) entry.publication = null;
      void syncPublishing();
    });
    room.on(sdk.RoomEvent.TokenRefreshed, () => { void syncPublishing(); });
    room.on(sdk.RoomEvent.Reconnecting, () => { reconnectAt = Date.now(); });
    room.on(sdk.RoomEvent.Reconnected, () => { if (reconnectAt !== null) stats.reconnectMs.push(Date.now() - reconnectAt); reconnectAt = null; void syncPublishing(); });
    room.on(sdk.RoomEvent.Disconnected, reason => { stats.disconnectedReason = sdk.DisconnectReason[reason] || String(reason); });

    async function prepare({ camera = true } = {}) {
      if (!local.audio) {
        const source = new sdk.AudioSource(48_000, 1, 100);
        const track = sdk.LocalAudioTrack.createAudioTrack("generated-roast-microphone", source);
        local.audio = { source, track, publication: null };
        audioLoop = (async () => {
          let sampleIndex = 0, lastPulse = -1;
          const began = Date.now();
          while (active) {
            const elapsed = Date.now() - began, pulse = Math.floor(elapsed / 2_000), sounding = elapsed % 2_000 < 120;
            if (sounding && pulse !== lastPulse) { lastPulse = pulse; pulseSentAt.set(identity, Date.now()); }
            const data = new Int16Array(480);
            for (let index = 0; index < data.length; index += 1) data[index] = sounding ? Math.round(9_000 * Math.sin(2 * Math.PI * 440 * sampleIndex++ / 48_000)) : 0;
            await source.captureFrame(new sdk.AudioFrame(data, 48_000, 1, data.length));
            // A little backpressure keeps the native queue below 100ms.
            await delay(8);
          }
        })().catch(() => {});
      }
      if (camera && !local.video) {
        const source = new sdk.VideoSource(640, 360);
        const track = sdk.LocalVideoTrack.createVideoTrack("generated-roast-camera", source);
        local.video = { source, track, publication: null };
        let sequence = 0;
        videoTimer = setInterval(() => {
          if (!active) return;
          const data = new Uint8Array(640 * 360 * 4), stripe = sequence++ % 640;
          for (let pixel = 0; pixel < 640 * 360; pixel += 1) {
            const offset = pixel * 4;
            data[offset] = pixel % 640 < stripe ? 220 : 30;
            data[offset + 1] = label.length * 17 % 240;
            data[offset + 2] = 150; data[offset + 3] = 255;
          }
          try { source.captureFrame(new sdk.VideoFrame(data, 640, 360, sdk.VideoBufferType.RGBA)); } catch { /* Closing source. */ }
        }, 67);
      }
    }

    async function publish(kind) {
      const entry = local[kind]; if (!entry) throw new Error("Prepare generated media before publishing.");
      if (entry.publication) return true;
      const source = kind === "audio" ? sdk.TrackSource.SOURCE_MICROPHONE : sdk.TrackSource.SOURCE_CAMERA;
      const options = new sdk.TrackPublishOptions({ source, simulcast: false, videoCodec: sdk.VideoCodec.VP8, videoEncoding: { maxBitrate: 350_000, maxFramerate: 15 }, audioEncoding: { maxBitrate: 32_000 }, dtx: false });
      try {
        entry.publication = await bounded(room.localParticipant.publishTrack(entry.track, options), 7_000, "Track publish timed out.");
        return true;
      } catch { stats.publishRejected += 1; return false; }
    }
    function syncPublishing() {
      syncWork = syncWork.catch(() => {}).then(async () => {
        if (!active || !room.isConnected) return;
        for (const kind of ["audio", "video"]) {
          const entry = local[kind]; if (!entry) continue;
          if (!desired[kind] && entry.publication) { await room.localParticipant.unpublishTrack(entry.publication.sid); entry.publication = null; }
          else if (desired[kind] && !entry.publication) await publish(kind);
        }
      });
      return syncWork;
    }
    async function setPublishing({ audio = false, video = false }) { desired.audio = audio; desired.video = video; await syncPublishing(); }
    async function disconnect() {
      if (!active) return;
      active = false; desired.audio = false; desired.video = false; clearInterval(videoTimer);
      for (const reader of streams) void reader.cancel().catch(() => {});
      await bounded(room.disconnect(), 5_000, "RTC disconnect timed out.").catch(() => {});
      for (const entry of Object.values(local)) if (entry) { await entry.track.close().catch(() => {}); await entry.source.close().catch(() => {}); }
      await bounded(audioLoop || Promise.resolve(), 1_000, "Generator stopped.").catch(() => {});
    }
    async function reconnect({ full = false } = {}) {
      const began = Date.now();
      let listener;
      const recovered = new Promise(resolve => { listener = () => resolve(Date.now() - began); room.once(sdk.RoomEvent.Reconnected, listener); });
      try { await room.simulateScenario(full ? sdk.SimulateScenarioKind.SIMULATE_FULL_RECONNECT : sdk.SimulateScenarioKind.SIMULATE_SIGNAL_RECONNECT); return await bounded(recovered, 15_000, "RTC reconnect did not recover within 15 seconds."); }
      finally { room.off(sdk.RoomEvent.Reconnected, listener); }
    }
    const client = { label, identity, room, prepare, setPublishing, tryPublish: publish, reconnect, disconnect, summary: () => structuredClone(stats) };
    clients.push(client);
    const began = Date.now();
    try { await bounded(room.connect(url, token, { autoSubscribe: true, dynacast: false }), 15_000, "RTC connect timed out."); stats.connectMs = Date.now() - began; }
    catch { await disconnect(); throw new Error(`RTC client ${label} could not connect.`); }
    return client;
  }

  async function dispose() {
    if (disposed) return;
    disposed = true; clearTimeout(deadline);
    await Promise.allSettled(clients.map(client => client.disconnect()));
    await sdk.dispose();
  }
  return { connect, dispose, summaries: () => clients.map(client => client.summary()) };
}

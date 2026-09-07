"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectionState, DisconnectReason, Room, RoomEvent, Track, createAudioAnalyser, createLocalAudioTrack, createLocalVideoTrack, type LocalAudioTrack, type LocalVideoTrack, type RemoteAudioTrack, type RemoteTrack, type RemoteTrackPublication, type RemoteParticipant } from "livekit-client";

export interface RoastMediaOptions {
  url?: string;
  token?: string;
  identity?: string;
  enabled?: boolean;
  blockedIdentities?: string[];
  hostMuted?: boolean;
  onConnectionChange?: (state: ConnectionState) => void;
  onCameraChange?: (enabled: boolean) => void | Promise<void>;
}
export interface RoastPreparationOptions { camera?: boolean; microphoneDeviceId?: string; cameraDeviceId?: string }

const videoCapture = { resolution: { width: 640, height: 360, frameRate: 15 } };

/** Joining only receives media. Device acquisition is exclusively inside the
 * user's prepare / toggle-camera actions. Permission notifications can publish
 * an already acquired track after explicit stage acceptance; never getUserMedia. */
export function useRoastMedia({ url, token, identity, enabled = true, blockedIdentities = [], hostMuted = false, onConnectionChange, onCameraChange }: RoastMediaOptions) {
  const [room, setRoom] = useState<Room | null>(null);
  const [connectionState, setConnectionState] = useState(ConnectionState.Disconnected);
  const [error, setError] = useState<string | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalAudioTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<LocalVideoTrack | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [stageConsent, setStageConsent] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [revision, setRevision] = useState(0);
  const audioRef = useRef<LocalAudioTrack | null>(null);
  const videoRef = useRef<LocalVideoTrack | null>(null);
  const roomRef = useRef<Room | null>(null);
  const consentRef = useRef(false);
  const micEnabledRef = useRef(true);
  const operationRef = useRef<Promise<void>>(Promise.resolve());
  const preparedGeneration = useRef(0);
  const onConnectionRef = useRef(onConnectionChange);
  onConnectionRef.current = onConnectionChange;
  const onCameraRef = useRef(onCameraChange);
  onCameraRef.current = onCameraChange;
  const blockedRef = useRef(new Set(blockedIdentities));
  blockedRef.current = new Set(blockedIdentities);
  const remoteAudioRef = useRef(new Map<string, { track: RemoteAudioTrack; element: HTMLMediaElement; identity: string }>());
  const update = useCallback(() => setRevision((value) => value + 1), []);

  const syncPublication = useCallback(() => {
    operationRef.current = operationRef.current.catch(() => undefined).then(async () => {
      const currentRoom = roomRef.current;
      if (!currentRoom || currentRoom.state !== ConnectionState.Connected) return;
      const participant = currentRoom.localParticipant;
      for (const source of [Track.Source.Microphone, Track.Source.Camera]) {
        const track = source === Track.Source.Microphone ? audioRef.current : videoRef.current;
        const permissions = participant.permissions;
        const allowed = Boolean(consentRef.current && permissions?.canPublish && permissions.canPublishSources.includes(Track.sourceToProto(source)) && (source !== Track.Source.Microphone || micEnabledRef.current));
        const publication = participant.getTrackPublication(source);
        if ((!allowed || publication?.track !== track) && publication?.track) await participant.unpublishTrack(publication.track, false);
        if (allowed && track && track.mediaStreamTrack.readyState === "live" && !participant.getTrackPublication(source)) {
          // No track creation and no remote unmute here. The local user already
          // enabled this exact track and accepted the stage.
          await participant.publishTrack(track, { source, name: source });
        }
      }
      update();
    }).catch(() => {
      // A turn can change during publication. Never retry by acquiring devices.
      setError("Your media could not publish. Check your connection, then use your microphone or camera control to try again.");
    });
    return operationRef.current;
  }, [update]);

  const stopPreview = useCallback(() => {
    preparedGeneration.current += 1;
    consentRef.current = false;
    setStageConsent(false);
    audioRef.current?.stop();
    videoRef.current?.stop();
    audioRef.current = null;
    videoRef.current = null;
    setLocalAudioTrack(null);
    setLocalVideoTrack(null);
    setPreparing(false);
    void syncPublication();
  }, [syncPublication]);

  useEffect(() => {
    if (!enabled || !url || !token) return;
    let disposed = false;
    const currentRoom = new Room({ adaptiveStream: true, dynacast: true, stopLocalTrackOnUnpublish: false, disconnectOnPageLeave: true, publishDefaults: { videoCodec: "vp8", videoEncoding: { maxBitrate: 350_000, maxFramerate: 15 }, audioPreset: { maxBitrate: 32_000 }, simulcast: false, forceStereo: false, stopMicTrackOnMute: false } });
    const remoteAudio = remoteAudioRef.current;
    roomRef.current = currentRoom;
    setRoom(currentRoom);
    setError(null);
    const changed = (state: ConnectionState) => { if (!disposed) { setConnectionState(state); onConnectionRef.current?.(state); update(); } };
    const audioStatus = () => { if (!disposed) setAudioBlocked(!currentRoom.canPlaybackAudio); };
    const subscribed = (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      if (track.kind === Track.Kind.Audio) {
        const audio = track as RemoteAudioTrack;
        const element = document.createElement("audio");
        element.muted = blockedRef.current.has(participant.identity);
        audio.attach(element);
        element.style.display = "none";
        document.body.appendChild(element);
        remoteAudio.set(track.sid!, { track: audio, element, identity: participant.identity });
      }
      update();
    };
    const unsubscribed = (track: RemoteTrack) => {
      const attached = remoteAudio.get(track.sid!);
      if (attached) { attached.track.detach(attached.element); attached.element.remove(); remoteAudio.delete(track.sid!); }
      update();
    };
    const disconnected = (reason?: DisconnectReason) => {
      if (disposed) return;
      stopPreview();
      if (reason === DisconnectReason.PARTICIPANT_REMOVED) setError("You were removed from this live room.");
      else if (reason === DisconnectReason.DUPLICATE_IDENTITY) setError("This live room was opened in another tab. Continue there or reconnect here.");
      else if (reason === DisconnectReason.ROOM_DELETED) setError("The host closed this live room.");
      else setError("Live media disconnected. Reconnect to keep listening; devices remain off until you enable them again.");
    };
    currentRoom.on(RoomEvent.ConnectionStateChanged, changed).on(RoomEvent.AudioPlaybackStatusChanged, audioStatus).on(RoomEvent.TrackSubscribed, subscribed).on(RoomEvent.TrackUnsubscribed, unsubscribed).on(RoomEvent.ParticipantConnected, update).on(RoomEvent.ParticipantDisconnected, update).on(RoomEvent.ActiveSpeakersChanged, update).on(RoomEvent.TrackMuted, update).on(RoomEvent.TrackUnmuted, update).on(RoomEvent.ParticipantPermissionsChanged, syncPublication).on(RoomEvent.LocalTrackUnpublished, syncPublication).on(RoomEvent.Reconnected, syncPublication).on(RoomEvent.Disconnected, disconnected);
    void currentRoom.connect(url, token, { autoSubscribe: true }).then(() => { if (!disposed) { changed(currentRoom.state); audioStatus(); void syncPublication(); } }).catch(() => { if (!disposed) { setError("Could not connect to live media. Check your connection and try reconnecting."); changed(ConnectionState.Disconnected); } });
    return () => {
      disposed = true;
      currentRoom.removeAllListeners();
      roomRef.current = null;
      setConnectionState(ConnectionState.Disconnected);
      for (const { track, element } of remoteAudio.values()) { track.detach(element); element.remove(); }
      remoteAudio.clear();
      stopPreview();
      void currentRoom.disconnect(true);
    };
  }, [url, token, identity, enabled, stopPreview, syncPublication, update]);

  useEffect(() => () => stopPreview(), [stopPreview]);

  const blockedKey = blockedIdentities.join(",");
  useEffect(() => {
    for (const audio of remoteAudioRef.current.values()) audio.element.muted = blockedRef.current.has(audio.identity);
  }, [blockedKey]);

  useEffect(() => {
    if (!hostMuted) return;
    micEnabledRef.current = false; setMicrophoneEnabled(false);
    // Host muting may stop a stream. Only the user's own button may unmute it
    // later; clearing a host restriction does not resume capture/transmission.
    void audioRef.current?.mute().then(syncPublication).catch(() => {});
  }, [hostMuted, syncPublication]);

  const prepare = useCallback(async (options: RoastPreparationOptions = {}) => {
    const generation = ++preparedGeneration.current;
    setPreparing(true);
    setError(null);
    let audio: LocalAudioTrack | null = null;
    let video: LocalVideoTrack | null = null;
    try {
      // A new private check withdraws any earlier broadcast consent. Replacing
      // devices in this preview must not put them onto an already assigned seat.
      consentRef.current = false; setStageConsent(false);
      await syncPublication();
      audio = await createLocalAudioTrack({ deviceId: options.microphoneDeviceId || undefined, echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 });
      if (options.camera) video = await createLocalVideoTrack({ ...videoCapture, deviceId: options.cameraDeviceId || undefined });
      if (generation !== preparedGeneration.current) { audio.stop(); video?.stop(); return false; }
      audioRef.current?.stop(); videoRef.current?.stop();
      audioRef.current = audio; videoRef.current = video;
      setLocalAudioTrack(audio); setLocalVideoTrack(video);
      micEnabledRef.current = true; setMicrophoneEnabled(true);
      audio.mediaStreamTrack.addEventListener("ended", update);
      video?.mediaStreamTrack.addEventListener("ended", update);
      // enumerateDevices itself doesn't request permissions. Camera labels may
      // remain generic until the user explicitly enables their camera.
      setDevices(await navigator.mediaDevices.enumerateDevices());
      await onCameraRef.current?.(Boolean(video));
      await syncPublication();
      return true;
    } catch {
      audio?.stop(); video?.stop();
      if (generation === preparedGeneration.current) setError("Your device check did not finish. Allow microphone access in this browser, check the selected devices, and try again. Camera is optional.");
      return false;
    } finally { if (generation === preparedGeneration.current) setPreparing(false); }
  }, [syncPublication, update]);

  const acceptStage = useCallback(() => {
    if (audioRef.current?.mediaStreamTrack.readyState !== "live") { setError("Check your microphone before accepting the stage."); return false; }
    consentRef.current = true; setStageConsent(true); void syncPublication(); return true;
  }, [syncPublication]);
  const leaveStage = useCallback(() => { consentRef.current = false; setStageConsent(false); void syncPublication(); }, [syncPublication]);
  const toggleMicrophone = useCallback(async () => {
    if (!audioRef.current || audioRef.current.mediaStreamTrack.readyState !== "live") return;
    micEnabledRef.current = !micEnabledRef.current; setMicrophoneEnabled(micEnabledRef.current);
    // Muting switches off the captured samples immediately even if signaling is
    // reconnecting. Unmute is only called by the user's own button.
    if (micEnabledRef.current) await audioRef.current.unmute(); else await audioRef.current.mute();
    await syncPublication();
  }, [syncPublication]);
  const toggleCamera = useCallback(async (deviceId?: string) => {
    const generation = ++preparedGeneration.current;
    if (videoRef.current) { videoRef.current.stop(); videoRef.current = null; setLocalVideoTrack(null); await syncPublication(); await onCameraRef.current?.(false); return; }
    try {
      const video = await createLocalVideoTrack({ ...videoCapture, deviceId: deviceId || undefined });
      if (generation !== preparedGeneration.current) { video.stop(); return; }
      videoRef.current = video; setLocalVideoTrack(video); video.mediaStreamTrack.addEventListener("ended", update);
      setDevices(await navigator.mediaDevices.enumerateDevices());
      await onCameraRef.current?.(true);
      await syncPublication();
    } catch { setError("Camera unavailable. You can stay voice-only or allow camera access and try again."); }
  }, [syncPublication, update]);
  const unlockAudio = useCallback(async () => {
    try { await roomRef.current?.startAudio(); setAudioBlocked(!roomRef.current?.canPlaybackAudio); }
    catch { setAudioBlocked(true); }
  }, []);
  const disconnect = useCallback(async () => { stopPreview(); await roomRef.current?.disconnect(true); }, [stopPreview]);

  return { room, identity, connectionState, error, audioBlocked, unlockAudio, prepare, preparing, localAudioTrack, localVideoTrack, devices, ready: localAudioTrack?.mediaStreamTrack.readyState === "live", stageConsent, acceptStage, leaveStage, toggleMicrophone, toggleCamera, microphoneEnabled, stopPreview, disconnect, revision };
}

export type RoastMedia = ReturnType<typeof useRoastMedia>;

function VideoTrack({ track, mirrored = false, label }: { track: Track; mirrored?: boolean; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { const element = ref.current; if (!element) return; track.attach(element); return () => { track.detach(element); }; }, [track]);
  return <video ref={ref} autoPlay muted playsInline aria-label={label} className={`h-full w-full object-cover ${mirrored ? "-scale-x-100" : ""}`} />;
}

export function PerformerMedia({ media, identity, name, active = false, blocked = false }: { media: RoastMedia; identity?: string; name: string; active?: boolean; blocked?: boolean }) {
  const local = identity === media.room?.localParticipant.identity;
  const participant = local ? media.room?.localParticipant : identity ? media.room?.remoteParticipants.get(identity) : undefined;
  const publication = participant?.getTrackPublication(Track.Source.Camera);
  const video = publication?.track;
  const speaking = participant?.isSpeaking && !blocked;
  const microphone = participant?.getTrackPublication(Track.Source.Microphone);
  return <div className={`relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl border bg-ink ${active ? "border-acid" : "border-white/10"}`} data-speaking={speaking ? "true" : "false"}>
    {video && !publication?.isMuted && !blocked ? <VideoTrack track={video} mirrored={local} label={`${name}'s live camera`} /> : <div className={`flex h-20 w-20 items-center justify-center rounded-full bg-hot/15 text-4xl font-black text-paper ${speaking ? "ring-4 ring-acid" : "ring-1 ring-white/10"}`} aria-label={speaking ? `${name} is speaking` : `${name}, voice only`}>{name.slice(0, 1).toUpperCase() || "?"}</div>}
    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/90 to-transparent px-4 pb-3 pt-9"><span className="truncate font-semibold text-white">{name}{local ? " (you)" : ""}</span><span className="shrink-0 text-xs text-white/70">{blocked ? "Blocked" : !participant ? "Connecting…" : speaking ? "Speaking" : active && microphone && !microphone.isMuted ? "Mic live" : "Mic off"}</span></div>
  </div>;
}

function MicrophoneMeter({ track }: { track: LocalAudioTrack }) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    try {
      const analyser = createAudioAnalyser(track);
      const timer = window.setInterval(() => setLevel(Math.min(100, Math.round(analyser.calculateVolume() * 350))), 120);
      return () => { window.clearInterval(timer); void analyser.cleanup(); };
    } catch { return; }
  }, [track]);
  return <div><p className="mb-2 text-xs text-white/60">Say something. Your microphone stays private until you accept the stage.</p><div role="meter" aria-label="Microphone input" aria-valuemin={0} aria-valuemax={100} aria-valuenow={level} className="h-2 overflow-hidden rounded bg-white/10"><div className="h-full bg-electric" style={{ width: `${level}%` }} /></div></div>;
}

export function RoastMediaPreparation({ media }: { media: RoastMedia }) {
  const [camera, setCamera] = useState(false);
  const [microphoneDeviceId, setMicrophoneDeviceId] = useState("");
  const [cameraDeviceId, setCameraDeviceId] = useState("");
  return <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
    <div><h3 className="font-bold text-white">Your private device check</h3><p className="mt-1 text-sm text-white/60">Voice only is welcome. This preview stays private.</p></div>
    {media.localVideoTrack && <div className="aspect-video overflow-hidden rounded-xl"><VideoTrack track={media.localVideoTrack} mirrored label="Your private camera preview" /></div>}
    {media.localAudioTrack && <MicrophoneMeter track={media.localAudioTrack} />}
    <label className="flex items-center gap-2 text-sm text-white/80"><input type="checkbox" checked={camera} onChange={(event) => setCamera(event.target.checked)} />Include my camera in the check</label>
    {(["audioinput", "videoinput"] as const).map((kind) => {
      const available = media.devices.filter((device) => device.kind === kind);
      if (available.length < 2 || (kind === "videoinput" && !camera)) return null;
      return <label key={kind} className="block text-sm text-white/70">{kind === "audioinput" ? "Microphone" : "Camera"}<select className="mt-1 w-full rounded-lg border border-white/15 bg-ink p-2 text-white" value={kind === "audioinput" ? microphoneDeviceId : cameraDeviceId} onChange={(event) => (kind === "audioinput" ? setMicrophoneDeviceId : setCameraDeviceId)(event.target.value)}><option value="">System default</option>{available.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Device ${index + 1}`}</option>)}</select></label>;
    })}
    <div className="flex flex-wrap gap-2"><button type="button" disabled={media.preparing} className="button-primary" onClick={() => { void media.prepare({ camera, microphoneDeviceId, cameraDeviceId }); }}>{media.preparing ? "Checking…" : media.ready ? "Check again" : "Check microphone"}</button>{media.ready && <button type="button" className="button-secondary" onClick={media.stopPreview}>Turn devices off</button>}</div>
    {media.ready && <p className="text-sm text-electric">Microphone ready. Accept a stage invite to let the room hear you.</p>}
    {media.error && <p role="alert" className="text-sm text-acid">{media.error}</p>}
  </div>;
}

export function RoastMediaControls({ media, isPerformer = false }: { media: RoastMedia; isPerformer?: boolean }) {
  return <div className="flex flex-wrap items-center gap-2 text-sm">
    <span className={media.connectionState === ConnectionState.Connected ? "text-electric" : "text-acid"}>{media.connectionState === ConnectionState.Connected ? "Live connection" : media.connectionState === ConnectionState.Reconnecting ? "Reconnecting media…" : media.connectionState === ConnectionState.Connecting ? "Connecting media…" : "Media disconnected"}</span>
    {media.audioBlocked && <button type="button" className="button-primary" onClick={() => { void media.unlockAudio(); }}>Tap to hear the stage</button>}
    {isPerformer && media.ready && <><button type="button" className="button-secondary" onClick={() => { void media.toggleMicrophone(); }}>{media.microphoneEnabled ? "Mute my mic" : "Enable my mic"}</button><button type="button" className="button-secondary" onClick={() => { void media.toggleCamera(); }}>{media.localVideoTrack ? "Camera off" : "Enable camera"}</button></>}
  </div>;
}

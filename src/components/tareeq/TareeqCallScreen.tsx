'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLang } from '@/context/LanguageContext';
import { consumeOutRingPipeline, releaseOutRingPipeline } from '@/lib/tareeq-ring-pipeline';

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    {
      urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443'],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:relay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:relay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all',
};

export interface CallParty {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

interface Props {
  callId: string;
  role: 'caller' | 'callee';
  callType: 'audio' | 'video';
  remoteUser: CallParty;
  offer?: string;
  autoAnswer?: boolean;
  onEnd: () => void;
}

type CallState = 'ringing' | 'connecting' | 'active' | 'ended' | 'rejected' | 'failed';

// SVG icon components for crisp rendering
function PhoneIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02L6.62 10.79z" />
    </svg>
  );
}

function PhoneOffIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <path d="M23.71 16.67C20.66 13.78 16.54 12 12 12 7.46 12 3.34 13.78.29 16.67c-.18.18-.29.43-.29.71 0 .28.11.53.29.71l2.48 2.48c.18.18.43.29.71.29.27 0 .52-.11.7-.28.79-.74 1.69-1.36 2.66-1.85.33-.16.56-.5.56-.9v-3.1c1.45-.47 2.99-.73 4.6-.73 1.61 0 3.15.26 4.6.72v3.1c0 .39.23.74.56.9.98.49 1.87 1.12 2.67 1.85.18.18.43.28.7.28.28 0 .53-.11.71-.29l2.48-2.48c.18-.18.29-.43.29-.71-.01-.28-.12-.53-.3-.71z" />
    </svg>
  );
}

function MicIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
    </svg>
  );
}

function MicOffIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
    </svg>
  );
}

function CameraIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
    </svg>
  );
}

function CameraOffIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <path d="M21 6.5l-4-4-15 15 1.5 1.5 3.5-3.5H16c.55 0 1-.45 1-1v-3.5l4 4V6.5zm-10 1l6 6V8h-3L11 7.5zm2.5 9.5H4c-.55 0-1-.45-1-1V8c0-.37.2-.68.5-.85L2.04 5.69C1.4 6.15 1 6.83 1 7.61V17c0 1.1.9 2 2 2h13.83l-1-1-.33-.33-2.17-2.17.17.5z" />
    </svg>
  );
}

function CallButton({
  variant, label, onClick, size = 60,
}: {
  variant: 'accept' | 'decline' | 'mute' | 'mutedOn' | 'camera' | 'cameraOn' | 'cancel' | 'end';
  label: string;
  onClick: () => void;
  size?: number;
}) {
  const cfg = {
    accept:   { bg: 'linear-gradient(135deg,#15803d,#22c55e)', shadow: 'rgba(34,197,94,0.45)', Icon: () => <PhoneIcon size={size * 0.38} /> },
    decline:  { bg: 'linear-gradient(135deg,#b91c1c,#ef4444)', shadow: 'rgba(239,68,68,0.45)',  Icon: () => <PhoneOffIcon size={size * 0.38} /> },
    cancel:   { bg: 'linear-gradient(135deg,#b91c1c,#ef4444)', shadow: 'rgba(239,68,68,0.45)',  Icon: () => <PhoneOffIcon size={size * 0.38} /> },
    end:      { bg: 'linear-gradient(135deg,#b91c1c,#ef4444)', shadow: 'rgba(239,68,68,0.45)',  Icon: () => <PhoneOffIcon size={size * 0.38} /> },
    mute:     { bg: 'rgba(255,255,255,0.10)', shadow: 'none', Icon: () => <MicIcon size={size * 0.36} /> },
    mutedOn:  { bg: 'rgba(220,38,38,0.20)',   shadow: 'none', Icon: () => <MicOffIcon size={size * 0.36} /> },
    camera:   { bg: 'rgba(255,255,255,0.10)', shadow: 'none', Icon: () => <CameraIcon size={size * 0.36} /> },
    cameraOn: { bg: 'rgba(220,38,38,0.20)',   shadow: 'none', Icon: () => <CameraOffIcon size={size * 0.36} /> },
  }[variant];

  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 active:scale-90 transition-transform select-none">
      <div
        className="rounded-full flex items-center justify-center"
        style={{
          width: size, height: size,
          background: cfg.bg,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: cfg.shadow !== 'none'
            ? `0 0 0 10px ${cfg.shadow}28, 0 8px 32px ${cfg.shadow}80`
            : '0 2px 16px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <cfg.Icon />
      </div>
      <span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>{label}</span>
    </button>
  );
}

export default function TareeqCallScreen({ callId, role, callType, remoteUser, offer, autoAnswer, onEnd }: Props) {
  const { isRtl } = useLang();
  const [callState, setCallState] = useState<CallState>('ringing');
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const permissionDeniedRef = useRef(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outRingRef = useRef<{ stop: () => void } | null>(null);
  const appliedCallerIce = useRef<number>(0);
  const appliedCalleeIce = useRef<number>(0);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  // Use video element for audio-only calls: mobile browsers route <video> audio
  // to the loudspeaker, while <audio> goes to the earpiece by default.
  const remoteAudioRef = useRef<HTMLVideoElement>(null);
  const endedRef = useRef(false);

  function startOutRing() {
    try {
      // Use the pre-wired loudspeaker pipeline (wired synchronously in the gesture handler
      // before any awaits — ensures vid.play() ran within the browser's gesture frame).
      // Fall back to a fresh AudioContext routing to ctx.destination (earpiece) if the
      // pipeline was never prewired (e.g. autoAnswer from notification tap).
      const { ctx: prewiredCtx, dest: prewiredDest } = consumeOutRingPipeline();

      const ACtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!ACtx) return;

      const ctx = prewiredCtx ?? new ACtx({ latencyHint: 'playback' });
      const dest: AudioNode = prewiredDest ?? ctx.destination;

      ctx.resume().catch(() => {});
      let stopped = false;
      let ringInterval: ReturnType<typeof setInterval> | null = null;

      const playBurst = (t: number, dur: number) => {
        [400, 450].forEach(freq => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(dest);
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
          gain.gain.setValueAtTime(0.15, t + dur - 0.02);
          gain.gain.linearRampToValueAtTime(0, t + dur);
          osc.start(t); osc.stop(t + dur);
        });
      };

      const ring = () => {
        if (stopped || ctx.state === 'closed') return;
        try {
          const t = ctx.currentTime + 0.05;
          playBurst(t, 0.4);
          playBurst(t + 0.6, 0.4);
        } catch { /* ctx closed */ }
      };

      ring();
      ringInterval = setInterval(() => {
        if (stopped) { if (ringInterval) clearInterval(ringInterval); return; }
        ring();
      }, 3000);

      outRingRef.current = {
        stop: () => {
          stopped = true;
          if (ringInterval) { clearInterval(ringInterval); ringInterval = null; }
          releaseOutRingPipeline();
          if (!prewiredCtx) ctx.close().catch(() => {});
        },
      };
    } catch { /* AudioContext not supported */ }
  }

  function stopOutRing() {
    outRingRef.current?.stop();
    outRingRef.current = null;
  }

  function stopAll() {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    if (durationRef.current) { clearInterval(durationRef.current); durationRef.current = null; }
    if (ringTimeoutRef.current) { clearTimeout(ringTimeoutRef.current); ringTimeoutRef.current = null; }
    if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null; }
    stopOutRing();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
  }

  const endCall = useCallback(async (status: 'ended' | 'rejected' | 'failed' | 'missed' = 'ended') => {
    if (endedRef.current) return;
    endedRef.current = true;
    stopAll();
    setCallState(status === 'missed' ? 'ended' : status);
    if (status !== 'failed') {
      const action = status === 'rejected' ? 'reject' : status === 'missed' ? 'missed' : 'end';
      await fetch(`/api/tareeq/calls/${callId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action }),
      }).catch(() => {});
    }
    setTimeout(onEnd, 1200);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, onEnd]);

  async function getMedia(): Promise<MediaStream | null> {
    try {
      return await navigator.mediaDevices.getUserMedia(
        callType === 'video'
          ? { audio: true, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } }
          : { audio: true, video: false }
      );
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
        permissionDeniedRef.current = true;
        setPermissionDenied(true);
      } else {
        setErrorMsg(isRtl ? 'تعذر الوصول للكاميرا والميكروفون' : 'Camera/microphone unavailable');
      }
      return null;
    }
  }

  const startCaller = useCallback(async () => {
    setCallState('connecting');
    const stream = await getMedia();
    if (!stream) { if (!permissionDeniedRef.current) endCall('failed'); return; }
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.ontrack = (ev) => {
      if (!ev.streams[0]) return;
      if (callType === 'video' && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = ev.streams[0];
        remoteVideoRef.current.play().catch(() => {});
      } else if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = ev.streams[0];
        remoteAudioRef.current.play().catch(() => {});
      }
    };

    // ICE candidates — debounced flush (500ms) so first candidate is sent within ~1s
    const callerIceQueue: RTCIceCandidateInit[] = [];
    let callerIceDebounce: ReturnType<typeof setTimeout> | null = null;
    const flushCallerIce = async () => {
      if (callerIceDebounce) { clearTimeout(callerIceDebounce); callerIceDebounce = null; }
      if (endedRef.current || callerIceQueue.length === 0) return;
      await fetch(`/api/tareeq/calls/${callId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'callerIce', candidates: [...callerIceQueue] }),
      }).catch(() => {});
    };
    pc.onicecandidate = (ev) => {
      if (!ev.candidate || endedRef.current) return;
      callerIceQueue.push(ev.candidate.toJSON());
      if (callerIceDebounce) clearTimeout(callerIceDebounce);
      callerIceDebounce = setTimeout(flushCallerIce, 500);
    };
    // Fallback: flush after 6s in case debounce never fires
    const iceFlushTimer = setTimeout(flushCallerIce, 6000);
    pc.onicegatheringstatechange = async () => {
      if (endedRef.current) return;
      if (pc.iceGatheringState === 'complete') { clearTimeout(iceFlushTimer); await flushCallerIce(); }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        if (ringTimeoutRef.current) { clearTimeout(ringTimeoutRef.current); ringTimeoutRef.current = null; }
        if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null; }
        stopOutRing();
        setCallState('active');
        durationRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      }
      if (pc.connectionState === 'failed') {
        endCall('ended');
      }
      if (pc.connectionState === 'disconnected') {
        // Transient — give 6 s to recover before ending
        disconnectTimerRef.current = setTimeout(() => {
          if (!endedRef.current && pcRef.current?.connectionState === 'disconnected') endCall('ended');
        }, 6000);
      }
    };

    const offerSdp = await pc.createOffer();
    await pc.setLocalDescription(offerSdp);

    const offerRes = await fetch(`/api/tareeq/calls/${callId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action: 'setOffer', offer: offerSdp.sdp }),
    }).catch(() => null);
    if (!offerRes?.ok) { endCall('failed'); return; }

    // Play outgoing ring tone while waiting for the callee to pick up
    setCallState('ringing');
    startOutRing();

    // Auto-cancel after 90 seconds if callee never answers
    ringTimeoutRef.current = setTimeout(() => {
      if (!endedRef.current) endCall('missed');
    }, 90_000);

    pollingRef.current = setInterval(async () => {
      if (endedRef.current) return;
      const res = await fetch(`/api/tareeq/calls/${callId}`, { credentials: 'include' }).catch(() => null);
      if (!res?.ok) return;
      const { call } = await res.json();
      if (!call) return;

      if (call.status === 'rejected') { endCall('rejected'); return; }
      if (call.status === 'ended' || call.status === 'missed') { endCall('ended'); return; }

      if (call.answer && pc.remoteDescription === null) {
        try { await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: call.answer })); } catch { /* ignore */ }
      }

      const calleeIce: RTCIceCandidateInit[] = call.calleeIce ?? [];
      for (let i = appliedCalleeIce.current; i < calleeIce.length; i++) {
        try { await pc.addIceCandidate(new RTCIceCandidate(calleeIce[i])); } catch { /* ignore */ }
        appliedCalleeIce.current = i + 1;
      }
    }, 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, callType, endCall, isRtl]);

  const answerCall = useCallback(async () => {
    if (!offer) { setErrorMsg('No offer received'); return; }
    setCallState('connecting');

    const stream = await getMedia();
    if (!stream) { if (!permissionDeniedRef.current) endCall('failed'); return; }
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.ontrack = (ev) => {
      if (!ev.streams[0]) return;
      if (callType === 'video' && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = ev.streams[0];
        remoteVideoRef.current.play().catch(() => {});
      } else if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = ev.streams[0];
        remoteAudioRef.current.play().catch(() => {});
      }
    };

    // ICE candidates — debounced flush (500ms) so first candidate is sent within ~1s
    const calleeIceQueue: RTCIceCandidateInit[] = [];
    let calleeIceDebounce: ReturnType<typeof setTimeout> | null = null;
    const flushCalleeIce = async () => {
      if (calleeIceDebounce) { clearTimeout(calleeIceDebounce); calleeIceDebounce = null; }
      if (endedRef.current || calleeIceQueue.length === 0) return;
      await fetch(`/api/tareeq/calls/${callId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'calleeIce', candidates: [...calleeIceQueue] }),
      }).catch(() => {});
    };
    pc.onicecandidate = (ev) => {
      if (!ev.candidate || endedRef.current) return;
      calleeIceQueue.push(ev.candidate.toJSON());
      if (calleeIceDebounce) clearTimeout(calleeIceDebounce);
      calleeIceDebounce = setTimeout(flushCalleeIce, 500);
    };
    // Fallback: flush after 6s in case debounce never fires
    const iceFlushTimerCallee = setTimeout(flushCalleeIce, 6000);
    pc.onicegatheringstatechange = async () => {
      if (endedRef.current) return;
      if (pc.iceGatheringState === 'complete') { clearTimeout(iceFlushTimerCallee); await flushCalleeIce(); }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        if (disconnectTimerRef.current) { clearTimeout(disconnectTimerRef.current); disconnectTimerRef.current = null; }
        setCallState('active');
        durationRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      }
      if (pc.connectionState === 'failed') {
        endCall('ended');
      }
      if (pc.connectionState === 'disconnected') {
        // Transient — give 6 s to recover before ending
        disconnectTimerRef.current = setTimeout(() => {
          if (!endedRef.current && pcRef.current?.connectionState === 'disconnected') endCall('ended');
        }, 6000);
      }
    };

    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offer }));
    } catch {
      setErrorMsg(isRtl ? 'خطأ في بيانات المكالمة' : 'Invalid call offer');
      endCall('failed'); return;
    }
    let answerSdp: RTCSessionDescriptionInit;
    try {
      answerSdp = await pc.createAnswer();
      await pc.setLocalDescription(answerSdp);
    } catch {
      setErrorMsg(isRtl ? 'تعذر إنشاء الاتصال' : 'Could not create answer');
      endCall('failed'); return;
    }

    const answerRes = await fetch(`/api/tareeq/calls/${callId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action: 'answer', answer: answerSdp.sdp }),
    }).catch(() => null);
    if (!answerRes?.ok) { endCall('failed'); return; }

    pollingRef.current = setInterval(async () => {
      if (endedRef.current) return;
      const res = await fetch(`/api/tareeq/calls/${callId}`, { credentials: 'include' }).catch(() => null);
      if (!res?.ok) return;
      const { call } = await res.json();
      if (!call) return;
      if (call.status === 'ended' || call.status === 'missed' || call.status === 'rejected') { endCall('ended'); return; }

      const callerIce: RTCIceCandidateInit[] = call.callerIce ?? [];
      for (let i = appliedCallerIce.current; i < callerIce.length; i++) {
        try { await pc.addIceCandidate(new RTCIceCandidate(callerIce[i])); } catch { /* ignore */ }
        appliedCallerIce.current = i + 1;
      }
    }, 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, callType, offer, endCall, isRtl]);

  useEffect(() => {
    if (role === 'caller') startCaller();
    if (role === 'callee' && autoAnswer) answerCall();
    return () => {
      endedRef.current = true;
      stopAll();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleMute() {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMuted(m => !m);
  }

  function toggleCamera() {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setCameraOff(c => !c);
  }

  function fmtDuration(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  const stateLabel: Record<CallState, string> = {
    ringing:    role === 'caller' ? (isRtl ? 'جاري الاتصال...' : 'Calling...') : (isRtl ? 'مكالمة واردة...' : 'Incoming call...'),
    connecting: isRtl ? 'جاري الاتصال...' : 'Connecting...',
    active:     fmtDuration(duration),
    ended:      isRtl ? 'انتهت المكالمة' : 'Call ended',
    rejected:   isRtl ? 'تم رفض المكالمة' : 'Call rejected',
    failed:     errorMsg || (isRtl ? 'فشلت المكالمة' : 'Call failed'),
  };

  const isWaiting = callState === 'ringing' || callState === 'connecting';

  return (
    <div
      className="fixed inset-0 z-[150] flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #040b12 0%, #071422 45%, #0c1e30 100%)' }}
    >
      {/* Keyframes injected once */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes ringPulse {
          0%   { transform: scale(1); opacity: 0.6; }
          60%  { transform: scale(1.35); opacity: 0; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        @keyframes ripple1 { 0%{transform:scale(1);opacity:.45} 100%{transform:scale(1.7);opacity:0} }
        @keyframes ripple2 { 0%{transform:scale(1);opacity:.3}  100%{transform:scale(2.1);opacity:0} }
        @keyframes ripple3 { 0%{transform:scale(1);opacity:.18} 100%{transform:scale(2.6);opacity:0} }
        @keyframes floatDot {
          0%,100%{ transform:translateY(0) scale(1); opacity:.6; }
          50%    { transform:translateY(-6px) scale(1.15); opacity:1; }
        }
      `}</style>

      {/* Remote audio — video element routes to loudspeaker on mobile (audio element uses earpiece) */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={remoteAudioRef} autoPlay playsInline
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />

      {/* Remote video — full screen, for video calls */}
      {callType === 'video' && (
        <video
          ref={remoteVideoRef}
          autoPlay playsInline
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
          style={{ opacity: callState === 'active' ? 0.8 : 0.2 }}
        />
      )}

      {/* Deep ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div style={{
          position: 'absolute', top: '25%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 500, height: 500, borderRadius: '50%',
          background: callState === 'active'
            ? 'radial-gradient(circle, rgba(13,148,136,0.22) 0%, transparent 65%)'
            : 'radial-gradient(circle, rgba(212,168,83,0.14) 0%, transparent 65%)',
          filter: 'blur(70px)',
          transition: 'background 1.5s ease',
        }} />
        <div style={{
          position: 'absolute', bottom: '5%', left: '15%',
          width: 280, height: 280, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
          filter: 'blur(55px)',
        }} />
      </div>

      {/* ── Avatar section ── */}
      <div
        className="flex-1 flex flex-col items-center relative z-10 transition-all duration-700"
        style={{
          paddingTop: callState === 'active' ? 52 : 48,
          justifyContent: callState === 'active' ? 'flex-start' : 'center',
        }}
      >
        {/* Ripple rings — only while ringing / connecting */}
        {(() => {
          const sz = callState === 'active' ? (callType === 'video' ? 72 : 110) : 200;
          return (
        <div className="relative flex items-center justify-center transition-all duration-700"
          style={{ width: sz, height: sz, marginBottom: callState === 'active' ? 12 : 32 }}>
          {isWaiting && (
            <>
              <div className="absolute inset-0 rounded-full" style={{
                background: 'rgba(212,168,83,0.18)',
                animation: 'ripple1 2s ease-out infinite',
              }} />
              <div className="absolute inset-0 rounded-full" style={{
                background: 'rgba(212,168,83,0.12)',
                animation: 'ripple2 2s ease-out infinite 0.55s',
              }} />
              <div className="absolute inset-0 rounded-full" style={{
                background: 'rgba(212,168,83,0.07)',
                animation: 'ripple3 2s ease-out infinite 1.1s',
              }} />
            </>
          )}

          {/* Gold/teal ring border around avatar */}
          <div className="absolute inset-0 rounded-full transition-all duration-1000" style={{
            background: callState === 'active'
              ? 'conic-gradient(from 0deg, #0d9488, #2dd4bf, #0d9488)'
              : 'conic-gradient(from 0deg, #a07830, #f0c060, #a07830)',
            padding: 3,
            animation: isWaiting ? 'spin 4s linear infinite' : undefined,
          }}>
            <div className="w-full h-full rounded-full" style={{ background: '#071422' }} />
          </div>

          {/* Avatar */}
          <div className="absolute rounded-full overflow-hidden" style={{ inset: 6 }}>
            {remoteUser.avatarUrl
              ? <img src={remoteUser.avatarUrl} alt={remoteUser.name} className="w-full h-full object-cover" />
              : (
                <div className="w-full h-full flex items-center justify-center font-black transition-all duration-700" style={{
                  fontSize: callState === 'active' ? 28 : 56,
                  background: 'linear-gradient(135deg,#1a4a3a,#0d9488)', color: '#fff',
                }}>
                  {remoteUser.name.charAt(0)}
                </div>
              )
            }
          </div>
        </div>
          ); // end IIFE return
        })()}

        {/* Name */}
        <h2
          className="font-black text-white text-center px-6 mb-1 transition-all duration-700"
          style={{
            fontSize: callState === 'active' ? 16 : 30,
            textShadow: '0 2px 24px rgba(0,0,0,0.6)',
            letterSpacing: '-0.02em',
            opacity: (callState === 'active' && callType === 'video') ? 0.8 : 1,
          }}
        >
          {remoteUser.name}
        </h2>

        {/* Call type badge — hidden when active */}
        {!isWaiting ? null : (
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full mb-4"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span style={{ fontSize: 13 }}>{callType === 'video' ? '📹' : '🎙️'}</span>
            <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {callType === 'video' ? (isRtl ? 'مكالمة فيديو' : 'Video call') : (isRtl ? 'مكالمة صوتية' : 'Voice call')}
            </span>
          </div>
        )}

        {/* Status line */}
        <div className="flex items-center justify-center mt-1" style={{ minHeight: 36 }}>
          {callState === 'active' ? (
            <p className="font-black tabular-nums transition-all duration-700"
              style={{
                fontSize: callType === 'video' ? 14 : 22,
                color: '#2dd4bf',
                textShadow: '0 0 20px rgba(45,212,191,0.4)',
              }}>
              {fmtDuration(duration)}
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {stateLabel[callState]}
              </p>
              {isWaiting && (
                <div className="flex items-center gap-1">
                  {[0, 0.3, 0.6].map((delay, i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full" style={{
                      background: 'rgba(255,255,255,0.45)',
                      animation: `floatDot 1.2s ease-in-out infinite ${delay}s`,
                    }} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Local PiP — video calls.
          Use visibility/opacity instead of display:none — some mobile browsers stop
          the video track when the element is display:none, breaking the srcObject pipeline. */}
      <video
        ref={localVideoRef}
        autoPlay playsInline muted
        className="absolute z-20 rounded-2xl object-cover"
        style={{
          width: 88, height: 118,
          bottom: 160, right: 20,
          border: '2px solid rgba(255,255,255,0.2)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
          visibility: (callType === 'video' && callState === 'active' && !cameraOff) ? 'visible' : 'hidden',
          opacity: (callType === 'video' && callState === 'active' && !cameraOff) ? 1 : 0,
          pointerEvents: (callType === 'video' && callState === 'active' && !cameraOff) ? 'auto' : 'none',
        }}
      />

      {/* ── Permission denied guide ── */}
      {permissionDenied && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center p-6"
          style={{ background: 'rgba(4,11,18,0.88)', backdropFilter: 'blur(12px)' }}>
          <div className="w-full max-w-sm rounded-3xl p-6 flex flex-col items-center gap-4 text-center"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)' }}>
              {callType === 'video' ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 10l4.553-2.277A1 1 0 0121 8.678v6.644a1 1 0 01-1.447.894L15 14"/>
                  <rect x="3" y="6" width="12" height="12" rx="2"/>
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="22"/>
                  <line x1="8" y1="22" x2="16" y2="22"/>
                </svg>
              )}
            </div>
            {/* Title */}
            <h3 className="font-black text-lg text-white leading-snug">
              {isRtl
                ? `يلزم الإذن ${callType === 'video' ? 'بالكاميرا والميكروفون' : 'بالميكروفون'}`
                : `${callType === 'video' ? 'Camera & Microphone' : 'Microphone'} Access Required`}
            </h3>
            {/* Description */}
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {isRtl
                ? 'التطبيق يحتاج إذن الوصول للمكالمة. اتبع الخطوات التالية:'
                : 'The app needs permission to access your device. Follow these steps:'}
            </p>
            {/* Steps */}
            <div className="w-full flex flex-col gap-2.5 text-right" dir={isRtl ? 'rtl' : 'ltr'}>
              {(isRtl ? [
                { n: '١', t: 'اضغط على رمز القفل في شريط عنوان المتصفح' },
                { n: '٢', t: 'اختر "أذونات الموقع" أو "إعدادات الموقع"' },
                { n: '٣', t: `فعّل "${callType === 'video' ? 'الكاميرا و' : ''}الميكروفون"` },
                { n: '٤', t: 'ارجع للتطبيق واضغط "إعادة المحاولة"' },
              ] : [
                { n: '1', t: 'Tap the lock icon in your browser\'s address bar' },
                { n: '2', t: 'Select "Site settings" or "Permissions"' },
                { n: '3', t: `Enable "${callType === 'video' ? 'Camera &' : ''} Microphone"` },
                { n: '4', t: 'Come back and tap Retry below' },
              ]).map(({ n, t }) => (
                <div key={n} className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
                    style={{ background: 'rgba(251,191,36,0.18)', color: '#fbbf24' }}>{n}</span>
                  <span className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>{t}</span>
                </div>
              ))}
            </div>
            {/* Retry button */}
            <button
              onClick={() => {
                permissionDeniedRef.current = false;
                setPermissionDenied(false);
                if (role === 'caller') startCaller();
                else answerCall();
              }}
              className="w-full py-3.5 rounded-2xl font-black text-sm transition active:scale-95"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#000' }}
            >
              {isRtl ? 'إعادة المحاولة' : 'Retry'}
            </button>
            {/* Cancel */}
            <button
              onClick={() => endCall('failed')}
              className="text-sm font-semibold transition"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              {isRtl ? 'إلغاء المكالمة' : 'Cancel call'}
            </button>
          </div>
        </div>
      )}

      {/* ── Controls ── */}
      <div
        className="relative z-10 flex items-end justify-center gap-8 px-8"
        style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom, 2.5rem))', minHeight: 140 }}
      >
        {/* Callee ringing: Decline + Accept */}
        {callState === 'ringing' && role === 'callee' && !autoAnswer && (
          <>
            <CallButton variant="decline" size={68} label={isRtl ? 'رفض' : 'Decline'} onClick={() => endCall('rejected')} />
            <CallButton variant="accept"  size={68} label={isRtl ? 'قبول' : 'Accept'}  onClick={answerCall} />
          </>
        )}

        {/* Mute / Camera controls when active */}
        {(callState === 'connecting' || callState === 'active') && (
          <>
            <CallButton
              variant={muted ? 'mutedOn' : 'mute'}
              label={muted ? (isRtl ? 'رفع الكتم' : 'Unmute') : (isRtl ? 'كتم' : 'Mute')}
              onClick={toggleMute}
            />
            {callType === 'video' && (
              <CallButton
                variant={cameraOff ? 'cameraOn' : 'camera'}
                label={cameraOff ? (isRtl ? 'تشغيل' : 'Camera on') : (isRtl ? 'إيقاف' : 'Camera off')}
                onClick={toggleCamera}
              />
            )}
          </>
        )}

        {/* End / Cancel — visible unless callee has explicit Accept/Decline */}
        {callState !== 'ended' && callState !== 'rejected' && callState !== 'failed' &&
         !(callState === 'ringing' && role === 'callee' && !autoAnswer) && (
          <CallButton
            variant={callState === 'ringing' && role === 'caller' ? 'cancel' : 'end'}
            size={callState === 'ringing' && role === 'caller' ? 68 : 60}
            label={callState === 'ringing' && role === 'caller'
              ? (isRtl ? 'إلغاء' : 'Cancel')
              : (isRtl ? 'إنهاء' : 'End')}
            onClick={() => endCall(role === 'callee' && callState === 'ringing' ? 'rejected' : 'ended')}
          />
        )}
      </div>
    </div>
  );
}

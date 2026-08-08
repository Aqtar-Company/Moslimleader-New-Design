'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLang } from '@/context/LanguageContext';

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
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
  ],
  iceCandidatePoolSize: 10,
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

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outRingRef = useRef<{ stop: () => void } | null>(null);
  const appliedCallerIce = useRef<number>(0);
  const appliedCalleeIce = useRef<number>(0);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const endedRef = useRef(false);

  function startOutRing() {
    try {
      const ACtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!ACtx) return;
      const ctx = new ACtx();
      let stopped = false;

      // PSTN ring-back tone: dual 400 Hz + 450 Hz, two 400ms bursts, 2s silence
      const playBurst = (t: number, dur: number) => {
        [400, 450].forEach(freq => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
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
        if (stopped || !ctx || ctx.state === 'closed') return;
        try {
          const t = ctx.currentTime;
          playBurst(t, 0.4);
          playBurst(t + 0.6, 0.4);
        } catch { /* ctx closed */ }
      };

      ring();
      const interval = setInterval(() => { if (stopped) { clearInterval(interval); return; } ring(); }, 3000);

      outRingRef.current = {
        stop: () => {
          stopped = true;
          clearInterval(interval);
          ctx.close().catch(() => {});
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
        callType === 'video' ? { audio: true, video: true } : { audio: true, video: false }
      );
    } catch {
      setErrorMsg(isRtl ? 'يرجى السماح بالوصول إلى الكاميرا والميكروفون' : 'Camera/microphone access denied');
      return null;
    }
  }

  const startCaller = useCallback(async () => {
    setCallState('connecting');
    const stream = await getMedia();
    if (!stream) { endCall('failed'); return; }
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.ontrack = (ev) => {
      if (!ev.streams[0]) return;
      if (callType === 'video' && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = ev.streams[0];
      } else if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = ev.streams[0];
      }
    };

    const callerIceQueue: RTCIceCandidateInit[] = [];
    pc.onicecandidate = (ev) => {
      if (ev.candidate) callerIceQueue.push(ev.candidate.toJSON());
    };
    const flushCallerIce = async () => {
      if (endedRef.current || callerIceQueue.length === 0) return;
      await fetch(`/api/tareeq/calls/${callId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'callerIce', candidates: callerIceQueue }),
      }).catch(() => {});
    };
    const iceFlushTimer = setTimeout(flushCallerIce, 5000);
    pc.onicegatheringstatechange = async () => {
      if (endedRef.current) return;
      if (pc.iceGatheringState === 'complete') { clearTimeout(iceFlushTimer); await flushCallerIce(); }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        if (ringTimeoutRef.current) { clearTimeout(ringTimeoutRef.current); ringTimeoutRef.current = null; }
        stopOutRing();
        setCallState('active');
        durationRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      }
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall('ended');
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

    // Auto-cancel after 60 seconds if callee never answers
    ringTimeoutRef.current = setTimeout(() => {
      if (!endedRef.current) endCall('missed');
    }, 60_000);

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
    if (!stream) { endCall('failed'); return; }
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.ontrack = (ev) => {
      if (!ev.streams[0]) return;
      if (callType === 'video' && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = ev.streams[0];
      } else if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = ev.streams[0];
      }
    };

    const calleeIceQueue: RTCIceCandidateInit[] = [];
    pc.onicecandidate = (ev) => {
      if (ev.candidate) calleeIceQueue.push(ev.candidate.toJSON());
    };
    const flushCalleeIce = async () => {
      if (endedRef.current || calleeIceQueue.length === 0) return;
      await fetch(`/api/tareeq/calls/${callId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'calleeIce', candidates: calleeIceQueue }),
      }).catch(() => {});
    };
    const iceFlushTimerCallee = setTimeout(flushCalleeIce, 5000);
    pc.onicegatheringstatechange = async () => {
      if (endedRef.current) return;
      if (pc.iceGatheringState === 'complete') { clearTimeout(iceFlushTimerCallee); await flushCalleeIce(); }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallState('active');
        durationRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      }
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall('ended');
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: offer }));
    const answerSdp = await pc.createAnswer();
    await pc.setLocalDescription(answerSdp);

    await fetch(`/api/tareeq/calls/${callId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action: 'answer', answer: answerSdp.sdp }),
    });

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

      {/* Remote audio — always rendered so audio calls have a playback element */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="sr-only" />

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
      <div className="flex-1 flex flex-col items-center justify-center relative z-10" style={{ paddingTop: 48 }}>

        {/* Ripple rings — only while ringing / connecting */}
        <div className="relative flex items-center justify-center" style={{ width: 200, height: 200, marginBottom: 32 }}>
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
                <div className="w-full h-full flex items-center justify-center font-black" style={{
                  fontSize: 56, background: 'linear-gradient(135deg,#1a4a3a,#0d9488)', color: '#fff',
                }}>
                  {remoteUser.name.charAt(0)}
                </div>
              )
            }
          </div>
        </div>

        {/* Name */}
        <h2 className="font-black text-3xl text-white text-center px-6 mb-2" style={{ textShadow: '0 2px 24px rgba(0,0,0,0.6)', letterSpacing: '-0.02em' }}>
          {remoteUser.name}
        </h2>

        {/* Call type badge */}
        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full mb-4"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span style={{ fontSize: 13 }}>{callType === 'video' ? '📹' : '🎙️'}</span>
          <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {callType === 'video' ? (isRtl ? 'مكالمة فيديو' : 'Video call') : (isRtl ? 'مكالمة صوتية' : 'Voice call')}
          </span>
        </div>

        {/* Status line */}
        <div className="h-10 flex items-center justify-center">
          {callState === 'active' ? (
            <p className="text-xl font-black tabular-nums" style={{ color: '#2dd4bf', textShadow: '0 0 20px rgba(45,212,191,0.4)' }}>
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

      {/* Local PiP — video calls */}
      <video
        ref={localVideoRef}
        autoPlay playsInline muted
        className="absolute z-20 rounded-2xl object-cover"
        style={{
          width: 88, height: 118,
          bottom: 160, right: 20,
          border: '2px solid rgba(255,255,255,0.2)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
          display: (callType === 'video' && callState === 'active' && !cameraOff) ? 'block' : 'none',
        }}
      />

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

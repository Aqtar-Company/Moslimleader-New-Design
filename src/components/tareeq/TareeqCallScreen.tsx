'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLang } from '@/context/LanguageContext';

const STUN = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };

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
  offer?: string; // callee receives the offer
  onEnd: () => void;
}

type CallState = 'ringing' | 'connecting' | 'active' | 'ended' | 'rejected' | 'failed';

function Avatar({ user, size = 80 }: { user: CallParty; size?: number }) {
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt={user.name} className="rounded-full object-cover" style={{ width: size, height: size, border: '3px solid rgba(212,168,83,0.5)' }} />;
  }
  return (
    <div className="rounded-full flex items-center justify-center font-black" style={{ width: size, height: size, fontSize: size * 0.35, background: 'linear-gradient(135deg,#1a4a3a,#0d9488)', color: '#fff', border: '3px solid rgba(212,168,83,0.5)' }}>
      {user.name.charAt(0)}
    </div>
  );
}

export default function TareeqCallScreen({ callId, role, callType, remoteUser, offer, onEnd }: Props) {
  const { isRtl } = useLang();
  // Caller starts at 'ringing' (waiting for callee to answer)
  const [callState, setCallState] = useState<CallState>(role === 'callee' ? 'ringing' : 'ringing');
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appliedCallerIce = useRef<number>(0);
  const appliedCalleeIce = useRef<number>(0);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  // Guard against multiple concurrent endCall invocations
  const endedRef = useRef(false);

  function stopAll() {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    if (durationRef.current) { clearInterval(durationRef.current); durationRef.current = null; }
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
  }

  const endCall = useCallback(async (status: 'ended' | 'rejected' | 'failed' = 'ended') => {
    if (endedRef.current) return;
    endedRef.current = true;
    stopAll();
    setCallState(status);
    if (status !== 'failed') {
      await fetch(`/api/tareeq/calls/${callId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: status === 'rejected' ? 'reject' : 'end' }),
      }).catch(() => {});
    }
    setTimeout(onEnd, 1200);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, onEnd]);

  async function getMedia(): Promise<MediaStream | null> {
    try {
      return await navigator.mediaDevices.getUserMedia(callType === 'video' ? { audio: true, video: true } : { audio: true, video: false });
    } catch {
      setErrorMsg(isRtl ? 'لم يتم السماح بالوصول إلى الميكروفون' : 'Microphone access denied');
      return null;
    }
  }

  // Caller: create offer on the LIVE PC, PATCH it to DB, then poll for answer + ICE
  const startCaller = useCallback(async () => {
    setCallState('connecting');
    const stream = await getMedia();
    if (!stream) { endCall('failed'); return; }
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    const pc = new RTCPeerConnection(STUN);
    pcRef.current = pc;
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.ontrack = (ev) => {
      if (remoteVideoRef.current && ev.streams[0]) remoteVideoRef.current.srcObject = ev.streams[0];
    };

    // Collect ICE candidates and send them in one batch after gathering completes
    const callerIceQueue: RTCIceCandidateInit[] = [];
    pc.onicecandidate = (ev) => {
      if (ev.candidate) callerIceQueue.push(ev.candidate.toJSON());
    };
    pc.onicegatheringstatechange = async () => {
      if (pc.iceGatheringState === 'complete' && callerIceQueue.length > 0) {
        await fetch(`/api/tareeq/calls/${callId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ action: 'callerIce', candidates: callerIceQueue }),
        }).catch(() => {});
      }
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

    // Create offer on this LIVE PC and immediately PATCH it to the DB
    const offerSdp = await pc.createOffer();
    await pc.setLocalDescription(offerSdp);

    await fetch(`/api/tareeq/calls/${callId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action: 'setOffer', offer: offerSdp.sdp }),
    }).catch(() => {});

    // Poll for answer + callee ICE candidates
    pollingRef.current = setInterval(async () => {
      if (endedRef.current) return;
      const res = await fetch(`/api/tareeq/calls/${callId}`, { credentials: 'include' }).catch(() => null);
      if (!res?.ok) return;
      const { call } = await res.json();
      if (!call) return;

      if (call.status === 'rejected') { endCall('rejected'); return; }
      if (call.status === 'ended' || call.status === 'missed') { endCall('ended'); return; }

      // Apply answer once
      if (call.answer && pc.remoteDescription === null) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: call.answer }));
        } catch { /* ignore */ }
      }

      // Apply new callee ICE candidates
      const calleeIce: RTCIceCandidateInit[] = call.calleeIce ?? [];
      for (let i = appliedCalleeIce.current; i < calleeIce.length; i++) {
        try { await pc.addIceCandidate(new RTCIceCandidate(calleeIce[i])); } catch { /* ignore */ }
        appliedCalleeIce.current = i + 1;
      }
    }, 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, callType, endCall, isRtl]);

  // Callee: receive offer, create answer, poll for caller ICE
  const answerCall = useCallback(async () => {
    if (!offer) { setErrorMsg('No offer received'); return; }
    setCallState('connecting');

    const stream = await getMedia();
    if (!stream) { endCall('failed'); return; }
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    const pc = new RTCPeerConnection(STUN);
    pcRef.current = pc;
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.ontrack = (ev) => {
      if (remoteVideoRef.current && ev.streams[0]) remoteVideoRef.current.srcObject = ev.streams[0];
    };

    // Collect ICE candidates and send them in one batch after gathering completes
    const calleeIceQueue: RTCIceCandidateInit[] = [];
    pc.onicecandidate = (ev) => {
      if (ev.candidate) calleeIceQueue.push(ev.candidate.toJSON());
    };
    pc.onicegatheringstatechange = async () => {
      if (pc.iceGatheringState === 'complete' && calleeIceQueue.length > 0) {
        await fetch(`/api/tareeq/calls/${callId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ action: 'calleeIce', candidates: calleeIceQueue }),
        }).catch(() => {});
      }
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

    // Poll for caller ICE candidates
    pollingRef.current = setInterval(async () => {
      if (endedRef.current) return;
      const res = await fetch(`/api/tareeq/calls/${callId}`, { credentials: 'include' }).catch(() => null);
      if (!res?.ok) return;
      const { call } = await res.json();
      if (!call) return;
      if (call.status === 'ended') { endCall('ended'); return; }

      const callerIce: RTCIceCandidateInit[] = call.callerIce ?? [];
      for (let i = appliedCallerIce.current; i < callerIce.length; i++) {
        try { await pc.addIceCandidate(new RTCIceCandidate(callerIce[i])); } catch { /* ignore */ }
        appliedCallerIce.current = i + 1;
      }
    }, 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, callType, offer, endCall, isRtl]);

  // Caller starts on mount
  useEffect(() => {
    if (role === 'caller') startCaller();
    return () => stopAll();
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
    ringing: role === 'caller' ? (isRtl ? 'جاري الاتصال...' : 'Calling...') : (isRtl ? 'مكالمة واردة...' : 'Incoming call...'),
    connecting: isRtl ? 'جاري الاتصال...' : 'Connecting...',
    active: fmtDuration(duration),
    ended: isRtl ? 'انتهت المكالمة' : 'Call ended',
    rejected: isRtl ? 'تم رفض المكالمة' : 'Call rejected',
    failed: errorMsg || (isRtl ? 'فشلت المكالمة' : 'Call failed'),
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex flex-col items-center justify-between py-16"
      style={{ background: 'linear-gradient(160deg, #070d14 0%, #0d1a26 55%, #142030 100%)' }}
    >
      {/* Remote video */}
      {callType === 'video' && (
        <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover opacity-70" />
      )}

      {/* Ambient glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div style={{
          width: 320, height: 320, borderRadius: '50%',
          background: callState === 'active'
            ? 'radial-gradient(circle, rgba(13,148,136,0.15) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(212,168,83,0.12) 0%, transparent 70%)',
          filter: 'blur(40px)', transition: 'background 1s ease',
        }} />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-4 mt-8">
        {(callState === 'ringing' || callState === 'connecting') && (
          <div className="absolute -inset-4 rounded-full animate-ping opacity-25" style={{ background: 'var(--tr-gold)' }} />
        )}
        <Avatar user={remoteUser} size={100} />
        <h2 className="font-black text-2xl text-white mt-2">{remoteUser.name}</h2>
        <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {callType === 'video' ? (isRtl ? '📹 مكالمة فيديو' : '📹 Video call') : (isRtl ? '🎙️ مكالمة صوتية' : '🎙️ Voice call')}
        </p>
        <p className="text-base font-bold" style={{ color: callState === 'active' ? '#2dd4bf' : 'rgba(255,255,255,0.55)' }}>
          {stateLabel[callState]}
        </p>
      </div>

      {/* Local video PiP */}
      {callType === 'video' && callState === 'active' && !cameraOff && (
        <video ref={localVideoRef} autoPlay playsInline muted
          className="absolute bottom-36 end-4 w-24 rounded-xl z-20 object-cover"
          style={{ aspectRatio: '3/4', border: '2px solid rgba(255,255,255,0.3)' }}
        />
      )}

      {/* Controls */}
      <div className="relative z-10 flex items-center gap-6 pb-4">
        {/* Callee ringing: Accept + Reject */}
        {callState === 'ringing' && role === 'callee' && (
          <>
            <CtrlBtn icon="✕" label={isRtl ? 'رفض' : 'Decline'} color="#ef4444" size={64} onClick={() => endCall('rejected')} />
            <CtrlBtn icon="✓" label={isRtl ? 'قبول' : 'Accept'} color="#22c55e" size={64} onClick={answerCall} />
          </>
        )}

        {/* Caller ringing (waiting for callee) */}
        {callState === 'ringing' && role === 'caller' && (
          <CtrlBtn icon="✕" label={isRtl ? 'إلغاء' : 'Cancel'} color="#ef4444" size={64} onClick={() => endCall('ended')} />
        )}

        {/* Connecting or active */}
        {(callState === 'connecting' || callState === 'active') && (
          <>
            <CtrlBtn icon={muted ? '🔇' : '🎙️'} label={muted ? (isRtl ? 'إلغاء الكتم' : 'Unmute') : (isRtl ? 'كتم' : 'Mute')} color="rgba(255,255,255,0.15)" onClick={toggleMute} />
            {callType === 'video' && (
              <CtrlBtn icon={cameraOff ? '📵' : '📹'} label={cameraOff ? (isRtl ? 'تشغيل' : 'On') : (isRtl ? 'إيقاف' : 'Off')} color="rgba(255,255,255,0.15)" onClick={toggleCamera} />
            )}
            <CtrlBtn icon="✕" label={isRtl ? 'إنهاء' : 'End'} color="#ef4444" size={64} onClick={() => endCall('ended')} />
          </>
        )}
      </div>
    </div>
  );
}

function CtrlBtn({ icon, label, color, size = 52, onClick }: { icon: string; label: string; color: string; size?: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform">
      <div
        className="rounded-full flex items-center justify-center text-xl font-bold"
        style={{ width: size, height: size, background: color, color: '#fff', boxShadow: color !== 'rgba(255,255,255,0.15)' ? `0 6px 20px ${color}55` : 'none' }}
      >
        {icon}
      </div>
      <span className="text-[10px] font-semibold text-white/60">{label}</span>
    </button>
  );
}

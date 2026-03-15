import React, { useState, useEffect, useRef, useCallback } from 'react';
import Avatar from './Avatar.jsx';

const ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };

// ── Exported hook — attaches incoming call listener app-wide ──────
export function useCallManager(sock, user, users) {
  const [incomingCall, setIncomingCall] = useState(null); // { from, fromName, offer, callType }
  const [activeCall,   setActiveCall]   = useState(null); // { partnerId, partnerName, partnerUser, callType, state }
  const pcRef        = useRef(null);
  const localStream  = useRef(null);
  const localVidRef  = useRef(null);
  const remoteVidRef = useRef(null);

  // ── cleanup ──────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    localStream.current?.getTracks().forEach(t => t.stop());
    localStream.current = null;
    pcRef.current?.close();
    pcRef.current = null;
  }, []);

  // ── build PeerConnection ─────────────────────────────────────────
  const buildPC = useCallback((partnerId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) sock.emit('call:ice', { to: partnerId, candidate });
    };

    pc.ontrack = (ev) => {
      if (remoteVidRef.current) remoteVidRef.current.srcObject = ev.streams[0];
    };

    return pc;
  }, [sock]);

  // ── start outgoing call ──────────────────────────────────────────
  const startCall = useCallback(async (partner, callType) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video'
      });
      localStream.current = stream;
      if (localVidRef.current) { localVidRef.current.srcObject = stream; }

      const pc = buildPC(partner.uid);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sock.emit('call:offer', { to: partner.uid, offer, callType });

      setActiveCall({
        partnerId: partner.uid,
        partnerName: partner.name,
        partnerUser: partner,
        callType,
        state: 'calling'
      });
    } catch (err) {
      console.error('startCall error:', err);
      cleanup();
    }
  }, [sock, buildPC, cleanup]);

  // ── answer incoming call ─────────────────────────────────────────
  const answerCall = useCallback(async () => {
    if (!incomingCall) return;
    const { from, fromName, offer, callType } = incomingCall;
    const partnerUser = users.find(u => u.uid === from);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video'
      });
      localStream.current = stream;
      if (localVidRef.current) localVidRef.current.srcObject = stream;

      const pc = buildPC(from);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sock.emit('call:answer', { to: from, answer });

      setIncomingCall(null);
      setActiveCall({ partnerId: from, partnerName: fromName, partnerUser, callType, state: 'connected' });
    } catch (err) {
      console.error('answerCall error:', err);
      cleanup();
      setIncomingCall(null);
    }
  }, [incomingCall, users, buildPC, sock, cleanup]);

  // ── reject call ──────────────────────────────────────────────────
  const rejectCall = useCallback(() => {
    if (incomingCall) sock.emit('call:reject', { to: incomingCall.from });
    setIncomingCall(null);
    cleanup();
  }, [incomingCall, sock, cleanup]);

  // ── end call ────────────────────────────────────────────────────
  const endCall = useCallback(() => {
    if (activeCall) sock.emit('call:end', { to: activeCall.partnerId });
    setActiveCall(null);
    setIncomingCall(null);
    cleanup();
  }, [activeCall, sock, cleanup]);

  // ── socket events ────────────────────────────────────────────────
  useEffect(() => {
    if (!sock) return;

    sock.on('call:incoming', ({ from, fromName, offer, callType }) => {
      setIncomingCall({ from, fromName, offer, callType });
    });

    sock.on('call:answered', async ({ from, answer }) => {
      if (!pcRef.current) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        setActiveCall(prev => prev ? { ...prev, state: 'connected' } : prev);
      } catch (err) { console.error('call:answered error:', err); }
    });

    sock.on('call:ice', async ({ candidate }) => {
      try { if (pcRef.current) await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch {}
    });

    sock.on('call:rejected', () => {
      setActiveCall(null);
      cleanup();
    });

    sock.on('call:ended', () => {
      setActiveCall(null);
      setIncomingCall(null);
      cleanup();
    });

    return () => {
      sock.off('call:incoming');
      sock.off('call:answered');
      sock.off('call:ice');
      sock.off('call:rejected');
      sock.off('call:ended');
    };
  }, [sock, cleanup]);

  return {
    incomingCall, activeCall,
    startCall, answerCall, rejectCall, endCall,
    localVidRef, remoteVidRef, localStream
  };
}

// ── Incoming call popup ──────────────────────────────────────────
export function IncomingCallPopup({ call, onAnswer, onReject }) {
  if (!call) return null;
  return (
    <div className="incoming-call-popup">
      <div className="incoming-call-inner">
        <div className="call-pulse-ring"/>
        <div className="call-avatar-wrap">
          <Avatar name={call.fromName} size={56} />
        </div>
        <div className="incoming-call-name">{call.fromName}</div>
        <div className="incoming-call-type">
          {call.callType === 'video' ? '📹 Incoming video call' : '📞 Incoming audio call'}
        </div>
        <div className="incoming-call-actions">
          <button className="call-btn call-btn--reject" onClick={onReject} title="Decline">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M19 5.5C17 3.3 14.1 2 11 2S5 3.3 3 5.5L1.5 8c-.4.7-.2 1.6.5 2l2.5 1.5c.7.4 1.6.2 2-.5l.8-1.4a8.2 8.2 0 007.4 0l.8 1.4c.4.7 1.3.9 2 .5L20 10c.7-.4.9-1.3.5-2L19 5.5z" stroke="white" strokeWidth="1.6" fill="none"/></svg>
          </button>
          <button className="call-btn call-btn--accept" onClick={onAnswer} title="Accept">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M19 5.5C17 3.3 14.1 2 11 2S5 3.3 3 5.5L1.5 8c-.4.7-.2 1.6.5 2l2.5 1.5c.7.4 1.6.2 2-.5l.8-1.4a8.2 8.2 0 007.4 0l.8 1.4c.4.7 1.3.9 2 .5L20 10c.7-.4.9-1.3.5-2L19 5.5z" stroke="white" strokeWidth="1.6" fill="none"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Active call modal ────────────────────────────────────────────
export function CallModal({ call, onEnd, localVidRef, remoteVidRef, localStream }) {
  const [muted,    setMuted]    = useState(false);
  const [camOff,   setCamOff]   = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (call?.state !== 'connected') return;
    const t = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(t);
  }, [call?.state]);

  const toggleMute = () => {
    localStream.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMuted(m => !m);
  };

  const toggleCam = () => {
    localStream.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setCamOff(c => !c);
  };

  if (!call) return null;

  const fmtDur = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  return (
    <div className="call-modal-overlay">
      <div className={`call-modal ${call.callType === 'video' ? 'call-modal--video' : ''}`}>

        {call.callType === 'video' ? (
          <div className="video-area">
            <video ref={remoteVidRef} className="video-remote" autoPlay playsInline/>
            <video ref={localVidRef}  className="video-local"  autoPlay playsInline muted/>
          </div>
        ) : (
          <div className="audio-area">
            <div className="audio-avatar-ring">
              {call.state === 'connected' && <div className="audio-pulse"/>}
              <Avatar name={call.partnerName} color={call.partnerUser?.avatar_color} size={90} avatarUrl={call.partnerUser?.avatar_url}/>
            </div>
            <div className="audio-name">{call.partnerName}</div>
            <div className="audio-status">
              {call.state === 'calling' ? 'Calling...' : fmtDur(duration)}
            </div>
          </div>
        )}

        <div className="call-controls">
          <button className={`ctrl-btn ${muted ? 'ctrl-btn--active' : ''}`} onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
            {muted
              ? <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2a3 3 0 013 3v4a3 3 0 01-6 0V5a3 3 0 013-3z" stroke="white" strokeWidth="1.6"/><path d="M4 9a6 6 0 0012 0M10 15v3M7 18h6M2 2l16 16" stroke="white" strokeWidth="1.6" strokeLinecap="round"/></svg>
              : <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2a3 3 0 013 3v4a3 3 0 01-6 0V5a3 3 0 013-3z" stroke="white" strokeWidth="1.6"/><path d="M4 9a6 6 0 0012 0M10 15v3M7 18h6" stroke="white" strokeWidth="1.6" strokeLinecap="round"/></svg>
            }
          </button>

          {call.callType === 'video' && (
            <button className={`ctrl-btn ${camOff ? 'ctrl-btn--active' : ''}`} onClick={toggleCam} title={camOff ? 'Camera on' : 'Camera off'}>
              {camOff
                ? <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M2 5h11l4 3v4l-4 3H2V5zM2 2l16 16" stroke="white" strokeWidth="1.6" strokeLinecap="round"/></svg>
                : <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M2 5h11l4 3v4l-4 3H2V5z" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
            </button>
          )}

          <button className="ctrl-btn ctrl-btn--end" onClick={onEnd} title="End call">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M19 5.5C17 3.3 14.1 2 11 2S5 3.3 3 5.5L1.5 8c-.4.7-.2 1.6.5 2l2.5 1.5c.7.4 1.6.2 2-.5l.8-1.4a8.2 8.2 0 007.4 0l.8 1.4c.4.7 1.3.9 2 .5L20 10c.7-.4.9-1.3.5-2L19 5.5z" stroke="white" strokeWidth="1.8" fill="none"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

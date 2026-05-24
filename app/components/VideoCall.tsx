'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '@/app/context/SocketContext';
import { useAuth } from '@/app/context/AuthContext';
import {
  createPeerConnection,
  createOffer,
  createAnswer,
  setRemoteDescription,
  addIceCandidate,
  getLocalStream,
  addTracksToConnection,
  stopLocalStream,
  closeConnection,
} from '@/app/utils/webrtc';

interface VideoCallProps {
  callId: string;
  targetUserId: string;
  targetUserName: string;
  isIncoming: boolean;
  callType: 'audio' | 'video';
  onEnd: () => void;
}

export default function VideoCall({
  callId,
  targetUserId,
  targetUserName,
  isIncoming,
  callType: initialCallType,
  onEnd
}: VideoCallProps) {
  const { socket } = useSocket();
  const { user } = useAuth();
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenSenderRef = useRef<RTCRtpSender | null>(null);
  const ringingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [callStatus, setCallStatus] = useState<'ringing' | 'connecting' | 'connected' | 'rejected' | 'busy' | 'ended'>(
    isIncoming ? 'connecting' : 'ringing'
  );
  const [callType, setCallType] = useState<'audio' | 'video'>(initialCallType);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(initialCallType === 'audio');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);

  // Sound effects refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringOscillatorRef = useRef<OscillatorNode | null>(null);

  // Play ringing or connection tones
  const startRingingSound = (isOutgoing: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      if (isOutgoing) {
        // Double beep ring back tone
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime); // 440 Hz
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        
        const playRing = () => {
          if (ctx.state === 'closed') return;
          const now = ctx.currentTime;
          gainNode.gain.setValueAtTime(0.1, now);
          gainNode.gain.setValueAtTime(0.1, now + 0.4);
          gainNode.gain.setValueAtTime(0, now + 0.5);
          gainNode.gain.setValueAtTime(0.1, now + 0.9);
          gainNode.gain.setValueAtTime(0.1, now + 1.3);
          gainNode.gain.setValueAtTime(0, now + 1.4);
        };

        playRing();
        const intervalId = setInterval(playRing, 3000);
        (osc as any).intervalId = intervalId;
      } else {
        // High-low ring for incoming
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(480, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
        
        let high = true;
        const intervalId = setInterval(() => {
          if (ctx.state === 'closed') return;
          osc.frequency.setValueAtTime(high ? 520 : 480, ctx.currentTime);
          high = !high;
        }, 500);
        (osc as any).intervalId = intervalId;
      }

      osc.start();
      ringOscillatorRef.current = osc;
    } catch (e) {
      console.warn('AudioContext failed to start', e);
    }
  };

  const stopRingingSound = () => {
    if (ringOscillatorRef.current) {
      try {
        if ((ringOscillatorRef.current as any).intervalId) {
          clearInterval((ringOscillatorRef.current as any).intervalId);
        }
        ringOscillatorRef.current.stop();
      } catch (e) {}
      ringOscillatorRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
  };

  // Clean up and disconnect
  const handleEndCall = useCallback((isRemoteParam: any = false) => {
    const isRemote = isRemoteParam === true;
    stopRingingSound();
    
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    if (localStreamRef.current) {
      stopLocalStream(localStreamRef.current);
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      closeConnection(peerConnectionRef.current);
      peerConnectionRef.current = null;
    }

    if (!isRemote) {
      socket?.emit('call:end', { callId });
    }
    setCallStatus('ended');
    setTimeout(() => {
      onEnd();
    }, 1000);
  }, [socket, callId, onEnd]);

  // Listen for call ended event from socket throughout the call duration
  useEffect(() => {
    if (!socket) return;

    const handleRemoteCallEnded = () => {
      console.log('Received call:ended from socket');
      handleEndCall(true);
    };

    socket.on('call:ended', handleRemoteCallEnded);

    return () => {
      socket.off('call:ended', handleRemoteCallEnded);
    };
  }, [socket, handleEndCall]);

  // Ringing timeout (30 seconds)
  useEffect(() => {
    if (callStatus === 'ringing') {
      startRingingSound(true);
      ringingTimeoutRef.current = setTimeout(() => {
        handleEndCall();
      }, 30000);
    } else {
      stopRingingSound();
      if (ringingTimeoutRef.current) {
        clearTimeout(ringingTimeoutRef.current);
        ringingTimeoutRef.current = null;
      }
    }
    return () => {
      stopRingingSound();
      if (ringingTimeoutRef.current) {
        clearTimeout(ringingTimeoutRef.current);
      }
    };
  }, [callStatus]);

  // Main WebRTC Connection Logic
  useEffect(() => {
    if (!socket) return;

    // Caller initiates calling event
    if (!isIncoming && callStatus === 'ringing') {
      const callerName = user?.name || user?.email || 'Someone';
      socket.emit('call:initiate', {
        targetUserId,
        callId,
        callerName,
        callType
      });
    }

    // Handlers for call accepted / rejected from socket
    const handleCallAccepted = () => {
      setCallStatus('connecting');
    };

    const handleCallRejected = (data?: { message?: string }) => {
      setCallStatus(data?.message === 'User busy' ? 'busy' : 'rejected');
      setTimeout(() => {
        onEnd();
      }, 3000);
    };

    socket.on('call:accepted', handleCallAccepted);
    socket.on('call:rejected', handleCallRejected);

    return () => {
      socket.off('call:accepted', handleCallAccepted);
      socket.off('call:rejected', handleCallRejected);
    };
  }, [socket, callId, isIncoming, targetUserId, user]);

  // Initialize Media and Peer Connection when state becomes 'connecting'
  useEffect(() => {
    if (callStatus !== 'connecting') return;
    if (!socket) return;

    let localStream: MediaStream | null = null;
    let peerConnection: RTCPeerConnection | null = null;

    const startWebRTC = async () => {
      try {
        // Get local stream (fallback from video to audio-only if camera is blocked/unavailable)
        try {
          localStream = await getLocalStream({ audio: true, video: callType === 'video' });
        } catch (mediaError) {
          console.warn('Failed to get video media, attempting audio only...', mediaError);
          localStream = await getLocalStream({ audio: true, video: false });
          setCallType('audio');
          setIsVideoOff(true);
        }

        localStreamRef.current = localStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }

        // Create PeerConnection
        peerConnection = createPeerConnection();
        peerConnectionRef.current = peerConnection;

        // Add local tracks
        addTracksToConnection(peerConnection, localStream);

        // ICE candidate exchange
        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('webrtc:ice-candidate', {
              callId,
              candidate: event.candidate.toJSON(),
            });
          }
        };

        // Remote track handling
        peerConnection.ontrack = (event) => {
          console.log('Received remote track:', event.track.kind);
          const remoteStream = event.streams[0];
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }

          const checkRemoteVideo = () => {
            const hasVideo = remoteStream.getVideoTracks().some(track => track.enabled && track.readyState === 'live');
            setRemoteHasVideo(hasVideo);
          };

          checkRemoteVideo();
          remoteStream.onaddtrack = checkRemoteVideo;
          remoteStream.onremovetrack = checkRemoteVideo;
          
          remoteStream.getVideoTracks().forEach(track => {
            track.onmute = checkRemoteVideo;
            track.onunmute = checkRemoteVideo;
            track.onended = checkRemoteVideo;
          });
        };

        // Monitor connection state
        peerConnection.onconnectionstatechange = () => {
          console.log('Peer Connection State:', peerConnection?.connectionState);
          if (peerConnection?.connectionState === 'connected') {
            setCallStatus('connected');
          } else if (
            peerConnection?.connectionState === 'disconnected' ||
            peerConnection?.connectionState === 'failed'
          ) {
            handleEndCall();
          }
        };

        // Negotiation needed handler for adding/removing screen sharing tracks on the fly
        peerConnection.onnegotiationneeded = async () => {
          try {
            if (peerConnection?.signalingState !== 'stable') return;
            console.log('Negotiation needed. Creating offer...');
            const offer = await createOffer(peerConnection);
            socket.emit('webrtc:offer', { callId, offer });
          } catch (err) {
            console.error('Error during WebRTC renegotiation:', err);
          }
        };

        // If initiating client, create the initial offer
        if (!isIncoming) {
          const offer = await createOffer(peerConnection);
          socket.emit('webrtc:offer', { callId, offer });
        }

        // Setup socket listeners for signaling
        socket.on('webrtc:offer', async (data: { offer: RTCSessionDescriptionInit }) => {
          if (peerConnectionRef.current) {
            await setRemoteDescription(peerConnectionRef.current, data.offer);
            const answer = await createAnswer(peerConnectionRef.current);
            socket.emit('webrtc:answer', { callId, answer });
          }
        });

        socket.on('webrtc:answer', async (data: { answer: RTCSessionDescriptionInit }) => {
          if (peerConnectionRef.current) {
            await setRemoteDescription(peerConnectionRef.current, data.answer);
          }
        });

        socket.on('webrtc:ice-candidate', async (data: { candidate: any }) => {
          if (peerConnectionRef.current) {
            await addIceCandidate(peerConnectionRef.current, data.candidate);
          }
        });

      } catch (err) {
        console.error('Error establishing WebRTC call:', err);
        handleEndCall();
      }
    };

    startWebRTC();

    return () => {
      socket.off('webrtc:offer');
      socket.off('webrtc:answer');
      socket.off('webrtc:ice-candidate');
    };
  }, [callStatus]);

  // Toggle local microphone
  const toggleMute = () => {
    if (localStreamRef.current) {
      const nextMuteState = !isMuted;
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !nextMuteState;
      });
      setIsMuted(nextMuteState);
    }
  };

  // Toggle local camera
  const toggleVideo = async () => {
    if (!localStreamRef.current) return;

    // Check if we need to obtain a video track first (upgrading audio-only call)
    if (callType === 'audio' && !localStreamRef.current.getVideoTracks().length) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = stream.getVideoTracks()[0];
        
        localStreamRef.current.addTrack(videoTrack);
        
        if (peerConnectionRef.current) {
          peerConnectionRef.current.addTrack(videoTrack, localStreamRef.current);
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        setCallType('video');
        setIsVideoOff(false);
      } catch (err) {
        console.error('Failed to enable camera stream:', err);
      }
    } else {
      const nextVideoState = !isVideoOff;
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !nextVideoState;
      });
      setIsVideoOff(nextVideoState);
    }
  };

  // Toggle screen share
  const toggleScreenShare = async () => {
    if (!peerConnectionRef.current) return;

    if (!isScreenSharing) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        const screenTrack = stream.getVideoTracks()[0];

        // Handle native browser banner "Stop Sharing" button
        screenTrack.onended = () => {
          stopScreenSharing();
        };

        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');

        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        } else {
          // If in audio-only call, add track (triggers renegotiation)
          const sender = peerConnectionRef.current.addTrack(screenTrack, localStreamRef.current || new MediaStream());
          screenSenderRef.current = sender;
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        setIsScreenSharing(true);
      } catch (err) {
        console.error('Failed to start screen share:', err);
      }
    } else {
      stopScreenSharing();
    }
  };

  const stopScreenSharing = async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }

    if (!peerConnectionRef.current) return;

    const senders = peerConnectionRef.current.getSenders();
    const videoSender = senders.find(s => s.track && s.track.kind === 'video');
    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];

    if (videoSender && cameraTrack) {
      await videoSender.replaceTrack(cameraTrack);
    } else if (screenSenderRef.current) {
      peerConnectionRef.current.removeTrack(screenSenderRef.current);
      screenSenderRef.current = null;
    }

    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }

    setIsScreenSharing(false);
  };

  const targetFirstLetter = targetUserName.charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 bg-slate-950/95 z-50 flex flex-col items-center justify-center font-sans select-none backdrop-blur-md">
      
      {/* 1. Ringing Screen */}
      {callStatus === 'ringing' && (
        <div className="flex flex-col items-center justify-center space-y-8 animate-fade-in text-center p-6">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping scale-150"></div>
            <div className="absolute inset-0 bg-blue-500/30 rounded-full animate-pulse"></div>
            <div className="relative w-36 h-36 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center border-4 border-slate-800 shadow-2xl">
              <span className="text-6xl font-bold text-white tracking-wider">{targetFirstLetter}</span>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-3xl font-extrabold text-slate-100 tracking-wide">{targetUserName}</h3>
            <p className="text-lg text-blue-400 font-medium tracking-widest animate-pulse">RINGING...</p>
          </div>
          <button
            onClick={handleEndCall}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 transition-all flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:scale-110 active:scale-95 duration-200 mt-8 group"
          >
            <svg className="w-8 h-8 text-white rotate-[135deg] group-hover:rotate-[145deg] transition-transform" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
            </svg>
          </button>
        </div>
      )}

      {/* 2. Transition States */}
      {(callStatus === 'connecting' || callStatus === 'rejected' || callStatus === 'busy' || callStatus === 'ended') && (
        <div className="flex flex-col items-center justify-center space-y-6 text-center animate-pulse">
          <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center text-4xl font-semibold text-slate-400">
            {targetFirstLetter}
          </div>
          <p className="text-xl font-medium tracking-wide text-slate-300">
            {callStatus === 'connecting' && 'Establishing secure connection...'}
            {callStatus === 'rejected' && 'Call declined'}
            {callStatus === 'busy' && 'User is busy'}
            {callStatus === 'ended' && 'Call ended'}
          </p>
        </div>
      )}

      {/* 3. Active Call Connected Screen */}
      {callStatus === 'connected' && (
        <div className="relative w-full h-full flex flex-col justify-between p-6">
          
          {/* Main Display: Remote Stream */}
          <div className="absolute inset-0 w-full h-full bg-slate-900 overflow-hidden flex items-center justify-center rounded-2xl shadow-inner border border-slate-800">
            {callType === 'video' && remoteHasVideo ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover transition-opacity duration-500"
              />
            ) : (
              // Remote Avatar (Audio mode or Camera Off)
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-500/10 rounded-full animate-ping scale-110"></div>
                  <div className="w-40 h-40 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center border-4 border-slate-700 shadow-2xl">
                    <span className="text-6xl font-bold text-white">{targetFirstLetter}</span>
                  </div>
                </div>
                <div className="text-center">
                  <h4 className="text-2xl font-bold text-slate-200">{targetUserName}</h4>
                  <p className="text-sm text-indigo-400 font-medium">Voice connected</p>
                </div>
              </div>
            )}
          </div>

          {/* Picture in Picture: Local Video (Only if camera is on or screen is shared) */}
          {((callType === 'video' && !isVideoOff) || isScreenSharing) && (
            <div className="absolute top-6 right-6 w-32 h-44 md:w-44 md:h-60 rounded-xl overflow-hidden bg-slate-950 border-2 border-slate-700 shadow-2xl transition-all duration-300 z-10 hover:scale-105">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-[10px] text-white font-medium">
                {isScreenSharing ? 'Sharing screen' : 'You'}
              </div>
            </div>
          )}

          {/* Floating Top Bar (Caller Name / Call status / Encrypted Info) */}
          <div className="relative z-10 flex justify-between items-center bg-slate-900/60 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/5 shadow-lg w-full max-w-xl mx-auto">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white">
                {targetFirstLetter}
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm leading-tight">{targetUserName}</h3>
                <p className="text-[11px] text-slate-400 font-medium flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse"></span>
                  Active call
                </p>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-xs text-indigo-400 font-mono tracking-widest bg-indigo-950/40 border border-indigo-900/50 rounded-lg px-2.5 py-1">
                SECURED
              </div>
            </div>
          </div>

          {/* Floating Bottom Bar: Controls */}
          <div className="relative z-10 w-full max-w-lg mx-auto bg-slate-900/70 backdrop-blur-lg border border-white/5 rounded-3xl p-5 shadow-2xl flex items-center justify-around">
            
            {/* 1. Mute Button */}
            <button
              onClick={toggleMute}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-90 hover:scale-105 border ${
                isMuted
                  ? 'bg-red-500/20 border-red-500/30 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                  : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? (
                <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                </svg>
              ) : (
                <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>

            {/* 2. Video Toggle Button */}
            <button
              onClick={toggleVideo}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-90 hover:scale-105 border ${
                isVideoOff
                  ? 'bg-red-500/20 border-red-500/30 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                  : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
              title={isVideoOff ? 'Start Camera' : 'Stop Camera'}
            >
              {isVideoOff ? (
                <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                </svg>
              ) : (
                <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>

            {/* 3. Screen Share Button */}
            <button
              onClick={toggleScreenShare}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-90 hover:scale-105 border ${
                isScreenSharing
                  ? 'bg-green-500/20 border-green-500/30 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)]'
                  : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
              title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
            >
              <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </button>

            {/* 4. End Call Button */}
            <button
              onClick={handleEndCall}
              className="w-14 h-14 rounded-2xl bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-all duration-200 active:scale-95 hover:scale-105 shadow-[0_0_20px_rgba(220,38,38,0.4)] group"
              title="End call"
            >
              <svg className="w-7 h-7 rotate-[135deg] group-hover:rotate-[145deg] transition-transform duration-200" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useSocket } from '@/app/context/SocketContext';
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
  onEnd: () => void;
}

export default function VideoCall({
  callId,
  targetUserId,
  targetUserName,
  isIncoming,
  onEnd
}: VideoCallProps) {
  const { socket } = useSocket();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  useEffect(() => {
    const initializeCall = async () => {
      try {
        // Get local stream
        const stream = await getLocalStream();
        localStreamRef.current = stream;

        // Set local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Create peer connection
        const peerConnection = createPeerConnection();
        peerConnectionRef.current = peerConnection;

        // Add local stream to peer connection
        addTracksToConnection(peerConnection, stream);

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            socket?.emit('webrtc:ice-candidate', {
              callId,
              candidate: event.candidate.toJSON(),
            });
          }
        };

        // Handle remote stream
        peerConnection.ontrack = (event) => {
          console.log('Received remote track:', event.track.kind);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
          console.log('Connection state:', peerConnection.connectionState);
          if (peerConnection.connectionState === 'connected') {
            setCallStatus('connected');
          } else if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
            setCallStatus('disconnected');
            handleEndCall();
          }
        };

        // If incoming call, wait for offer. If outgoing, create offer
        if (!isIncoming) {
          const offer = await createOffer(peerConnection);
          socket?.emit('webrtc:offer', { callId, offer });
        }

        // Listen for remote offer
        socket?.on('webrtc:offer', async (data: { offer: RTCSessionDescriptionInit }) => {
          if (peerConnectionRef.current) {
            await setRemoteDescription(peerConnectionRef.current, data.offer);
            const answer = await createAnswer(peerConnectionRef.current);
            socket?.emit('webrtc:answer', { callId, answer });
          }
        });

        // Listen for remote answer
        socket?.on('webrtc:answer', async (data: { answer: RTCSessionDescriptionInit }) => {
          if (peerConnectionRef.current) {
            await setRemoteDescription(peerConnectionRef.current, data.answer);
          }
        });

        // Listen for ICE candidates
        socket?.on('webrtc:ice-candidate', async (data: { candidate: any }) => {
          if (peerConnectionRef.current) {
            await addIceCandidate(peerConnectionRef.current, data.candidate);
          }
        });

        // Listen for call end
        socket?.on('call:ended', () => {
          handleEndCall();
        });

      } catch (error) {
        console.error('Error initializing call:', error);
        handleEndCall();
      }
    };

    initializeCall();

    return () => {
      // Cleanup
      socket?.off('webrtc:offer');
      socket?.off('webrtc:answer');
      socket?.off('webrtc:ice-candidate');
      socket?.off('call:ended');
    };
  }, [callId, socket, isIncoming]);

  const handleEndCall = () => {
    if (peerConnectionRef.current) {
      closeConnection(peerConnectionRef.current);
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      stopLocalStream(localStreamRef.current);
      localStreamRef.current = null;
    }

    socket?.emit('call:end', { callId });
    setCallStatus('disconnected');
    onEnd();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center">
      <div className="relative w-full h-full">
        {/* Remote Video */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />

        {/* Local Video - Picture in Picture */}
        <div className="absolute bottom-4 right-4 w-32 h-32 rounded-lg overflow-hidden bg-gray-900 border-2 border-white shadow-lg">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>

        {/* Call Info */}
        <div className="absolute top-4 left-4 text-white">
          <h2 className="text-2xl font-bold">{targetUserName}</h2>
          <p className="text-sm text-gray-300">
            {callStatus === 'connecting' && 'Connecting...'}
            {callStatus === 'connected' && 'Connected'}
            {callStatus === 'disconnected' && 'Disconnected'}
          </p>
        </div>

        {/* Call Controls */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
          <button
            onClick={toggleMute}
            className={`px-6 py-2 rounded-full font-medium transition-colors ${
              isMuted
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isMuted ? '🔇 Unmute' : '🔊 Mute'}
          </button>

          <button
            onClick={toggleVideo}
            className={`px-6 py-2 rounded-full font-medium transition-colors ${
              isVideoOff
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isVideoOff ? '📹 Camera Off' : '📷 Camera On'}
          </button>

          <button
            onClick={handleEndCall}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full font-medium transition-colors"
          >
            ☎️ End Call
          </button>
        </div>
      </div>
    </div>
  );
}

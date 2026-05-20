// WebRTC utility functions

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
};

export const createPeerConnection = (): RTCPeerConnection => {
  return new RTCPeerConnection({ iceServers: ICE_SERVERS.iceServers });
};

export const createOffer = async (peerConnection: RTCPeerConnection): Promise<RTCSessionDescriptionInit> => {
  const offer = await peerConnection.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: true,
  });
  await peerConnection.setLocalDescription(offer);
  return offer;
};

export const createAnswer = async (peerConnection: RTCPeerConnection): Promise<RTCSessionDescriptionInit> => {
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  return answer;
};

export const setRemoteDescription = async (
  peerConnection: RTCPeerConnection,
  description: RTCSessionDescriptionInit
): Promise<void> => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(description));
};

export const addIceCandidate = async (
  peerConnection: RTCPeerConnection,
  candidate: any
): Promise<void> => {
  if (candidate) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }
};

export const getLocalStream = async (
  constraints: MediaStreamConstraints = { audio: true, video: true }
): Promise<MediaStream> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return stream;
  } catch (error) {
    console.error('Error getting user media:', error);
    throw error;
  }
};

export const addTracksToConnection = (
  peerConnection: RTCPeerConnection,
  stream: MediaStream
): void => {
  stream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, stream);
  });
};

export const stopLocalStream = (stream: MediaStream): void => {
  stream.getTracks().forEach((track) => {
    track.stop();
  });
};

export const closeConnection = (peerConnection: RTCPeerConnection): void => {
  peerConnection.close();
};

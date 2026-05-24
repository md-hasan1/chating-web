import { Server, Socket } from 'socket.io';
import { activeUsers, callRooms } from './state';

export const registerCallHandlers = (io: Server, socket: Socket) => {
  // Video call events
  socket.on('call:initiate', (data: { targetUserId: string; callId: string; callerName: string; callType: 'audio' | 'video' }) => {
    const targetSocketId = activeUsers.get(data.targetUserId);
    if (targetSocketId) {
      const roomId = `call:${data.callId}`;
      // Join caller
      socket.join(roomId);
      // Join receiver if connected
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.join(roomId);
      }

      io.to(targetSocketId).emit('call:incoming', {
        callId: data.callId,
        callerId: socket.data.userId,
        callerName: data.callerName,
        callerSocketId: socket.id,
        callType: data.callType
      });
    } else {
      socket.emit('call:rejected', { message: 'User not available' });
    }
  });

  // Call accepted
  socket.on('call:accepted', (data: { callId: string; targetSocketId: string }) => {
    io.to(data.targetSocketId).emit('call:accepted', { callId: data.callId });
    
    // Create call room
    const roomId = `call:${data.callId}`;
    socket.join(roomId);
    callRooms.set(roomId, new Set([socket.id, data.targetSocketId]));
  });

  // Call rejected
  socket.on('call:rejected', (data: { callId: string; targetSocketId: string }) => {
    io.to(data.targetSocketId).emit('call:rejected', { callId: data.callId });
    const roomId = `call:${data.callId}`;
    socket.leave(roomId);
    const targetSocket = io.sockets.sockets.get(data.targetSocketId);
    if (targetSocket) {
      targetSocket.leave(roomId);
    }
  });

  // WebRTC signaling - offer
  socket.on('webrtc:offer', (data: { callId: string; offer: any }) => {
    const roomId = `call:${data.callId}`;
    socket.to(roomId).emit('webrtc:offer', { offer: data.offer });
  });

  // WebRTC signaling - answer
  socket.on('webrtc:answer', (data: { callId: string; answer: any }) => {
    const roomId = `call:${data.callId}`;
    socket.to(roomId).emit('webrtc:answer', { answer: data.answer });
  });

  // WebRTC ICE candidates
  socket.on('webrtc:ice-candidate', (data: { callId: string; candidate: any }) => {
    const roomId = `call:${data.callId}`;
    socket.to(roomId).emit('webrtc:ice-candidate', { candidate: data.candidate });
  });

  // Call ended
  socket.on('call:end', (data: { callId: string }) => {
    const roomId = `call:${data.callId}`;
    io.to(roomId).emit('call:ended');
    
    // Clean up room
    callRooms.delete(roomId);
    
    const room = io.sockets.adapter.rooms.get(roomId);
    if (room) {
      const socketIds = Array.from(room);
      socketIds.forEach(socketId => {
        const s = io.sockets.sockets.get(socketId);
        s?.leave(roomId);
      });
    }
  });
};

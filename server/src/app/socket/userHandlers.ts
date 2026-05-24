import { Server, Socket } from 'socket.io';
import { prisma } from '../../shared/prisma';
import { activeUsers, callRooms, visibleUsers } from './state';

export const registerUserHandlers = (io: Server, socket: Socket) => {
  // Register user
  socket.on('user:login', async (userId: string) => {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      console.warn(`[Socket] user:login received invalid userId: ${userId}`);
      return;
    }

    activeUsers.set(userId, socket.id);
    visibleUsers.add(userId);
    socket.data.userId = userId;
    
    // Update lastActiveAt
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { lastActiveAt: new Date() }
      });

      // Mark pending messages as delivered
      const now = new Date();
      const updatedMessages = await prisma.message.findMany({
        where: {
          chat: { participantIds: { has: userId } },
          userId: { not: userId },
          deliveredAt: null
        },
        select: { id: true, chatId: true, userId: true }
      });

      if (updatedMessages.length > 0) {
        await prisma.message.updateMany({
          where: { id: { in: updatedMessages.map(m => m.id) } },
          data: { deliveredAt: now }
        });

        // Notify senders
        const notifications = new Map<string, { id: string, chatId: string }[]>();
        updatedMessages.forEach(msg => {
          if (!notifications.has(msg.userId)) notifications.set(msg.userId, []);
          notifications.get(msg.userId)!.push(msg);
        });

        notifications.forEach((msgs, senderId) => {
          const senderSocketId = activeUsers.get(senderId);
          if (senderSocketId) {
            msgs.forEach(msg => {
              io.to(senderSocketId).emit('message:status:update', {
                messageId: msg.id,
                chatId: msg.chatId,
                deliveredAt: now
              });
            });
          }
        });
      }
    } catch (error) {
      console.error('Error on user login:', error);
    }
    
    io.emit('user:online', { userId });
    socket.emit('user:online:list', { userIds: Array.from(visibleUsers) });
  });

  socket.on('user:active', async () => {
    const userId = socket.data.userId;
    if (userId) {
      visibleUsers.add(userId);
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { lastActiveAt: new Date() }
        });
      } catch (error) {
        console.error('Error updating lastActiveAt:', error);
      }
      io.emit('user:online', { userId });
    }
  });

  socket.on('user:inactive', async () => {
    const userId = socket.data.userId;
    if (userId) {
      visibleUsers.delete(userId);
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { lastActiveAt: new Date() }
        });
      } catch (error) {
        console.error('Error updating lastActiveAt:', error);
      }
      io.emit('user:offline', { userId });
    }
  });

  // Disconnect
  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Find and end any active calls this socket was a part of
    for (const [roomId, socketIds] of callRooms.entries()) {
      if (socketIds.has(socket.id)) {
        io.to(roomId).emit('call:ended');
        callRooms.delete(roomId);
        
        const room = io.sockets.adapter.rooms.get(roomId);
        if (room) {
          const ids = Array.from(room);
          ids.forEach(id => {
            const s = io.sockets.sockets.get(id);
            s?.leave(roomId);
          });
        }
      }
    }

    const userId = socket.data.userId;
    
    if (userId) {
      visibleUsers.delete(userId);
      
      // Remove from active users only if this socket is the active one for the user
      if (activeUsers.get(userId) === socket.id) {
        activeUsers.delete(userId);
      }
      
      io.emit('user:offline', { userId });
      
      // Update exact leave time
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { lastActiveAt: new Date() }
        });
      } catch (error) {
        console.error('Error updating lastActiveAt on disconnect:', error);
      }
    }
  });
};

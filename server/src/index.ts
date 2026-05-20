import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth';
import chatRoutes from './routes/chat';
import messageRoutes from './routes/message';
import userRoutes from './routes/users';
import friendRoutes from './routes/friend';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 5000;
export const prisma = new PrismaClient();

// Create HTTP server with Socket.IO
const httpServer = createServer(app);
export const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/message', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friend', friendRoutes);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Socket.IO connection handling
const activeUsers = new Map<string, string>(); // userId -> socketId
const callRooms = new Map<string, Set<string>>(); // roomId -> Set<socketIds>
const visibleUsers = new Set<string>(); // userIds of those actively focusing the tab

// Export activeUsers so routes can use it for real-time notifications
export { activeUsers };

io.on('connection', (socket: Socket) => {
  console.log(`User connected: ${socket.id}`);

  // Register user
  socket.on('user:login', async (userId: string) => {
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

  // Chat message event
  socket.on('message:send', async (data: { chatId: string; content: string; clientMessageId?: string }) => {
    try {
      const senderId = socket.data.userId as string | undefined;

      if (!senderId) {
        socket.emit('error', { message: 'User not authenticated' });
        return;
      }

      // Update lastActiveAt
      try {
        await prisma.user.update({
          where: { id: senderId },
          data: { lastActiveAt: new Date() }
        });
      } catch (error) {
        console.error('Error updating lastActiveAt:', error);
      }

      const chat = await prisma.chat.findFirst({
        where: {
          id: data.chatId,
          OR: [
            { userId: senderId },
            { participantIds: { has: senderId } }
          ]
        }
      });

      if (!chat) {
        socket.emit('error', { message: 'Chat not found' });
        return;
      }

      const message = await prisma.message.create({
        data: {
          content: data.content,
          chatId: data.chatId,
          userId: senderId,
          role: 'user'
        }
      });

      // Remove all participants from hiddenForUserIds so the chat becomes visible to them again
      const participantIds = new Set([senderId, ...(chat.participantIds || [])]);
      
      const updatedChatInDb = await prisma.chat.update({
        where: { id: data.chatId },
        data: {
          hiddenForUserIds: {
            set: chat.hiddenForUserIds.filter(id => !participantIds.has(id))
          }
        },
        include: {
          messages: {
            where: {
              deletedForEveryone: false,
              NOT: { deletedForUserIds: { has: senderId } }
            }
          }
        }
      });

      const updatedChat = {
        id: updatedChatInDb.id,
        title: updatedChatInDb.title,
        createdAt: updatedChatInDb.createdAt,
        updatedAt: updatedChatInDb.updatedAt,
        isDirect: updatedChatInDb.isDirect,
        participantIds: updatedChatInDb.participantIds,
        messages: updatedChatInDb.messages || []
      };

      // Broadcast message directly to all online participants so the first message can create the list entry.
      participantIds.forEach(participantId => {
        const participantSocketId = activeUsers.get(participantId);
        if (participantSocketId) {
          io.to(participantSocketId).emit('message:received', {
            message: {
              ...message,
              clientMessageId: data.clientMessageId
            },
            chat: updatedChat,
          });
        }
      });

      // Also emit a chat:added event to ensure chat appears in the sender's list
      const senderSocketId = activeUsers.get(senderId);
      if (senderSocketId) {
        io.to(senderSocketId).emit('chat:added', updatedChat);
      }
    } catch (error) {
      console.error('Error saving message:', error);
      socket.emit('error', { message: 'Failed to save message' });
    }
  });

  // Join chat room
  socket.on('chat:join', (chatId: string) => {
    socket.join(`chat:${chatId}`);
    console.log(`User ${socket.id} joined chat ${chatId}`);
  });

  // Leave chat room
  socket.on('chat:leave', (chatId: string) => {
    socket.leave(`chat:${chatId}`);
  });

  // Message Delivered
  socket.on('message:delivered', async (data: { messageId: string; chatId: string }) => {
    try {
      const userId = socket.data.userId;
      if (!userId) return;

      const message = await prisma.message.update({
        where: { id: data.messageId },
        data: { deliveredAt: new Date() }
      });

      const senderSocketId = activeUsers.get(message.userId);
      if (senderSocketId) {
        io.to(senderSocketId).emit('message:status:update', {
          messageId: data.messageId,
          chatId: data.chatId,
          deliveredAt: message.deliveredAt
        });
      }
    } catch (err) {
      console.error('Error updating delivered status:', err);
    }
  });

  // Message Seen
  socket.on('message:seen', async (data: { chatId: string }) => {
    try {
      const userId = socket.data.userId;
      if (!userId) return;

      const now = new Date();
      // Update all unseen messages in this chat where the sender is not the current user
      await prisma.message.updateMany({
        where: {
          chatId: data.chatId,
          userId: { not: userId },
          seenAt: null
        },
        data: { seenAt: now, deliveredAt: now } // If seen, it's implicitly delivered
      });

      const chat = await prisma.chat.findUnique({
        where: { id: data.chatId },
        select: { participantIds: true }
      });

      if (chat) {
        chat.participantIds.forEach(participantId => {
          if (participantId !== userId) {
            const participantSocketId = activeUsers.get(participantId);
            if (participantSocketId) {
              io.to(participantSocketId).emit('message:status:update', {
                chatId: data.chatId,
                seenAt: now
              });
            }
          }
        });
      }
    } catch (err) {
      console.error('Error updating seen status:', err);
    }
  });

  // Video call events
  socket.on('call:initiate', (data: { targetUserId: string; callId: string; callerName: string }) => {
    const targetSocketId = activeUsers.get(data.targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('call:incoming', {
        callId: data.callId,
        callerId: socket.data.userId,
        callerName: data.callerName,
        callerSocketId: socket.id
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
    socket.leave(roomId);
  });

  // Friend request socket events
  socket.on('friend:request:send', async (data: { targetUserId: string }) => {
    try {
      const senderId = socket.data.userId;
      console.log('friend:request:send event received. senderId:', senderId, 'targetUserId:', data?.targetUserId);
      if (!senderId) {
        console.warn('friend:request:send: Sender not authenticated');
        return socket.emit('friend:request:error', { message: 'Not authenticated' });
      }

      const { targetUserId } = data;
      if (senderId === targetUserId) {
        console.warn('friend:request:send: Attempted to add self');
        return socket.emit('friend:request:error', { message: 'Cannot add yourself' });
      }

      // Check if request already exists
      const existing = await prisma.friendRequest.findFirst({
        where: {
          OR: [
            { senderId, receiverId: targetUserId },
            { senderId: targetUserId, receiverId: senderId }
          ]
        }
      });

      if (existing) {
        if (existing.status === 'accepted') {
          return socket.emit('friend:request:error', { message: 'Already friends' });
        }
        if (existing.status === 'pending') {
          return socket.emit('friend:request:error', { message: 'Request already pending' });
        }
        // If rejected, allow resending by deleting the old request
        await prisma.friendRequest.delete({ where: { id: existing.id } });
      }

      const request = await prisma.friendRequest.create({
        data: {
          senderId,
          receiverId: targetUserId,
          status: 'pending'
        },
        include: {
          sender: { select: { id: true, name: true, email: true, image: true } },
          receiver: { select: { id: true, name: true, email: true, image: true } }
        }
      });

      // Emit to receiver
      const receiverSocketId = activeUsers.get(targetUserId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('friend:request:received', request);
      }

      // Emit back to sender
      socket.emit('friend:request:sent', request);
    } catch (err) {
      console.error('Error sending friend request via socket:', err);
      socket.emit('error', { message: 'Failed to send request' });
    }
  });

  socket.on('friend:request:accept', async (data: { requestId: string }) => {
    try {
      const receiverId = socket.data.userId;
      if (!receiverId) return socket.emit('error', { message: 'Not authenticated' });

      const { requestId } = data;
      const request = await prisma.friendRequest.findUnique({
        where: { id: requestId }
      });

      if (!request || request.receiverId !== receiverId) {
        return socket.emit('error', { message: 'Request not found' });
      }

      const updated = await prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: 'accepted' },
        include: {
          sender: { select: { id: true, name: true, email: true, image: true } },
          receiver: { select: { id: true, name: true, email: true, image: true } }
        }
      });

      // Emit to sender
      const senderSocketId = activeUsers.get(updated.senderId);
      if (senderSocketId) {
        io.to(senderSocketId).emit('friend:accepted', updated);
      }

      // Emit to receiver (this client)
      socket.emit('friend:accepted', updated);
    } catch (err) {
      console.error('Error accepting friend request via socket:', err);
      socket.emit('error', { message: 'Failed to accept request' });
    }
  });

  socket.on('friend:request:reject', async (data: { requestId: string }) => {
    try {
      const receiverId = socket.data.userId;
      console.log('friend:request:reject socket event received. user:', receiverId, 'data:', data);
      if (!receiverId) return socket.emit('error', { message: 'Not authenticated' });

      const { requestId } = data;
      const request = await prisma.friendRequest.findUnique({
        where: { id: requestId }
      });
      console.log('Fetched friendRequest from DB:', request);

      if (!request || request.receiverId !== receiverId) {
        console.log('Reject auth check failed. Request receiverId:', request?.receiverId, 'Socket userId:', receiverId);
        return socket.emit('error', { message: 'Request not found' });
      }

      const updated = await prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: 'rejected' },
        include: {
          sender: { select: { id: true, name: true, email: true, image: true } },
          receiver: { select: { id: true, name: true, email: true, image: true } }
        }
      });
      console.log('Updated friendRequest status to rejected in DB:', updated);

      // Emit to sender
      const senderSocketId = activeUsers.get(updated.senderId);
      console.log('Sender socket ID:', senderSocketId);
      if (senderSocketId) {
        io.to(senderSocketId).emit('friend:rejected', updated);
      }

      // Emit to receiver (this client)
      socket.emit('friend:rejected', updated);
    } catch (err) {
      console.error('Error rejecting friend request via socket:', err);
      socket.emit('error', { message: 'Failed to reject request' });
    }
  });

  // Disconnect
  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.id}`);
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
});

httpServer.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`Socket.IO server ready for connections`);
});

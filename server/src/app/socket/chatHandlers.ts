import { Server, Socket } from 'socket.io';
import { prisma } from '../../shared/prisma';
import { activeUsers } from './state';

export const registerChatHandlers = (io: Server, socket: Socket) => {
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

  // Typing indicator events
  socket.on('typing:start', (data: { chatId: string; userName?: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId || !data?.chatId) return;

    socket.to(`chat:${data.chatId}`).emit('typing:started', {
      chatId: data.chatId,
      userId,
      userName: data.userName,
    });
  });

  socket.on('typing:stop', (data: { chatId: string }) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId || !data?.chatId) return;

    socket.to(`chat:${data.chatId}`).emit('typing:stopped', {
      chatId: data.chatId,
      userId,
    });
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
};

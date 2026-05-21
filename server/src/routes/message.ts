import express, { Request, Response } from 'express';
import { prisma, io } from '../index';
import { authMiddleware } from '../middleware/auth';
import { fileUploader } from '../middleware/fileUploader';

const router = express.Router();

const visibleMessageFilter = (userId: string) => ({
  deletedForEveryone: false,
  NOT: {
    deletedForUserIds: {
      has: userId
    }
  }
});

// Add message to chat
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { content, chatId, role } = req.body;
    const userId = req.userId;

    if (!content || !chatId) {
      return res.status(400).json({ error: 'Content and chatId are required' });
    }

    // Verify chat belongs to user
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        OR: [
          { userId: userId! },
          { participantIds: { has: userId! } }
        ]
      }
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const message = await prisma.message.create({
      data: {
        content,
        chatId,
        userId: userId!,
        role: role || 'user'
      }
    });

    // Update lastActiveAt for sender
    await prisma.user.update({
      where: { id: userId! },
      data: { lastActiveAt: new Date() }
    });

    const participantIds = new Set([userId!, ...(chat.participantIds || [])]);

    // Update chat updatedAt and unhide chat for participants
    const updatedChatInDb = await prisma.chat.update({
      where: { id: chatId },
      data: { 
        updatedAt: new Date(),
        hiddenForUserIds: {
          set: chat.hiddenForUserIds.filter(id => !participantIds.has(id))
        }
      },
      include: {
        messages: {
          where: {
            deletedForEveryone: false,
            NOT: { deletedForUserIds: { has: userId! } }
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

    // Broadcast message to all online participants
    participantIds.forEach(participantId => {
      const participantSocketId = require('../index').activeUsers.get(participantId);
      if (participantSocketId) {
        io.to(participantSocketId).emit('message:received', {
          message: message,
          chat: updatedChat,
        });
      }
    });

    res.status(201).json(message);
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

// Upload a file (image, video, etc.) to a chat
router.post('/upload', authMiddleware, fileUploader.uploadFile, async (req: Request, res: Response) => {
  try {
    const { chatId } = req.body;
    const userId = req.userId;
    const file = req.file;

    if (!chatId) {
      return res.status(400).json({ error: 'chatId is required' });
    }

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Verify chat belongs to user
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        OR: [
          { userId: userId! },
          { participantIds: { has: userId! } }
        ]
      }
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Upload to Cloudinary
    const uploadResult = await fileUploader.uploadToCloudinary(file);

    // Determine file type
    let fileType = 'file';
    if (file.mimetype.startsWith('image/')) {
      fileType = 'image';
    } else if (file.mimetype.startsWith('video/')) {
      fileType = 'video';
    }

    const message = await prisma.message.create({
      data: {
        content: file.originalname,
        chatId,
        userId: userId!,
        role: 'user',
        fileUrl: uploadResult.Location,
        fileType
      }
    });

    // Update lastActiveAt for sender
    await prisma.user.update({
      where: { id: userId! },
      data: { lastActiveAt: new Date() }
    });

    const participantIds = new Set([userId!, ...(chat.participantIds || [])]);

    // Update chat updatedAt and unhide chat for participants
    const updatedChatInDb = await prisma.chat.update({
      where: { id: chatId },
      data: { 
        updatedAt: new Date(),
        hiddenForUserIds: {
          set: chat.hiddenForUserIds.filter(id => !participantIds.has(id))
        }
      },
      include: {
        messages: {
          where: {
            deletedForEveryone: false,
            NOT: { deletedForUserIds: { has: userId! } }
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

    // Broadcast message to all online participants
    participantIds.forEach(participantId => {
      const participantSocketId = require('../index').activeUsers.get(participantId);
      if (participantSocketId) {
        io.to(participantSocketId).emit('message:received', {
          message: {
            ...message,
            clientMessageId: req.body.clientMessageId
          },
          chat: updatedChat,
        });
      }
    });

    res.status(201).json(message);
  } catch (error) {
    console.error('Error uploading file message:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Get messages for a chat
router.get('/:chatId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId;

    // Verify chat belongs to user
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        OR: [
          { userId: userId! },
          { participantIds: { has: userId! } }
        ]
      }
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const messages = await prisma.message.findMany({
      where: {
        chatId,
        ...visibleMessageFilter(userId!)
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Delete a message for me or for everyone
router.delete('/:messageId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const scope = typeof req.query.scope === 'string' ? req.query.scope : 'me';
    const userId = req.userId;

    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        chat: {
          OR: [
            { userId: userId! },
            { participantIds: { has: userId! } }
          ]
        }
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (scope === 'everyone') {
      if (message.userId !== userId) {
        return res.status(403).json({ error: 'You can only delete your own message for everyone' });
      }

      const updated = await prisma.message.update({
        where: { id: messageId },
        data: {
          deletedForEveryone: true
        }
      });

      io.to(`chat:${message.chatId}`).emit('message:deleted', {
        messageId: updated.id,
        chatId: updated.chatId,
        scope: 'everyone'
      });

      return res.json({ message: 'Message deleted for everyone' });
    }

    if (!message.deletedForUserIds.includes(userId!)) {
      await prisma.message.update({
        where: { id: messageId },
        data: {
          deletedForUserIds: {
            set: [...message.deletedForUserIds, userId!]
          }
        }
      });
    }

    return res.json({ message: 'Message deleted for me' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

export default router;

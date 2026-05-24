import { Request, Response } from 'express';
import { messageService } from './service';
import { fileUploader } from '../../middlewares/fileUploader';
import { io, activeUsers } from '../../index';

export const messageController = {
  createMessage: async (req: Request & { userId?: string }, res: Response) => {
    try {
      const { content, chatId, role } = req.body;
      const userId = req.userId!;

      if (!content || !chatId) {
        return res.status(400).json({ error: 'Content and chatId are required' });
      }

      // Verify chat belongs to user
      const chat = await messageService.getChatAndVerifyUser(chatId, userId);
      if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
      }

      const result = await messageService.createMessage(userId, chatId, content, role);

      // Broadcast message to all online participants
      result.participantIds.forEach(participantId => {
        const participantSocketId = activeUsers.get(participantId);
        if (participantSocketId) {
          io.to(participantSocketId).emit('message:received', {
            message: result.message,
            chat: result.updatedChat,
          });
        }
      });

      res.status(201).json(result.message);
    } catch (error) {
      console.error('Error creating message:', error);
      res.status(500).json({ error: 'Failed to create message' });
    }
  },

  uploadFileMessage: async (req: Request & { userId?: string }, res: Response) => {
    try {
      const { chatId } = req.body;
      const userId = req.userId!;
      const file = req.file;

      if (!chatId) {
        return res.status(400).json({ error: 'chatId is required' });
      }

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const processedFile = await fileUploader.prepareMediaForUpload(file);

      // Verify chat belongs to user
      const chat = await messageService.getChatAndVerifyUser(chatId, userId);
      if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
      }

      const uploadResult = await fileUploader.uploadMedia(processedFile);

      // Determine file type
      let fileType = 'file';
      if (processedFile.mimetype.startsWith('image/')) {
        fileType = 'image';
      } else if (processedFile.mimetype.startsWith('video/')) {
        fileType = 'video';
      }

      const result = await messageService.createFileMessage(
        userId,
        chatId,
        processedFile.originalname,
        uploadResult.Location,
        fileType
      );

      // Broadcast message to all online participants
      result.participantIds.forEach(participantId => {
        const participantSocketId = activeUsers.get(participantId);
        if (participantSocketId) {
          io.to(participantSocketId).emit('message:received', {
            message: {
              ...result.message,
              clientMessageId: req.body.clientMessageId,
            },
            chat: result.updatedChat,
          });
        }
      });

      res.status(201).json(result.message);
    } catch (error) {
      console.error('Error uploading file message:', error);

      const err = error as { message?: string; http_code?: number };
      const message = err?.message || 'Failed to upload file';
      const isConfigError =
        message.includes('not configured') || message.includes('No file storage provider configured');
      const isClientUploadError =
        err?.http_code === 400 ||
        /empty file|selected file is empty|unsupported|invalid|file too large/i.test(message);

      const statusCode = isConfigError ? 503 : isClientUploadError ? 400 : 500;
      res.status(statusCode).json({ error: message });
    }
  },

  getMessages: async (req: Request & { userId?: string }, res: Response) => {
    try {
      const { chatId } = req.params;
      const userId = req.userId!;

      // Verify chat belongs to user
      const chat = await messageService.getChatAndVerifyUser(chatId, userId);
      if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
      }

      const messages = await messageService.getMessages(chatId, userId);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  },

  deleteMessage: async (req: Request & { userId?: string }, res: Response) => {
    try {
      const { messageId } = req.params;
      const scope = typeof req.query.scope === 'string' ? req.query.scope : 'me';
      const userId = req.userId!;

      const message = await messageService.getMessageById(messageId, userId);
      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      if (scope === 'everyone') {
        if (message.userId !== userId) {
          return res.status(403).json({ error: 'You can only delete your own message for everyone' });
        }

        const updated = await messageService.deleteForEveryone(messageId);

        io.to(`chat:${message.chatId}`).emit('message:deleted', {
          messageId: updated.id,
          chatId: updated.chatId,
          scope: 'everyone',
        });

        return res.json({ message: 'Message deleted for everyone' });
      }

      await messageService.deleteForMe(messageId, userId, message.deletedForUserIds);
      return res.json({ message: 'Message deleted for me' });
    } catch (error) {
      console.error('Error deleting message:', error);
      res.status(500).json({ error: 'Failed to delete message' });
    }
  },
};

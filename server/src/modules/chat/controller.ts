import { Request, Response } from 'express';
import { chatService } from './service';
import { prisma } from '../../shared/prisma';

export const chatController = {
  createChat: async (req: Request & { userId?: string }, res: Response) => {
    try {
      const { title } = req.body;
      const userId = req.userId!;

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      const chat = await chatService.createChat(userId, title);
      res.status(201).json(chat);
    } catch (error) {
      console.error('Error creating chat:', error);
      res.status(500).json({ error: 'Failed to create chat' });
    }
  },

  createDirectChat: async (req: Request & { userId?: string }, res: Response) => {
    try {
      const { targetUserId } = req.body;
      const userId = req.userId!;

      if (!targetUserId) {
        return res.status(400).json({ error: 'targetUserId is required' });
      }

      if (targetUserId === userId) {
        return res.status(400).json({ error: 'Cannot start a direct chat with yourself' });
      }

      // Check if target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
      });

      if (!targetUser) {
        return res.status(404).json({ error: 'Target user not found' });
      }

      // Verify the users are friends
      const friendship = await chatService.findFriendship(userId, targetUserId);
      if (!friendship) {
        return res.status(403).json({ error: 'You must be friends to start a direct chat' });
      }

      const existingChats = await chatService.findDirectChat(userId, targetUserId);
      if (existingChats.length > 0) {
        return res.json(existingChats[0]);
      }

      const chat = await chatService.createDirectChat(userId, targetUserId);
      res.status(201).json(chat);
    } catch (error) {
      console.error('Error creating direct chat:', error);
      res.status(500).json({ error: 'Failed to create direct chat' });
    }
  },

  getChats: async (req: Request & { userId?: string }, res: Response) => {
    try {
      const userId = req.userId!;
      const chats = await chatService.getChats(userId);
      res.json(chats);
    } catch (error) {
      console.error('Error fetching chats:', error);
      res.status(500).json({ error: 'Failed to fetch chats' });
    }
  },

  getChatById: async (req: Request & { userId?: string }, res: Response) => {
    try {
      const { chatId } = req.params;
      const userId = req.userId!;

      const chat = await chatService.getChatById(chatId, userId);
      if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
      }

      res.json(chat);
    } catch (error) {
      console.error('Error fetching chat:', error);
      res.status(500).json({ error: 'Failed to fetch chat' });
    }
  },

  deleteChat: async (req: Request & { userId?: string }, res: Response) => {
    try {
      const { chatId } = req.params;
      const userId = req.userId!;

      const chat = await chatService.getChatByIdSimple(chatId, userId);
      if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
      }

      await chatService.hideChatAndMessages(chatId, userId, chat.hiddenForUserIds);
      res.json({ message: 'Chat deleted' });
    } catch (error) {
      console.error('Error deleting chat:', error);
      res.status(500).json({ error: 'Failed to delete chat' });
    }
  },
};

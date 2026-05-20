import express, { Request, Response } from 'express';
import { prisma, io, activeUsers } from '../index';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

const visibleMessageFilter = (userId: string) => ({
  deletedForEveryone: false,
  NOT: {
    deletedForUserIds: {
      has: userId
    }
  }
});

const visibleChatFilter = (userId: string) => ({
  OR: [
    { userId },
    { participantIds: { has: userId } }
  ],
  NOT: {
    hiddenForUserIds: {
      has: userId
    }
  }
});

// Create a new chat
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { title } = req.body;
    const userId = req.userId;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const chat = await prisma.chat.create({
      data: {
        title,
        userId: userId!,
        participantIds: [userId!],
        isDirect: false
      },
      include: {
        messages: true
      }
    });

    res.status(201).json(chat);
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

// Create or get a direct chat
router.post('/direct', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { targetUserId } = req.body;
    const userId = req.userId;

    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId is required' });
    }

    if (targetUserId === userId) {
      return res.status(400).json({ error: 'Cannot start a direct chat with yourself' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    // Verify the users are friends
    const friendship = await prisma.friendRequest.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { senderId: userId!, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: userId! }
        ]
      }
    });

    if (!friendship) {
      return res.status(403).json({ error: 'You must be friends to start a direct chat' });
    }

    const existingChats = await prisma.chat.findMany({
      where: {
        isDirect: true,
        participantIds: {
          hasEvery: [userId!, targetUserId]
        }
      },
      include: {
        messages: {
          where: visibleMessageFilter(userId!),
          orderBy: {
            createdAt: 'asc'
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    if (existingChats.length > 0) {
      return res.json(existingChats[0]);
    }

    const title = 'Direct chat';

    const chat = await prisma.chat.create({
      data: {
        title,
        userId: userId!,
        isDirect: true,
        participantIds: [userId!, targetUserId]
      },
      include: {
        messages: true
      }
    });

    res.status(201).json(chat);
  } catch (error) {
    console.error('Error creating direct chat:', error);
    res.status(500).json({ error: 'Failed to create direct chat' });
  }
});

// Get all chats for user
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    const chats = await prisma.chat.findMany({
      where: visibleChatFilter(userId!),
      include: {
        messages: {
          where: visibleMessageFilter(userId!),
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    res.json(chats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// Get single chat with messages
router.get('/:chatId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId;

    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        ...visibleChatFilter(userId!)
      },
      include: {
        messages: {
          where: visibleMessageFilter(userId!),
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json(chat);
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

// Delete chat
router.delete('/:chatId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const userId = req.userId;

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

    if (!chat.hiddenForUserIds.includes(userId!)) {
      await prisma.chat.update({
        where: { id: chatId },
        data: {
          hiddenForUserIds: {
            set: [...chat.hiddenForUserIds, userId!]
          }
        }
      });
      
      // Also mark all existing messages as deleted for this user so they don't reappear if the chat is unhidden later
      const messages = await prisma.message.findMany({
        where: { chatId }
      });
      
      for (const msg of messages) {
        if (!msg.deletedForUserIds.includes(userId!)) {
          await prisma.message.update({
            where: { id: msg.id },
            data: {
              deletedForUserIds: {
                set: [...msg.deletedForUserIds, userId!]
              }
            }
          });
        }
      }
    }

    res.json({ message: 'Chat deleted' });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

export default router;

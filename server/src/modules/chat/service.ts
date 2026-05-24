import { prisma } from '../../shared/prisma';

const visibleMessageFilter = (userId: string) => ({
  deletedForEveryone: false,
  NOT: {
    deletedForUserIds: {
      has: userId,
    },
  },
});

const visibleChatFilter = (userId: string) => ({
  OR: [
    { userId },
    { participantIds: { has: userId } },
  ],
  NOT: {
    hiddenForUserIds: {
      has: userId,
    },
  },
});

export const chatService = {
  createChat: async (userId: string, title: string) => {
    return prisma.chat.create({
      data: {
        title,
        userId,
        participantIds: [userId],
        isDirect: false,
      },
      include: {
        messages: true,
      },
    });
  },

  findDirectChat: async (userId: string, targetUserId: string) => {
    return prisma.chat.findMany({
      where: {
        isDirect: true,
        participantIds: {
          hasEvery: [userId, targetUserId],
        },
      },
      include: {
        messages: {
          where: visibleMessageFilter(userId),
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  },

  createDirectChat: async (userId: string, targetUserId: string) => {
    return prisma.chat.create({
      data: {
        title: 'Direct chat',
        userId,
        isDirect: true,
        participantIds: [userId, targetUserId],
      },
      include: {
        messages: true,
      },
    });
  },

  findFriendship: async (userId: string, targetUserId: string) => {
    return prisma.friendRequest.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { senderId: userId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: userId },
        ],
      },
    });
  },

  getChats: async (userId: string) => {
    return prisma.chat.findMany({
      where: visibleChatFilter(userId),
      include: {
        messages: {
          where: visibleMessageFilter(userId),
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  },

  getChatById: async (chatId: string, userId: string) => {
    return prisma.chat.findFirst({
      where: {
        id: chatId,
        ...visibleChatFilter(userId),
      },
      include: {
        messages: {
          where: visibleMessageFilter(userId),
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
  },

  getChatByIdSimple: async (chatId: string, userId: string) => {
    return prisma.chat.findFirst({
      where: {
        id: chatId,
        OR: [
          { userId },
          { participantIds: { has: userId } },
        ],
      },
    });
  },

  hideChatAndMessages: async (chatId: string, userId: string, hiddenForUserIds: string[]) => {
    if (!hiddenForUserIds.includes(userId)) {
      await prisma.chat.update({
        where: { id: chatId },
        data: {
          hiddenForUserIds: {
            set: [...hiddenForUserIds, userId],
          },
        },
      });

      // Mark all existing messages as deleted for this user
      const messages = await prisma.message.findMany({
        where: { chatId },
      });

      for (const msg of messages) {
        if (!msg.deletedForUserIds.includes(userId)) {
          await prisma.message.update({
            where: { id: msg.id },
            data: {
              deletedForUserIds: {
                set: [...msg.deletedForUserIds, userId],
              },
            },
          });
        }
      }
    }
  },
};

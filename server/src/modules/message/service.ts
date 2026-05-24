import { prisma } from '../../shared/prisma';

const visibleMessageFilter = (userId: string) => ({
  deletedForEveryone: false,
  NOT: {
    deletedForUserIds: {
      has: userId,
    },
  },
});

export const messageService = {
  getChatAndVerifyUser: async (chatId: string, userId: string) => {
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

  createMessage: async (userId: string, chatId: string, content: string, role: string) => {
    // 1. Create message
    const message = await prisma.message.create({
      data: {
        content,
        chatId,
        userId,
        role: role || 'user',
      },
    });

    // 2. Update sender lastActiveAt
    await prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() },
    });

    // 3. Find current chat
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      throw new Error('Chat not found');
    }

    const participantIds = new Set([userId, ...(chat.participantIds || [])]);

    // 4. Update chat updatedAt and hiddenForUserIds
    const updatedChatInDb = await prisma.chat.update({
      where: { id: chatId },
      data: {
        updatedAt: new Date(),
        hiddenForUserIds: {
          set: chat.hiddenForUserIds.filter(id => !participantIds.has(id)),
        },
      },
      include: {
        messages: {
          where: {
            deletedForEveryone: false,
            NOT: { deletedForUserIds: { has: userId } },
          },
        },
      },
    });

    return {
      message,
      updatedChat: {
        id: updatedChatInDb.id,
        title: updatedChatInDb.title,
        createdAt: updatedChatInDb.createdAt,
        updatedAt: updatedChatInDb.updatedAt,
        isDirect: updatedChatInDb.isDirect,
        participantIds: updatedChatInDb.participantIds,
        messages: updatedChatInDb.messages || [],
      },
      participantIds: Array.from(participantIds),
    };
  },

  createFileMessage: async (userId: string, chatId: string, filename: string, fileUrl: string, fileType: string) => {
    // 1. Create message
    const message = await prisma.message.create({
      data: {
        content: filename,
        chatId,
        userId,
        role: 'user',
        fileUrl,
        fileType,
      },
    });

    // 2. Update sender lastActiveAt
    await prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() },
    });

    // 3. Find current chat
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      throw new Error('Chat not found');
    }

    const participantIds = new Set([userId, ...(chat.participantIds || [])]);

    // 4. Update chat updatedAt and hiddenForUserIds
    const updatedChatInDb = await prisma.chat.update({
      where: { id: chatId },
      data: {
        updatedAt: new Date(),
        hiddenForUserIds: {
          set: chat.hiddenForUserIds.filter(id => !participantIds.has(id)),
        },
      },
      include: {
        messages: {
          where: {
            deletedForEveryone: false,
            NOT: { deletedForUserIds: { has: userId } },
          },
        },
      },
    });

    return {
      message,
      updatedChat: {
        id: updatedChatInDb.id,
        title: updatedChatInDb.title,
        createdAt: updatedChatInDb.createdAt,
        updatedAt: updatedChatInDb.updatedAt,
        isDirect: updatedChatInDb.isDirect,
        participantIds: updatedChatInDb.participantIds,
        messages: updatedChatInDb.messages || [],
      },
      participantIds: Array.from(participantIds),
    };
  },

  getMessages: async (chatId: string, userId: string) => {
    return prisma.message.findMany({
      where: {
        chatId,
        ...visibleMessageFilter(userId),
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  },

  getMessageById: async (messageId: string, userId: string) => {
    return prisma.message.findFirst({
      where: {
        id: messageId,
        chat: {
          OR: [
            { userId },
            { participantIds: { has: userId } },
          ],
        },
      },
    });
  },

  deleteForEveryone: async (messageId: string) => {
    return prisma.message.update({
      where: { id: messageId },
      data: {
        deletedForEveryone: true,
      },
    });
  },

  deleteForMe: async (messageId: string, userId: string, currentDeletedIds: string[]) => {
    if (!currentDeletedIds.includes(userId)) {
      return prisma.message.update({
        where: { id: messageId },
        data: {
          deletedForUserIds: {
            set: [...currentDeletedIds, userId],
          },
        },
      });
    }
  },
};

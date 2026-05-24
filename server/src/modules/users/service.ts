import { prisma } from '../../shared/prisma';

export const userService = {
  getUsers: async (userId: string, includeSelf: boolean) => {
    return prisma.user.findMany({
      where: includeSelf
        ? undefined
        : {
            id: {
              not: userId,
            },
          },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        lastActiveAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  updateProfile: async (userId: string, name: string) => {
    return prisma.user.update({
      where: { id: userId },
      data: { name: name.trim() },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        lastActiveAt: true,
      },
    });
  },
};

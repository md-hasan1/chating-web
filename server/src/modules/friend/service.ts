import { prisma } from '../../shared/prisma';

const userSelectFields = {
  id: true,
  name: true,
  email: true,
  image: true,
  lastActiveAt: true,
};

export const friendService = {
  checkUserExists: async (userId: string) => {
    return prisma.user.findUnique({ where: { id: userId } });
  },

  findExistingRequest: async (userId: string, targetUserId: string) => {
    return prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: userId },
        ],
      },
    });
  },

  updateRejectedRequestToPending: async (requestId: string, senderId: string, receiverId: string) => {
    return prisma.friendRequest.update({
      where: { id: requestId },
      data: {
        senderId,
        receiverId,
        status: 'pending',
        updatedAt: new Date(),
      },
      include: {
        sender: { select: userSelectFields },
        receiver: { select: userSelectFields },
      },
    });
  },

  createFriendRequest: async (senderId: string, receiverId: string) => {
    return prisma.friendRequest.create({
      data: {
        senderId,
        receiverId,
      },
      include: {
        sender: { select: userSelectFields },
        receiver: { select: userSelectFields },
      },
    });
  },

  getPendingRequests: async (userId: string) => {
    return prisma.friendRequest.findMany({
      where: {
        receiverId: userId,
        status: 'pending',
      },
      include: {
        sender: { select: userSelectFields },
        receiver: { select: userSelectFields },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  getSentRequests: async (userId: string) => {
    return prisma.friendRequest.findMany({
      where: {
        senderId: userId,
        status: 'pending',
      },
      include: {
        sender: { select: userSelectFields },
        receiver: { select: userSelectFields },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  getFriendsList: async (userId: string) => {
    const acceptedRequests = await prisma.friendRequest.findMany({
      where: {
        status: 'accepted',
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
      },
      include: {
        sender: { select: userSelectFields },
        receiver: { select: userSelectFields },
      },
    });

    return acceptedRequests.map(req => {
      return req.senderId === userId ? req.receiver : req.sender;
    });
  },

  findPendingRequestByIdAndReceiver: async (requestId: string, receiverId: string) => {
    return prisma.friendRequest.findFirst({
      where: {
        id: requestId,
        receiverId,
        status: 'pending',
      },
    });
  },

  acceptFriendRequest: async (requestId: string) => {
    return prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: 'accepted' },
      include: {
        sender: { select: userSelectFields },
        receiver: { select: userSelectFields },
      },
    });
  },

  rejectFriendRequest: async (requestId: string) => {
    return prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: 'rejected' },
      include: {
        sender: { select: userSelectFields },
        receiver: { select: userSelectFields },
      },
    });
  },
};

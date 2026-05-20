import express, { Request, Response } from 'express';
import { prisma, io, activeUsers } from '../index';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// Send a friend request
router.post('/request', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { targetUserId } = req.body;
    const userId = req.userId!;

    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId is required' });
    }

    if (targetUserId === userId) {
      return res.status(400).json({ error: 'Cannot send a friend request to yourself' });
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if a request already exists in either direction
    const existing = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: userId }
        ]
      }
    });

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(400).json({ error: 'You are already friends' });
      }
      if (existing.status === 'pending') {
        return res.status(400).json({ error: 'A friend request already exists' });
      }
      // If rejected, allow re-sending by updating the existing record
      if (existing.status === 'rejected') {
        const updated = await prisma.friendRequest.update({
          where: { id: existing.id },
          data: {
            senderId: userId,
            receiverId: targetUserId,
            status: 'pending',
            updatedAt: new Date()
          },
          include: {
            sender: { select: { id: true, name: true, email: true, image: true, lastActiveAt: true } },
            receiver: { select: { id: true, name: true, email: true, image: true, lastActiveAt: true } }
          }
        });
        return res.status(201).json(updated);
      }
    }

    const friendRequest = await prisma.friendRequest.create({
      data: {
        senderId: userId,
        receiverId: targetUserId
      },
      include: {
        sender: { select: { id: true, name: true, email: true, image: true, lastActiveAt: true } },
        receiver: { select: { id: true, name: true, email: true, image: true, lastActiveAt: true } }
      }
    });

    // Notify the target user in real-time
    const targetSocketId = activeUsers.get(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('friend:request', friendRequest);
    }

    res.status(201).json(friendRequest);
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// Get received pending requests
router.get('/pending', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const requests = await prisma.friendRequest.findMany({
      where: {
        receiverId: userId,
        status: 'pending'
      },
      include: {
        sender: { select: { id: true, name: true, email: true, image: true, lastActiveAt: true } },
        receiver: { select: { id: true, name: true, email: true, image: true, lastActiveAt: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(requests);
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
});

// Get sent requests
router.get('/sent', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const requests = await prisma.friendRequest.findMany({
      where: {
        senderId: userId,
        status: 'pending'
      },
      include: {
        sender: { select: { id: true, name: true, email: true, image: true, lastActiveAt: true } },
        receiver: { select: { id: true, name: true, email: true, image: true, lastActiveAt: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(requests);
  } catch (error) {
    console.error('Error fetching sent requests:', error);
    res.status(500).json({ error: 'Failed to fetch sent requests' });
  }
});

// Get friends list (accepted requests)
router.get('/list', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const acceptedRequests = await prisma.friendRequest.findMany({
      where: {
        status: 'accepted',
        OR: [
          { senderId: userId },
          { receiverId: userId }
        ]
      },
      include: {
        sender: { select: { id: true, name: true, email: true, image: true, lastActiveAt: true } },
        receiver: { select: { id: true, name: true, email: true, image: true, lastActiveAt: true } }
      }
    });

    // Extract the friend (the other user) from each request
    const friends = acceptedRequests.map(req => {
      return req.senderId === userId ? req.receiver : req.sender;
    });

    res.json(friends);
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// Accept a friend request
router.post('/accept', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { requestId } = req.body;
    const userId = req.userId!;

    if (!requestId) {
      return res.status(400).json({ error: 'requestId is required' });
    }

    const friendRequest = await prisma.friendRequest.findFirst({
      where: {
        id: requestId,
        receiverId: userId,
        status: 'pending'
      }
    });

    if (!friendRequest) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    const updated = await prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: 'accepted' },
      include: {
        sender: { select: { id: true, name: true, email: true, image: true, lastActiveAt: true } },
        receiver: { select: { id: true, name: true, email: true, image: true, lastActiveAt: true } }
      }
    });

    // Notify the sender that their request was accepted
    const senderSocketId = activeUsers.get(friendRequest.senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit('friend:accepted', updated);
    }

    res.json(updated);
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

// Reject a friend request
router.post('/reject', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { requestId } = req.body;
    const userId = req.userId!;

    if (!requestId) {
      return res.status(400).json({ error: 'requestId is required' });
    }

    const friendRequest = await prisma.friendRequest.findFirst({
      where: {
        id: requestId,
        receiverId: userId,
        status: 'pending'
      }
    });

    if (!friendRequest) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    const updated = await prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: 'rejected' },
      include: {
        sender: { select: { id: true, name: true, email: true, image: true, lastActiveAt: true } },
        receiver: { select: { id: true, name: true, email: true, image: true, lastActiveAt: true } }
      }
    });

    // Notify the sender that their request was rejected
    const senderSocketId = activeUsers.get(friendRequest.senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit('friend:rejected', updated);
    }

    res.json(updated);
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    res.status(500).json({ error: 'Failed to reject friend request' });
  }
});

export default router;

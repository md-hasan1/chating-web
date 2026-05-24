import { Request, Response } from 'express';
import { friendService } from './service';
import { io, activeUsers } from '../../index';

export const friendController = {
  sendFriendRequest: async (req: Request & { userId?: string }, res: Response) => {
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
      const targetUser = await friendService.checkUserExists(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if request already exists
      const existing = await friendService.findExistingRequest(userId, targetUserId);

      if (existing) {
        if (existing.status === 'accepted') {
          return res.status(400).json({ error: 'You are already friends' });
        }
        if (existing.status === 'pending') {
          return res.status(400).json({ error: 'A friend request already exists' });
        }
        if (existing.status === 'rejected') {
          const updated = await friendService.updateRejectedRequestToPending(existing.id, userId, targetUserId);
          
          // Notify the target user in real-time
          const targetSocketId = activeUsers.get(targetUserId);
          if (targetSocketId) {
            io.to(targetSocketId).emit('friend:request:received', updated);
          }
          return res.status(201).json(updated);
        }
      }

      const friendRequest = await friendService.createFriendRequest(userId, targetUserId);

      // Notify the target user in real-time
      const targetSocketId = activeUsers.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('friend:request:received', friendRequest);
      }

      res.status(201).json(friendRequest);
    } catch (error) {
      console.error('Error sending friend request:', error);
      res.status(500).json({ error: 'Failed to send friend request' });
    }
  },

  getPendingRequests: async (req: Request & { userId?: string }, res: Response) => {
    try {
      const userId = req.userId!;
      const requests = await friendService.getPendingRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      res.status(500).json({ error: 'Failed to fetch pending requests' });
    }
  },

  getSentRequests: async (req: Request & { userId?: string }, res: Response) => {
    try {
      const userId = req.userId!;
      const requests = await friendService.getSentRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error('Error fetching sent requests:', error);
      res.status(500).json({ error: 'Failed to fetch sent requests' });
    }
  },

  getFriendsList: async (req: Request & { userId?: string }, res: Response) => {
    try {
      const userId = req.userId!;
      const friends = await friendService.getFriendsList(userId);
      res.json(friends);
    } catch (error) {
      console.error('Error fetching friends:', error);
      res.status(500).json({ error: 'Failed to fetch friends' });
    }
  },

  acceptFriendRequest: async (req: Request & { userId?: string }, res: Response) => {
    try {
      const { requestId } = req.body;
      const userId = req.userId!;

      if (!requestId) {
        return res.status(400).json({ error: 'requestId is required' });
      }

      const friendRequest = await friendService.findPendingRequestByIdAndReceiver(requestId, userId);
      if (!friendRequest) {
        return res.status(404).json({ error: 'Friend request not found' });
      }

      const updated = await friendService.acceptFriendRequest(requestId);

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
  },

  rejectFriendRequest: async (req: Request & { userId?: string }, res: Response) => {
    try {
      const { requestId } = req.body;
      const userId = req.userId!;

      if (!requestId) {
        return res.status(400).json({ error: 'requestId is required' });
      }

      const friendRequest = await friendService.findPendingRequestByIdAndReceiver(requestId, userId);
      if (!friendRequest) {
        return res.status(404).json({ error: 'Friend request not found' });
      }

      const updated = await friendService.rejectFriendRequest(requestId);

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
  },
};

import { Server, Socket } from 'socket.io';
import { prisma } from '../../shared/prisma';
import { activeUsers } from './state';

export const registerFriendHandlers = (io: Server, socket: Socket) => {
  // Friend request socket events
  socket.on('friend:request:send', async (data: { targetUserId: string }) => {
    try {
      const senderId = socket.data.userId;
      console.log('friend:request:send event received. senderId:', senderId, 'targetUserId:', data?.targetUserId);
      if (!senderId) {
        console.warn('friend:request:send: Sender not authenticated');
        return socket.emit('friend:request:error', { message: 'Not authenticated' });
      }

      const { targetUserId } = data;
      if (senderId === targetUserId) {
        console.warn('friend:request:send: Attempted to add self');
        return socket.emit('friend:request:error', { message: 'Cannot add yourself' });
      }

      // Check if request already exists
      const existing = await prisma.friendRequest.findFirst({
        where: {
          OR: [
            { senderId, receiverId: targetUserId },
            { senderId: targetUserId, receiverId: senderId }
          ]
        }
      });

      if (existing) {
        if (existing.status === 'accepted') {
          return socket.emit('friend:request:error', { message: 'Already friends' });
        }
        if (existing.status === 'pending') {
          return socket.emit('friend:request:error', { message: 'Request already pending' });
        }
        // If rejected, allow resending by deleting the old request
        await prisma.friendRequest.delete({ where: { id: existing.id } });
      }

      const request = await prisma.friendRequest.create({
        data: {
          senderId,
          receiverId: targetUserId,
          status: 'pending'
        },
        include: {
          sender: { select: { id: true, name: true, email: true, image: true } },
          receiver: { select: { id: true, name: true, email: true, image: true } }
        }
      });

      // Emit to receiver
      const receiverSocketId = activeUsers.get(targetUserId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('friend:request:received', request);
      }

      // Emit back to sender
      socket.emit('friend:request:sent', request);
    } catch (err) {
      console.error('Error sending friend request via socket:', err);
      socket.emit('error', { message: 'Failed to send request' });
    }
  });

  socket.on('friend:request:accept', async (data: { requestId: string }) => {
    try {
      const receiverId = socket.data.userId;
      if (!receiverId) return socket.emit('error', { message: 'Not authenticated' });

      const { requestId } = data;
      const request = await prisma.friendRequest.findUnique({
        where: { id: requestId }
      });

      if (!request || request.receiverId !== receiverId) {
        return socket.emit('error', { message: 'Request not found' });
      }

      const updated = await prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: 'accepted' },
        include: {
          sender: { select: { id: true, name: true, email: true, image: true } },
          receiver: { select: { id: true, name: true, email: true, image: true } }
        }
      });

      // Emit to sender
      const senderSocketId = activeUsers.get(updated.senderId);
      if (senderSocketId) {
        io.to(senderSocketId).emit('friend:accepted', updated);
      }

      // Emit to receiver (this client)
      socket.emit('friend:accepted', updated);
    } catch (err) {
      console.error('Error accepting friend request via socket:', err);
      socket.emit('error', { message: 'Failed to accept request' });
    }
  });

  socket.on('friend:request:reject', async (data: { requestId: string }) => {
    try {
      const receiverId = socket.data.userId;
      console.log('friend:request:reject socket event received. user:', receiverId, 'data:', data);
      if (!receiverId) return socket.emit('error', { message: 'Not authenticated' });

      const { requestId } = data;
      const request = await prisma.friendRequest.findUnique({
        where: { id: requestId }
      });
      console.log('Fetched friendRequest from DB:', request);

      if (!request || request.receiverId !== receiverId) {
        console.log('Reject auth check failed. Request receiverId:', request?.receiverId, 'Socket userId:', receiverId);
        return socket.emit('error', { message: 'Request not found' });
      }

      const updated = await prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: 'rejected' },
        include: {
          sender: { select: { id: true, name: true, email: true, image: true } },
          receiver: { select: { id: true, name: true, email: true, image: true } }
        }
      });
      console.log('Updated friendRequest status to rejected in DB:', updated);

      // Emit to sender
      const senderSocketId = activeUsers.get(updated.senderId);
      console.log('Sender socket ID:', senderSocketId);
      if (senderSocketId) {
        io.to(senderSocketId).emit('friend:rejected', updated);
      }

      // Emit to receiver (this client)
      socket.emit('friend:rejected', updated);
    } catch (err) {
      console.error('Error rejecting friend request via socket:', err);
      socket.emit('error', { message: 'Failed to reject request' });
    }
  });
};

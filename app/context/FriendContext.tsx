'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { useToast } from './ToastContext';
import { useAppDispatch } from '../store/hooks';
import { api } from '../store/api';

export interface FriendRequestUser {
  id: string;
  name?: string | null;
  email: string;
  image?: string | null;
  lastActiveAt?: string | null;
}

export interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt: string;
  sender: FriendRequestUser;
  receiver: FriendRequestUser;
}

interface FriendContextType {
  friends: FriendRequestUser[];
  pendingRequests: FriendRequest[];
  sentRequests: FriendRequest[];
  isLoading: boolean;
  fetchFriends: () => Promise<void>;
  fetchPending: () => Promise<void>;
  fetchSent: () => Promise<void>;
  sendRequest: (targetUserId: string) => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  rejectRequest: (requestId: string) => Promise<void>;
}

const FriendContext = createContext<FriendContextType | undefined>(undefined);

export const FriendProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();
  const { token, isGuest, user } = useAuth();
  const { socket } = useSocket();
  const { showToast } = useToast();
  const [friends, setFriends] = useState<FriendRequestUser[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchFriends = useCallback(async () => {
    if (!token) return;
    try {
      const queryResult = dispatch(api.endpoints.getFriends.initiate({ token }));
      const data = await queryResult.unwrap();
      queryResult.unsubscribe();
      setFriends(data);
    } catch (err) {
      console.error('Error fetching friends:', err);
    }
  }, [dispatch, token, isGuest]);

  const fetchPending = useCallback(async () => {
    if (!token) return;
    try {
      const queryResult = dispatch(api.endpoints.getPendingRequests.initiate({ token }));
      const data = await queryResult.unwrap();
      queryResult.unsubscribe();
      setPendingRequests(data);
    } catch (err) {
      console.error('Error fetching pending requests:', err);
    }
  }, [dispatch, token, isGuest]);

  const fetchSent = useCallback(async () => {
    if (!token) return;
    try {
      const queryResult = dispatch(api.endpoints.getSentRequests.initiate({ token }));
      const data = await queryResult.unwrap();
      queryResult.unsubscribe();
      setSentRequests(data);
    } catch (err) {
      console.error('Error fetching sent requests:', err);
    }
  }, [dispatch, token, isGuest]);

  const sendRequest = useCallback(async (targetUserId: string) => {
    if (!socket || !socket.connected) {
      showToast('Connection Error', 'Chat connection offline. Cannot send request.', 'error');
      return;
    }
    socket.emit('friend:request:send', { targetUserId });
  }, [socket, showToast]);

  const acceptRequest = useCallback(async (requestId: string) => {
    if (!socket || !socket.connected) {
      showToast('Connection Error', 'Chat connection offline. Cannot accept request.', 'error');
      return;
    }
    socket.emit('friend:request:accept', { requestId });
  }, [socket, showToast]);

  const rejectRequest = useCallback(async (requestId: string) => {
    console.log('rejectRequest called with ID:', requestId);
    if (!socket || !socket.connected) {
      showToast('Connection Error', 'Chat connection offline. Cannot reject request.', 'error');
      return;
    }
    socket.emit('friend:request:reject', { requestId });
  }, [socket, showToast]);

  // Initial fetch
  useEffect(() => {
    if (token) {
      fetchFriends();
      fetchPending();
      fetchSent();
    }
  }, [token, isGuest, fetchFriends, fetchPending, fetchSent]);

  // Real-time socket listeners
  useEffect(() => {
    if (!socket || !user?.id) return;

    const handleFriendRequestReceived = (request: FriendRequest) => {
      setPendingRequests(prev => {
        if (prev.some(r => r.id === request.id)) return prev;
        return [request, ...prev];
      });
      showToast('Friend Request', `${request.sender.name || request.sender.email} sent you a friend request.`, 'info');
    };

    const handleFriendRequestSent = (request: FriendRequest) => {
      setSentRequests(prev => {
        if (prev.some(r => r.id === request.id)) return prev;
        return [request, ...prev];
      });
      showToast('Request Sent', `Friend request sent to ${request.receiver.name || request.receiver.email}.`, 'success');
    };

    const handleFriendAccepted = (request: FriendRequest) => {
      const isSender = request.senderId === user.id;

      if (isSender) {
        setSentRequests(prev => prev.filter(r => r.id !== request.id));
        const newFriend = request.receiver;
        setFriends(prev => {
          if (prev.some(f => f.id === newFriend.id)) return prev;
          return [...prev, newFriend];
        });
        showToast('Request Accepted', `${request.receiver.name || request.receiver.email} accepted your friend request!`, 'success');
      } else {
        setPendingRequests(prev => prev.filter(r => r.id !== request.id));
        const newFriend = request.sender;
        setFriends(prev => {
          if (prev.some(f => f.id === newFriend.id)) return prev;
          return [...prev, newFriend];
        });
        showToast('Request Accepted', `You are now friends with ${request.sender.name || request.sender.email}!`, 'success');
      }
    };

    const handleFriendRejected = (request: FriendRequest) => {
      console.log('handleFriendRejected received:', request);
      const isSender = request.senderId === user.id;

      if (isSender) {
        setSentRequests(prev => prev.filter(r => r.id !== request.id));
        showToast('Request Declined', `${request.receiver.name || request.receiver.email} declined your friend request.`, 'warning');
      } else {
        setPendingRequests(prev => prev.filter(r => r.id !== request.id));
      }
    };

    const handleRequestError = (data: { message: string }) => {
      console.error('friend:request:error:', data);
      showToast('Friend Request Error', data.message, 'error');
    };

    socket.on('friend:request:received', handleFriendRequestReceived);
    socket.on('friend:request:sent', handleFriendRequestSent);
    socket.on('friend:accepted', handleFriendAccepted);
    socket.on('friend:rejected', handleFriendRejected);
    socket.on('friend:request:error', handleRequestError);

    return () => {
      socket.off('friend:request:received', handleFriendRequestReceived);
      socket.off('friend:request:sent', handleFriendRequestSent);
      socket.off('friend:accepted', handleFriendAccepted);
      socket.off('friend:rejected', handleFriendRejected);
      socket.off('friend:request:error', handleRequestError);
    };
  }, [socket, user?.id, showToast]);

  return (
    <FriendContext.Provider value={{
      friends, pendingRequests, sentRequests, isLoading,
      fetchFriends, fetchPending, fetchSent,
      sendRequest, acceptRequest, rejectRequest
    }}>
      {children}
    </FriendContext.Provider>
  );
};

export const useFriend = () => {
  const context = useContext(FriendContext);
  if (!context) {
    throw new Error('useFriend must be used within FriendProvider');
  }
  return context;
};

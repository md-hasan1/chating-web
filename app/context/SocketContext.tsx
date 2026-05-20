'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: Set<string>;
  lastActiveTimes: Record<string, string>;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [lastActiveTimes, setLastActiveTimes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;

    const newSocket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000', {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setIsConnected(true);
      // Send user login event
      newSocket.emit('user:login', user.id);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
      setOnlineUsers(new Set());
    });

    newSocket.on('user:online:list', (data: { userIds: string[] }) => {
      setOnlineUsers(new Set(data.userIds));
    });

    newSocket.on('user:online', (data: { userId: string }) => {
      setOnlineUsers(prev => new Set([...prev, data.userId]));
    });

    newSocket.on('user:offline', (data: { userId: string }) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.userId);
        return newSet;
      });
      setLastActiveTimes(prev => ({
        ...prev,
        [data.userId]: new Date().toISOString()
      }));
    });

    const handleVisibilityChange = () => {
      if (!newSocket.connected) return;
      if (document.visibilityState === 'visible') {
        newSocket.emit('user:active');
      } else {
        newSocket.emit('user:inactive');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    setSocket(newSocket);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      newSocket.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, onlineUsers, lastActiveTimes }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};

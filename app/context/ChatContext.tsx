'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { useToast } from './ToastContext';

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  createdAt: string;
  chatId: string;
  userId: string;
  clientMessageId?: string;
  deletedForUserIds?: string[];
  deletedForEveryone?: boolean;
  deliveredAt?: string;
  seenAt?: string;
}

export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  isDirect?: boolean;
  participantIds?: string[];
}

export interface UserSummary {
  id: string;
  name?: string | null;
  email: string;
  image?: string | null;
  lastActiveAt?: string | null;
}

interface ChatContextType {
  chats: Chat[];
  currentChat: Chat | null;
  users: UserSummary[];
  usersLoading: boolean;
  isLoading: boolean;
  error: string | null;
  unreadCounts: Record<string, number>;
  fetchChats: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  createChat: (title: string) => Promise<Chat>;
  startDirectChat: (targetUserId: string) => Promise<Chat>;
  selectChat: (chatId: string) => Promise<void>;
  addMessage: (content: string, role: 'user' | 'assistant') => Promise<Message>;
  deleteChat: (chatId: string) => Promise<void>;
  deleteMessage: (messageId: string, scope: 'me' | 'everyone') => Promise<void>;
  clearUnread: (chatId: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isGuest, user } = useAuth();
  const { socket } = useSocket();
  const { showToast } = useToast();
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const currentChatIdRef = useRef<string | null>(null);
  const chatsRef = useRef<Chat[]>([]);

  // Keep ref in sync with currentChat
  useEffect(() => {
    currentChatIdRef.current = currentChat?.id ?? null;
  }, [currentChat?.id]);

  // Keep ref in sync with chats
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  const fetchChats = useCallback(async () => {

    if (!token) return;

    setIsLoading(true);
    try {
      const response = await axios.get('/api/chat', {
        baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
        headers: { Authorization: `Bearer ${token}` }
      });
      const visibleChats = (response.data as Chat[]).filter(chat => chat.messages.length > 0);
      setChats(visibleChats);
      setError(null);
    } catch (err) {
      setError('Failed to fetch chats');
      console.error('Error fetching chats:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token, isGuest]);

  const fetchUsers = useCallback(async () => {
    if (!token) {
      setUsers([]);
      return;
    }

    setUsersLoading(true);
    try {
      const response = await axios.get('/api/users', {
        baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
        headers: { Authorization: `Bearer ${token}` }
      });
      const fetchedUsers = response.data as UserSummary[];
      setUsers(user?.id ? fetchedUsers.filter(u => u.id !== user.id) : fetchedUsers);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setUsersLoading(false);
    }
  }, [token, user?.id]);

  const createChat = useCallback(async (title: string): Promise<Chat> => {
    const newChat: Chat = {
      id: 'chat-' + Date.now(),
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      isDirect: false,
      participantIds: user?.id ? [user.id] : []
    };

    if (!token) throw new Error('Not authenticated');

    try {
      const response = await axios.post(
        '/api/chat',
        { title },
        {
          baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setChats([response.data, ...chats]);
      setError(null);
      return response.data;
    } catch (err) {
      setError('Failed to create chat');
      throw err;
    }
  }, [token, isGuest, chats, user?.id]);

  const startDirectChat = useCallback(async (targetUserId: string): Promise<Chat> => {

    if (!token) throw new Error('Not authenticated');

    try {
      const response = await axios.post(
        '/api/chat/direct',
        { targetUserId },
        {
          baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const chat = response.data as Chat;

      setChats(prev => {
        if (chat.isDirect && chat.messages.length === 0) {
          return prev.filter(existingChat => existingChat.id !== chat.id);
        }

        const existingIndex = prev.findIndex(c => c.id === chat.id);
        if (existingIndex === -1) {
          return [chat, ...prev];
        }

        const updated = [...prev];
        updated.splice(existingIndex, 1);
        return [chat, ...updated];
      });

      setCurrentChat(chat);
      setError(null);
      return chat;
    } catch (err) {
      setError('Failed to start direct chat');
      throw err;
    }
  }, [token, isGuest]);

  const clearUnread = useCallback((chatId: string) => {
    setUnreadCounts(prev => {
      if (!prev[chatId]) return prev;
      const updated = { ...prev };
      delete updated[chatId];
      return updated;
    });
  }, []);

  const removeMessageFromState = useCallback((messageId: string) => {
    setCurrentChat(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: prev.messages.filter(message => message.id !== messageId)
      };
    });

    setChats(prev => prev.map(chat => ({
      ...chat,
      messages: chat.messages.filter(message => message.id !== messageId)
    })));
  }, []);

  const selectChat = useCallback(async (chatId: string) => {
    // Clear unread count when selecting a chat
    clearUnread(chatId);

    if (!token) return;

    setIsLoading(true);
    try {
      const response = await axios.get(`/api/chat/${chatId}`, {
        baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentChat(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch chat');
      console.error('Error fetching chat:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token, isGuest, clearUnread]);

  // Join all user's chat rooms so we receive messages from every chat
  useEffect(() => {
    if (!socket || chats.length === 0) return;

    chats.forEach(chat => {
      socket.emit('chat:join', chat.id);
    });

    return () => {
      chats.forEach(chat => {
        socket.emit('chat:leave', chat.id);
      });
    };
  }, [socket, chats.length]);

  // Listen for real-time messages via Socket.IO
  useEffect(() => {
    if (!socket) return;

    const handleMessageReceived = (payload: Message | { message?: Message; chat?: Chat } | null | undefined) => {
      const message = payload && 'message' in payload ? payload.message : payload;
      const incomingChat = payload && 'chat' in payload ? payload.chat : undefined;

      if (!message || !message.userId) {
        return;
      }

      const isOwnMessage = message.userId === user?.id;

      // Automatically emit delivered or seen
      if (!isOwnMessage && socket && socket.connected) {
        if (currentChatIdRef.current === message.chatId) {
          socket.emit('message:seen', { chatId: message.chatId });
        } else {
          socket.emit('message:delivered', { messageId: message.id, chatId: message.chatId });
        }
      }

      const tempMessageId = message.clientMessageId;
      const isSenderEcho = isOwnMessage && tempMessageId;

      const mergeMessageIntoChat = (chat: Chat) => {
        if (isSenderEcho) {
          const filteredMessages = chat.messages.filter(existing => existing.id !== tempMessageId);
          return {
            ...chat,
            messages: filteredMessages.some(existing => existing.id === message.id)
              ? filteredMessages
              : [...filteredMessages, message],
            updatedAt: message.createdAt
          };
        }

        const alreadyExists = chat.messages.some(existing => existing.id === message.id);
        return {
          ...chat,
          messages: alreadyExists ? chat.messages : [...chat.messages, message],
          updatedAt: message.createdAt
        };
      };

      // Update chats list with last message (for sidebar preview)
      setChats(prev => prev.map(chat => {
        if (chat.id !== message.chatId) return chat;
        return mergeMessageIntoChat(chat);
      }));

      if (incomingChat) {
        setChats(prev => {
          const existingIndex = prev.findIndex(chat => chat.id === incomingChat.id);
          if (existingIndex === -1) {
            return [{ ...incomingChat, messages: incomingChat.messages }, ...prev];
          }

          return prev.map(chat =>
            chat.id === incomingChat.id
              ? {
                  ...chat,
                  ...incomingChat,
                  messages: isSenderEcho
                    ? mergeMessageIntoChat(chat).messages
                    : chat.messages.some(m => m.id === message.id)
                      ? chat.messages
                      : [...chat.messages, message]
                }
              : chat
          );
        });
      }

      // For the currently open chat, add message to the view
      setCurrentChat(prev => {
        if (!prev || prev.id !== message.chatId) return prev;
        if (isSenderEcho) {
          return mergeMessageIntoChat(prev);
        }
        const alreadyExists = prev.messages.some(m => m.id === message.id);
        if (alreadyExists) return prev;
        return { ...prev, messages: [...prev.messages, message], updatedAt: message.createdAt };
      });

      const targetChat = chatsRef.current.find(c => c.id === message.chatId);

      // Increment unread count if message is from another user AND not in the currently open chat

      if (!isOwnMessage && currentChatIdRef.current !== message.chatId) {
        setUnreadCounts(prev => ({
          ...prev,
          [message.chatId]: (prev[message.chatId] || 0) + 1
        }));

        if (!currentChatIdRef.current && targetChat) {
          let chatTitle = 'New Message';
          if (targetChat.isDirect && targetChat.participantIds && user?.id) {
            const otherId = targetChat.participantIds.find(id => id !== user.id);
            const otherUser = users.find(u => u.id === otherId);
            chatTitle = otherUser?.name || otherUser?.email || targetChat.title;
          } else {
            chatTitle = targetChat.title;
          }
          showToast(chatTitle, message.content, 'info');
        }
      }
    };

    const handleMessageDeleted = (data: { messageId: string; chatId: string; scope: 'everyone' }) => {
      if (data.scope !== 'everyone') return;
      removeMessageFromState(data.messageId);
    };

    const handleChatCreated = (newChat: Chat) => {
      // Do not show empty chats in the chat list
      if (!newChat.messages || newChat.messages.length === 0) {
        return;
      }

      setChats(prev => {
        if (prev.some(c => c.id === newChat.id)) return prev;
        return [newChat, ...prev];
      });
      // Optionally notify user about new chat
      showToast('New Chat Started', `You can now chat in "${newChat.title}"`, 'success');
    };

    const handleMessageStatusUpdate = (data: { messageId?: string; chatId: string; deliveredAt?: string; seenAt?: string }) => {
      const updateMsg = (msg: Message) => {
        if (data.messageId) {
          if (msg.id === data.messageId) {
            return { ...msg, deliveredAt: data.deliveredAt || msg.deliveredAt, seenAt: data.seenAt || msg.seenAt };
          }
          return msg;
        } else {
          // Bulk update for all messages sent by the user that don't have seenAt set
          if (msg.userId === user?.id && !msg.seenAt) {
            return { ...msg, deliveredAt: data.seenAt || msg.deliveredAt, seenAt: data.seenAt || msg.seenAt };
          }
          return msg;
        }
      };

      setChats(prev => prev.map(chat => {
        if (chat.id !== data.chatId) return chat;
        return { ...chat, messages: chat.messages.map(updateMsg) };
      }));

      setCurrentChat(prev => {
        if (!prev || prev.id !== data.chatId) return prev;
        return { ...prev, messages: prev.messages.map(updateMsg) };
      });
    };

    socket.on('message:received', handleMessageReceived);
    socket.on('message:deleted', handleMessageDeleted);
    socket.on('chat:created', handleChatCreated);
    socket.on('message:status:update', handleMessageStatusUpdate);

    return () => {
      socket.off('message:received', handleMessageReceived);
      socket.off('message:deleted', handleMessageDeleted);
      socket.off('chat:created', handleChatCreated);
      socket.off('message:status:update', handleMessageStatusUpdate);
    };
  }, [socket, user?.id, users, showToast, removeMessageFromState]);

  // When opening a chat, mark messages as seen
  useEffect(() => {
    if (currentChat && socket && socket.connected) {
      socket.emit('message:seen', { chatId: currentChat.id });
    }
  }, [currentChat?.id, socket]);

  const addMessage = useCallback(async (content: string, role: 'user' | 'assistant' = 'user'): Promise<Message> => {
    if (!currentChat) throw new Error('No active chat');

    const clientMessageId = 'client-' + Date.now();

    const newMessage: Message = {
      id: clientMessageId,
      content,
      role,
      createdAt: new Date().toISOString(),
      chatId: currentChat.id,
      userId: user?.id || 'guest',
      clientMessageId
    };

    if (!token) throw new Error('Not authenticated');

    try {
      // Send via Socket.IO for real-time messaging
      if (socket && socket.connected) {
        socket.emit('message:send', {
          chatId: currentChat.id,
          content,
          clientMessageId: newMessage.clientMessageId
        });
      } else {
        // Fallback to HTTP if Socket.IO not available
        const response = await axios.post(
          '/api/message',
          { content, chatId: currentChat.id, role },
          {
            baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        if (currentChat) {
          const fallbackMessage = response.data as Message;
          setCurrentChat({
            ...currentChat,
            messages: [...currentChat.messages, fallbackMessage]
          });

          setChats(prev => {
            const existingIndex = prev.findIndex(chat => chat.id === currentChat.id);
            const updatedChat = {
              ...currentChat,
              messages: [...currentChat.messages, fallbackMessage],
              updatedAt: fallbackMessage.createdAt
            };

            if (existingIndex === -1) {
              return [updatedChat, ...prev];
            }

            return prev.map(chat =>
              chat.id === currentChat.id
                ? { ...chat, messages: [...chat.messages, fallbackMessage], updatedAt: fallbackMessage.createdAt }
                : chat
            );
          });
        }
      }

      setError(null);
      return newMessage;
    } catch (err) {
      setError('Failed to send message');
      throw err;
    }
  }, [token, isGuest, currentChat, socket, user?.id]);

  const deleteChat = useCallback(async (chatId: string) => {

    if (!token) return;

    try {
      const chatToDelete = chats.find(chat => chat.id === chatId) || currentChat;

      await axios.delete(`/api/chat/${chatId}`, {
        baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
        headers: { Authorization: `Bearer ${token}` }
      });

      setChats(chats.filter(chat => chat.id !== chatId));
      if (currentChat?.id === chatId) {
        setCurrentChat(null);
      }
      setError(null);
    } catch (err) {
      setError('Failed to delete chat');
      console.error('Error deleting chat:', err);
    }
  }, [token, isGuest, chats, currentChat]);

  const deleteMessage = useCallback(async (messageId: string, scope: 'me' | 'everyone') => {

    if (!token) return;

    try {
      await axios.delete(`/api/message/${messageId}`, {
        baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
        headers: { Authorization: `Bearer ${token}` },
        params: { scope }
      });

      removeMessageFromState(messageId);
    } catch (err) {
      setError('Failed to delete message');
      console.error('Error deleting message:', err);
    }
  }, [token, isGuest, removeMessageFromState]);

  return (
    <ChatContext.Provider value={{ chats, currentChat, users, usersLoading, isLoading, error, unreadCounts, fetchChats, fetchUsers, createChat, startDirectChat, selectChat, addMessage, deleteChat, deleteMessage, clearUnread }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
};

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { useChat } from '@/app/context/ChatContext';
import { useSocket } from '@/app/context/SocketContext';
import { useFriend } from '@/app/context/FriendContext';
import ChatSidebar from '@/app/components/ChatSidebar';
import MessageList from '@/app/components/MessageList';
import MessageInput from '@/app/components/MessageInput';
import { formatLastActive } from '@/app/utils/formatTime';
import VideoCall from '@/app/components/VideoCall';
import IncomingCall from '@/app/components/IncomingCall';

interface IncomingCallData {
  callId: string;
  callerId: string;
  callerName: string;
  callerSocketId: string;
  callType: 'audio' | 'video';
}

export default function ChatPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isGuest, logout, updateName } = useAuth();
  const { chats, currentChat, users, usersLoading, unreadCounts, fetchChats, fetchUsers, createChat, startDirectChat, selectChat, addMessage, uploadFile, deleteChat, deleteMessage } = useChat();
  const { socket, onlineUsers, lastActiveTimes } = useSocket();
  const { friends, pendingRequests, sentRequests, isLoading: friendLoading, sendRequest, acceptRequest, rejectRequest } = useFriend();
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [ongoingCall, setOngoingCall] = useState<{ callId: string; targetUserId: string; targetUserName: string; isIncoming: boolean; callType: 'audio' | 'video' } | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [typingUsersByChat, setTypingUsersByChat] = useState<Record<string, Record<string, string>>>({});
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchChats();
    }
  }, [user, fetchChats]);

  useEffect(() => {
    if (user) {
      fetchUsers();
    }
  }, [user, fetchUsers]);

  const ongoingCallRef = useRef(ongoingCall);
  useEffect(() => {
    ongoingCallRef.current = ongoingCall;
  }, [ongoingCall]);

  // Listen for incoming calls
  useEffect(() => {
    if (!socket) return;

    const handleCallIncoming = (data: IncomingCallData) => {
      if (ongoingCallRef.current) {
        socket.emit('call:rejected', { callId: data.callId, targetSocketId: data.callerSocketId, message: 'User busy' });
        return;
      }
      setIncomingCall(data);
    };

    const handleCallEnded = () => {
      setIncomingCall(null);
    };

    socket.on('call:incoming', handleCallIncoming);
    socket.on('call:ended', handleCallEnded);

    return () => {
      socket.off('call:incoming', handleCallIncoming);
      socket.off('call:ended', handleCallEnded);
    };
  }, [socket]);

  const handleNewChat = async () => {
    setIsCreatingChat(true);
    try {
      const newChat = await createChat('New Chat');
      await selectChat(newChat.id);
    } catch (error) {
      console.error('Failed to create chat:', error);
    } finally {
      setIsCreatingChat(false);
    }
  };

  const handleSelectChat = async (chatId: string) => {
    await selectChat(chatId);
  };

  const handleSendMessage = async (content: string) => {
    if (!currentChat) return;

    if (socket && socket.connected) {
      socket.emit('typing:stop', { chatId: currentChat.id });
    }
    isTypingRef.current = false;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    setIsSendingMessage(true);
    try {
      await addMessage(content, 'user');
      setIsSendingMessage(false);
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsSendingMessage(false);
    }
  };

  const handleSendFile = async (file: File) => {
    if (!currentChat) return;

    if (socket && socket.connected) {
      socket.emit('typing:stop', { chatId: currentChat.id });
    }
    isTypingRef.current = false;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    setIsSendingMessage(true);
    try {
      await uploadFile(file);
      setIsSendingMessage(false);
    } catch (error) {
      console.error('Failed to send file:', error);
      setIsSendingMessage(false);
    }
  };

  const handleDeleteMessage = async (messageId: string, scope: 'me' | 'everyone') => {
    await deleteMessage(messageId, scope);
  };

  const handleStartDirectChat = async (targetUserId: string) => {
    try {
      await startDirectChat(targetUserId);
    } catch (error) {
      console.error('Failed to start direct chat:', error);
    }
  };

  const handleStartCall = (type: 'audio' | 'video') => {
    const otherUser = getOtherUser();
    if (!otherUser) return;

    const callId = `call-${Date.now()}`;
    setOngoingCall({
      callId,
      targetUserId: otherUser.id,
      targetUserName: otherUser.name || otherUser.email || 'Someone',
      isIncoming: false,
      callType: type
    });
  };

  const getCurrentChatTitle = () => {
    if (currentChat?.isDirect && currentChat.participantIds && user) {
      const otherId = currentChat.participantIds.find(id => id !== user.id);
      const otherUser = users.find(u => u.id === otherId) || friends.find(f => f.id === otherId);
      return otherUser?.name || otherUser?.email || currentChat.title;
    }

    return currentChat?.title || 'Chat';
  };

  const getOtherUser = () => {
    if (currentChat?.isDirect && currentChat.participantIds && user) {
      const otherId = currentChat.participantIds.find(id => id !== user.id);
      return users.find(u => u.id === otherId) || friends.find(f => f.id === otherId);
    }
    return null;
  };

  const handleLogout = () => {
    logout();
    router.push('/auth');
  };

  const handleTypingStart = () => {
    if (!currentChat || !socket || !socket.connected) return;

    if (!isTypingRef.current) {
      socket.emit('typing:start', {
        chatId: currentChat.id,
        userName: user?.name || user?.email || 'Someone'
      });
      isTypingRef.current = true;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (!currentChat || !socket || !socket.connected) return;
      socket.emit('typing:stop', { chatId: currentChat.id });
      isTypingRef.current = false;
      typingTimeoutRef.current = null;
    }, 1200);
  };

  const handleTypingStop = () => {
    if (!currentChat || !socket || !socket.connected) return;
    socket.emit('typing:stop', { chatId: currentChat.id });
    isTypingRef.current = false;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const currentTypingUsers = currentChat
    ? Object.values(typingUsersByChat[currentChat.id] || {})
    : [];

  const isOtherUserTyping = currentTypingUsers.length > 0;

  useEffect(() => {
    if (!socket) return;

    const handleTypingStarted = (data: { chatId: string; userId: string; userName?: string }) => {
      if (!data.chatId || !data.userId || data.userId === user?.id) return;

      setTypingUsersByChat(prev => ({
        ...prev,
        [data.chatId]: {
          ...(prev[data.chatId] || {}),
          [data.userId]: data.userName || 'Someone'
        }
      }));
    };

    const handleTypingStopped = (data: { chatId: string; userId: string }) => {
      if (!data.chatId || !data.userId) return;

      setTypingUsersByChat(prev => {
        const chatTyping = prev[data.chatId];
        if (!chatTyping || !chatTyping[data.userId]) return prev;

        const updatedChatTyping = { ...chatTyping };
        delete updatedChatTyping[data.userId];

        if (Object.keys(updatedChatTyping).length === 0) {
          const next = { ...prev };
          delete next[data.chatId];
          return next;
        }

        return {
          ...prev,
          [data.chatId]: updatedChatTyping
        };
      });
    };

    socket.on('typing:started', handleTypingStarted);
    socket.on('typing:stopped', handleTypingStopped);

    return () => {
      socket.off('typing:started', handleTypingStarted);
      socket.off('typing:stopped', handleTypingStopped);
    };
  }, [socket, user?.id]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!socket || !socket.connected || !currentChat) return;

    handleTypingStop();
  }, [currentChat?.id]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <ChatSidebar
        chats={chats}
        currentChatId={currentChat?.id || null}
        currentUserId={user.id}
        typingUsersByChat={typingUsersByChat}
        users={users}
        onlineUserIds={onlineUsers}
        lastActiveTimes={lastActiveTimes}
        isGuest={isGuest}
        userName={user.name}
        unreadCounts={unreadCounts}
        friends={friends}
        pendingRequests={pendingRequests}
        sentRequests={sentRequests}
        friendLoading={friendLoading}
        onSelectChat={handleSelectChat}
        onDeleteChat={deleteChat}
        onStartDirectChat={handleStartDirectChat}
        onSendFriendRequest={sendRequest}
        onAcceptRequest={acceptRequest}
        onRejectRequest={rejectRequest}
        onLogout={handleLogout}
        onUpdateName={updateName}
      />

      <div className="flex-1 flex flex-col">
        {currentChat ? (
          <>
            <div className="bg-white border-b p-4 shadow-sm flex items-center justify-between">
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold text-gray-800">{getCurrentChatTitle()}</h1>
                {getOtherUser() ? (
                  <p className={`text-sm ${onlineUsers.has(getOtherUser()!.id) ? 'text-green-500 font-medium' : 'text-gray-500'}`}>
                    {onlineUsers.has(getOtherUser()!.id) 
                      ? 'Online' 
                      : `Last active ${formatLastActive(lastActiveTimes[getOtherUser()!.id] || getOtherUser()!.lastActiveAt)}`}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">Chat ID: {currentChat.id}</p>
                )}
                {isOtherUserTyping && (
                  <p className="text-xs text-blue-500 mt-1">typing...</p>
                )}
              </div>

              {/* Call Buttons (Only for Direct Chats) */}
              {getOtherUser() && (
                <div className="flex items-center space-x-3 mr-2">
                  <button
                    onClick={() => handleStartCall('audio')}
                    className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer border border-slate-200/50"
                    title="Start voice call"
                  >
                    <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </button>

                  <button
                    onClick={() => handleStartCall('video')}
                    className="p-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer border border-indigo-100"
                    title="Start video call"
                  >
                    <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            <MessageList
              messages={currentChat.messages}
              isLoading={isSendingMessage}
              currentUserId={user.id}
              onDeleteMessage={handleDeleteMessage}
              showTypingIndicator={isOtherUserTyping}
            />

            <MessageInput
              onSend={handleSendMessage}
              onSendFile={handleSendFile}
              isLoading={isSendingMessage}
              onTypingStart={handleTypingStart}
              onTypingStop={handleTypingStop}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Welcome to ChatApp</h2>
            <p className="text-gray-600 mb-6">
              {chats.length === 0
                ? 'Create a new chat to get started!'
                : 'Select a chat to continue'}
            </p>
            {!isGuest && !usersLoading && users.length === 0 && (
              <p className="text-sm text-gray-500 mb-6">No other users found yet.</p>
            )}
            {chats.length === 0 && (
              <button
                onClick={handleNewChat}
                disabled={isCreatingChat}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                {isCreatingChat ? 'Creating...' : 'Create First Chat'}
              </button>
            )}
          </div>
        )}
      </div>

      {incomingCall && (
        <IncomingCall
          callerName={incomingCall.callerName}
          callType={incomingCall.callType}
          onAccept={() => {
            const callId = incomingCall.callId;
            socket?.emit('call:accepted', { callId, targetSocketId: incomingCall.callerSocketId });
            setOngoingCall({
              callId,
              targetUserId: incomingCall.callerId,
              targetUserName: incomingCall.callerName,
              isIncoming: true,
              callType: incomingCall.callType
            });
            setIncomingCall(null);
          }}
          onReject={() => {
            socket?.emit('call:rejected', { callId: incomingCall.callId, targetSocketId: incomingCall.callerSocketId });
            setIncomingCall(null);
          }}
        />
      )}

      {ongoingCall && (
        <VideoCall
          callId={ongoingCall.callId}
          targetUserId={ongoingCall.targetUserId}
          targetUserName={ongoingCall.targetUserName}
          isIncoming={ongoingCall.isIncoming}
          callType={ongoingCall.callType}
          onEnd={() => setOngoingCall(null)}
        />
      )}
    </div>
  );
}

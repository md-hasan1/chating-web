'use client';

import React, { useEffect, useState } from 'react';
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
}

export default function ChatPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isGuest, logout, updateName } = useAuth();
  const { chats, currentChat, users, usersLoading, unreadCounts, fetchChats, fetchUsers, createChat, startDirectChat, selectChat, addMessage, uploadFile, deleteChat, deleteMessage } = useChat();
  const { socket, onlineUsers, lastActiveTimes } = useSocket();
  const { friends, pendingRequests, sentRequests, isLoading: friendLoading, sendRequest, acceptRequest, rejectRequest } = useFriend();
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [ongoingCall, setOngoingCall] = useState<{ callId: string; targetUserId: string; targetUserName: string; isIncoming: boolean } | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);

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

  // Listen for incoming calls
  useEffect(() => {
    if (!socket) return;

    socket.on('call:incoming', (data: IncomingCallData) => {
      setIncomingCall(data);
    });

    return () => {
      socket.off('call:incoming');
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
            <div className="bg-white border-b p-4 shadow-sm flex flex-col">
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
            </div>

            <MessageList
              messages={currentChat.messages}
              isLoading={isSendingMessage}
              currentUserId={user.id}
              onDeleteMessage={handleDeleteMessage}
            />

            <MessageInput
              onSend={handleSendMessage}
              onSendFile={handleSendFile}
              isLoading={isSendingMessage}
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
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { Chat, UserSummary } from '@/app/context/ChatContext';
import { FriendRequest, FriendRequestUser } from '@/app/context/FriendContext';
import { formatLastActive } from '@/app/utils/formatTime';

interface ChatSidebarProps {
  chats: Chat[];
  currentChatId: string | null;
  currentUserId?: string;
  users: UserSummary[];
  onlineUserIds: Set<string>;
  lastActiveTimes: Record<string, string>;
  isGuest?: boolean;
  userName?: string;
  unreadCounts: Record<string, number>;
  friends: FriendRequestUser[];
  pendingRequests: FriendRequest[];
  sentRequests: FriendRequest[];
  friendLoading: boolean;
  onSelectChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onStartDirectChat: (targetUserId: string) => void;
  onSendFriendRequest: (targetUserId: string) => void;
  onAcceptRequest: (requestId: string) => void;
  onRejectRequest: (requestId: string) => void;
  onLogout: () => void;
  onUpdateName: (newName: string) => Promise<void>;
}

type TabType = 'chats' | 'users' | 'friends' | 'requests';

export default function ChatSidebar({
  chats,
  currentChatId,
  currentUserId,
  users,
  onlineUserIds,
  lastActiveTimes,
  isGuest,
  userName,
  unreadCounts,
  friends,
  pendingRequests,
  sentRequests,
  friendLoading,
  onSelectChat,
  onDeleteChat,
  onStartDirectChat,
  onSendFriendRequest,
  onAcceptRequest,
  onRejectRequest,
  onLogout,
  onUpdateName
}: ChatSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>('chats');
  const [requestSubTab, setRequestSubTab] = useState<'pending' | 'sent'>('pending');
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(userName || '');

  React.useEffect(() => {
    if (userName) {
      setNewName(userName);
    }
  }, [userName]);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || newName.trim() === userName) {
      setIsEditingName(false);
      return;
    }
    try {
      await onUpdateName(newName.trim());
      setIsEditingName(false);
    } catch (err) {
      alert('Failed to update name');
    }
  };

  // Build a set of friend IDs for quick lookup
  const friendIds = new Set(friends.map(f => f.id));

  // Build sets of users with pending/sent requests
  const sentRequestUserIds = new Set(sentRequests.map(r => r.receiverId));
  const pendingRequestUserIds = new Set(pendingRequests.map(r => r.senderId));

  const getChatTitle = (chat: Chat) => {
    if (chat.isDirect && chat.participantIds && currentUserId) {
      const otherId = chat.participantIds.find(id => id !== currentUserId);
      const otherUser = users.find(u => u.id === otherId) || friends.find(f => f.id === otherId);
      return otherUser?.name || otherUser?.email || chat.title;
    }
    return chat.title;
  };

  const getDirectChatOtherUser = (chat: Chat) => {
    if (chat.isDirect && chat.participantIds && currentUserId) {
      const otherId = chat.participantIds.find(id => id !== currentUserId);
      return users.find(u => u.id === otherId) || friends.find(f => f.id === otherId);
    }
    return undefined;
  };

  const isOtherUserOnline = (chat: Chat): boolean | undefined => {
    const otherUser = getDirectChatOtherUser(chat);
    return otherUser ? onlineUserIds.has(otherUser.id) : undefined;
  };

  const getRequestStatus = (userId: string): string | null => {
    if (friendIds.has(userId)) return 'friends';
    if (sentRequestUserIds.has(userId)) return 'sent';
    if (pendingRequestUserIds.has(userId)) return 'pending';
    return null;
  };

  const tabs: { key: TabType; label: string; badge?: number }[] = [
    { key: 'chats', label: 'Chats', badge: chats.length },
    { key: 'friends', label: 'Friends', badge: friends.length },
    { key: 'users', label: 'Users' },
    { key: 'requests', label: 'Requests', badge: pendingRequests.length || undefined },
  ];

  return (
    <div className="w-72 bg-gray-900 text-white flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        {/* Tabs */}
        <div className="mt-3 grid grid-cols-4 gap-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative px-1 py-2 rounded-lg text-[10px] font-semibold transition-colors ${
                activeTab === tab.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && tab.key === 'requests' && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">

        {/* ===== CHATS TAB ===== */}
        {activeTab === 'chats' && (
          chats.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">
              No chats yet. Create one to get started!
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {chats.map((chat) => {
                const lastMessage = chat.messages.length > 0
                  ? chat.messages[chat.messages.length - 1]
                  : null;
                const unread = unreadCounts[chat.id] || 0;
                const isOnline = isOtherUserOnline(chat);
                const otherUser = getDirectChatOtherUser(chat);

                return (
                  <div
                    key={chat.id}
                    className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                      currentChatId === chat.id
                        ? 'bg-gray-700'
                        : 'hover:bg-gray-800'
                    }`}
                  >
                    <button
                      onClick={() => onSelectChat(chat.id)}
                      className="flex-1 text-left min-w-0 flex items-center space-x-3"
                    >
                      {/* Profile Image with Online Status */}
                      {otherUser && (
                        <div className="relative flex-shrink-0">
                          {otherUser.image ? (
                            <img 
                              src={otherUser.image} 
                              alt={otherUser.name || otherUser.email}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                              {(otherUser.name || otherUser.email)?.[0]?.toUpperCase()}
                            </div>
                          )}
                          {isOnline !== undefined && (
                            <span 
                              className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-gray-900 ${
                                isOnline ? 'bg-green-500' : 'bg-red-500'
                              }`} 
                            />
                          )}
                        </div>
                      )}

                      {/* Chat Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0 pr-2">
                            <p className="truncate text-sm font-medium">{getChatTitle(chat)}</p>
                            {otherUser && (
                              <p className="text-[10px] text-gray-500 truncate mt-0.5">
                                {isOnline ? 'Online' : `Active ${formatLastActive(lastActiveTimes[otherUser.id] || otherUser.lastActiveAt)}`}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end space-y-1 mt-0.5">
                            {lastMessage && (
                              <span className="flex-shrink-0 text-[10px] text-gray-400 whitespace-nowrap">
                                {new Date(lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            {unread > 0 && (
                              <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-green-500 rounded-full">
                                {unread > 99 ? '99+' : unread}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className={`text-xs truncate mt-1 ${unread > 0 ? 'text-gray-200 font-semibold' : 'text-gray-400'}`}>
                          {lastMessage ? lastMessage.content : 'No messages'}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChat(chat.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-600 rounded transition-all ml-1 flex-shrink-0"
                      title="Delete chat"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ===== FRIENDS TAB ===== */}
        {activeTab === 'friends' && (
          <div className="p-2">
            {friends.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-sm">
                No friends yet. Send friend requests from the Users tab!
              </div>
            ) : (
              <div className="space-y-1">
                {friends.map((friend) => (
                  <div
                    key={friend.id}
                    onClick={() => onStartDirectChat(friend.id)}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      {/* Profile Image */}
                      <div className="relative flex-shrink-0">
                        {friend.image ? (
                          <img 
                            src={friend.image} 
                            alt={friend.name || friend.email}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">
                            {(friend.name || friend.email)?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <span 
                          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-900 ${
                            onlineUserIds.has(friend.id) ? 'bg-green-500' : 'bg-red-500'
                          }`} 
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm truncate font-medium hover:underline">{friend.name || friend.email}</p>
                        <p className="text-[10px] text-gray-500 truncate">
                          {onlineUserIds.has(friend.id) ? 'Online' : `Active ${formatLastActive(lastActiveTimes[friend.id] || friend.lastActiveAt)}`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartDirectChat(friend.id);
                      }}
                      className="text-xs px-3 py-1.5 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors font-medium flex-shrink-0"
                    >
                      Message
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== USERS TAB ===== */}
        {activeTab === 'users' && (
          <div className="p-2">
            {users.length === 0 ? (
              <div className="p-3 text-xs text-gray-500">No other users yet.</div>
            ) : (
              <div className="space-y-1">
                {users.map((user) => {
                  const status = getRequestStatus(user.id);
                  const isFriend = status === 'friends';
                  return (
                    <div
                      key={user.id}
                      onClick={() => {
                        if (isFriend) {
                          onStartDirectChat(user.id);
                        }
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-800 transition-colors ${
                        isFriend ? 'cursor-pointer' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        {/* Profile Image */}
                        <div className="relative flex-shrink-0">
                          {user.image ? (
                            <img 
                              src={user.image} 
                              alt={user.name || user.email}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">
                              {(user.name || user.email)?.[0]?.toUpperCase()}
                            </div>
                          )}
                          <span 
                            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-900 ${
                              onlineUserIds.has(user.id) ? 'bg-green-500' : 'bg-red-500'
                            }`} 
                          />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm truncate ${isFriend ? 'hover:underline font-medium' : ''}`}>
                            {user.name || user.email}
                          </p>
                          <p className="text-[10px] text-gray-500 truncate">
                            {onlineUserIds.has(user.id) ? 'Online' : `Active ${formatLastActive(lastActiveTimes[user.id] || user.lastActiveAt)}`}
                          </p>
                        </div>
                      </div>
                      {status === 'friends' ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartDirectChat(user.id);
                          }}
                          className="text-xs px-3 py-1.5 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors font-medium flex-shrink-0"
                        >
                          Message
                        </button>
                      ) : status === 'sent' ? (
                        <span className="text-[10px] px-2 py-1 bg-yellow-800 text-yellow-300 rounded-lg font-medium flex-shrink-0">
                          Sent
                        </span>
                      ) : status === 'pending' ? (
                        <span className="text-[10px] px-2 py-1 bg-blue-800 text-blue-300 rounded-lg font-medium flex-shrink-0">
                          Pending
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            console.log('Add Friend button clicked for user ID:', user.id);
                            e.stopPropagation();
                            onSendFriendRequest(user.id);
                          }}
                          disabled={friendLoading}
                          className="text-xs px-2 py-1.5 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 flex-shrink-0"
                        >
                          Add Friend
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== REQUESTS TAB ===== */}
        {activeTab === 'requests' && (
          <div className="p-2">
            {/* Sub-tabs */}
            <div className="grid grid-cols-2 gap-1 mb-3">
              <button
                onClick={() => setRequestSubTab('pending')}
                className={`relative px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  requestSubTab === 'pending'
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-750'
                }`}
              >
                Pending
                {pendingRequests.length > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-[9px] font-bold min-w-[14px] h-3.5 rounded-full inline-flex items-center justify-center px-1">
                    {pendingRequests.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setRequestSubTab('sent')}
                className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  requestSubTab === 'sent'
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-750'
                }`}
              >
                My Requests ({sentRequests.length})
              </button>
            </div>

            {/* Pending requests (received) */}
            {requestSubTab === 'pending' && (
              pendingRequests.length === 0 ? (
                <div className="p-3 text-center text-gray-500 text-xs">No pending requests</div>
              ) : (
                <div className="space-y-2">
                  {pendingRequests.map((req) => (
                    <div key={req.id} className="p-3 bg-gray-800 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        {/* Profile Image */}
                        <div className="relative flex-shrink-0">
                          {req.sender.image ? (
                            <img 
                              src={req.sender.image} 
                              alt={req.sender.name || req.sender.email}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                              {(req.sender.name || req.sender.email)?.[0]?.toUpperCase()}
                            </div>
                          )}
                          <span 
                            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-gray-800 ${
                              onlineUserIds.has(req.sender.id) ? 'bg-green-500' : 'bg-red-500'
                            }`} 
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium truncate">{req.sender.name || req.sender.email}</p>
                          <p className="text-[10px] text-gray-400 truncate">Active {formatLastActive(lastActiveTimes[req.sender.id] || req.sender.lastActiveAt)}</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 mb-2">wants to be your friend</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            console.log('Accept button clicked for request ID:', req.id);
                            onAcceptRequest(req.id);
                          }}
                          disabled={friendLoading}
                          className="flex-1 text-xs px-2 py-1.5 bg-green-600 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => {
                            console.log('Reject button clicked for request ID:', req.id);
                            onRejectRequest(req.id);
                          }}
                          disabled={friendLoading}
                          className="flex-1 text-xs px-2 py-1.5 bg-red-600 rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Sent requests (my requests) */}
            {requestSubTab === 'sent' && (
              sentRequests.length === 0 ? (
                <div className="p-3 text-center text-gray-500 text-xs">No sent requests</div>
              ) : (
                <div className="space-y-1">
                  {sentRequests.map((req) => (
                    <div key={req.id} className="flex items-center justify-between p-2.5 bg-gray-800 rounded-lg">
                      <div className="flex items-center space-x-2 min-w-0">
                        {/* Profile Image */}
                        <div className="relative flex-shrink-0">
                          {req.receiver.image ? (
                            <img 
                              src={req.receiver.image} 
                              alt={req.receiver.name || req.receiver.email}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                              {(req.receiver.name || req.receiver.email)?.[0]?.toUpperCase()}
                            </div>
                          )}
                          <span 
                            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-gray-800 ${
                              onlineUserIds.has(req.receiver.id) ? 'bg-green-500' : 'bg-red-500'
                            }`} 
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{req.receiver.name || req.receiver.email}</p>
                          <p className="text-[10px] text-gray-400 truncate">Active {formatLastActive(lastActiveTimes[req.receiver.id] || req.receiver.lastActiveAt)}</p>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-1 bg-yellow-800 text-yellow-300 rounded-lg font-medium flex-shrink-0">
                        Pending
                      </span>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700 space-y-3">
        <div className="text-xs text-gray-400 px-2">
          {isEditingName ? (
            <form onSubmit={handleUpdateName} className="flex items-center space-x-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-gray-800 text-white border border-gray-600 rounded px-1.5 py-0.5 w-full text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                autoFocus
              />
              <button type="submit" className="text-[10px] text-green-400 font-bold hover:text-green-300">Save</button>
              <button type="button" onClick={() => { setIsEditingName(false); setNewName(userName || ''); }} className="text-[10px] text-red-400 font-bold hover:text-red-300">✕</button>
            </form>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 min-w-0">
                <span className="truncate max-w-[120px] font-semibold text-gray-200">{userName || 'User'}</span>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="text-gray-500 hover:text-gray-200 transition-colors"
                  title="Edit display name"
                >
                  ✏️
                </button>
              </div>
              {isGuest && <span className="bg-yellow-600 text-white px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0">Guest</span>}
            </div>
          )}
        </div>
        <button
          onClick={onLogout}
          className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

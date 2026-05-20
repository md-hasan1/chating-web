'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Message } from '@/app/context/ChatContext';

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  currentUserId?: string;
  onDeleteMessage?: (messageId: string, scope: 'me' | 'everyone') => void;
}

export default function MessageList({ messages, isLoading, currentUserId, onDeleteMessage }: MessageListProps) {
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [openMenuMessageId, setOpenMenuMessageId] = useState<string | null>(null);

  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!openMenuMessageId) return;
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuMessageId(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [openMenuMessageId]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-500">
          <p>No messages yet. Start a conversation!</p>
        </div>
      ) : (
        messages.map((message, index) => {
          const isOwnMessage = currentUserId ? message.userId === currentUserId : message.role === 'user';

          return (
            <div
              key={message.id}
              className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
            >
              <div ref={openMenuMessageId === message.id ? menuRef : null} className="group relative max-w-xs lg:max-w-md">
                <button
                  type="button"
                  onClick={() => setOpenMenuMessageId(prev => prev === message.id ? null : message.id)}
                  className={`absolute -top-2 right-1 z-10 rounded-full bg-black/20 px-2 py-0.5 text-xs text-white transition-opacity ${openMenuMessageId === message.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                  aria-label="Message options"
                >
                  ⋯
                </button>
                {openMenuMessageId === message.id && onDeleteMessage && (
                  <div className={`absolute top-8 z-20 w-40 rounded-lg border border-gray-200 bg-white p-1 shadow-lg ${isOwnMessage ? 'right-0' : 'left-0'}`}>
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteMessage(message.id, 'me');
                        setOpenMenuMessageId(null);
                      }}
                      className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Delete for me
                    </button>
                    {isOwnMessage && (
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteMessage(message.id, 'everyone');
                          setOpenMenuMessageId(null);
                        }}
                        className="w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      >
                        Delete for everyone
                      </button>
                    )}
                  </div>
                )}
                <div
                  className={`relative px-4 py-2 rounded-lg ${
                    isOwnMessage
                      ? 'bg-blue-500 text-white rounded-br-none'
                      : 'bg-gray-200 text-gray-900 rounded-bl-none'
                  }`}
                >
                  <p className="text-sm pr-6">{message.content}</p>
                  <span className="text-xs opacity-70">
                    {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {isOwnMessage && index === messages.length - 1 && (
                  <div className="text-[10px] text-gray-400 mt-1 flex justify-end">
                    {message.seenAt ? (
                      <span>Seen {new Date(message.seenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    ) : message.deliveredAt ? (
                      <span>Delivered</span>
                    ) : (
                      <span>Sent</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg rounded-bl-none">
            <div className="flex space-x-2">
              <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce"></div>
              <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        </div>
      )}
      <div ref={endOfMessagesRef} />
    </div>
  );
}

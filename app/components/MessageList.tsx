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
                  {message.fileUrl ? (
                    <div className="space-y-2 mb-1">
                      {message.fileType === 'image' && (
                        <div className="relative group overflow-hidden rounded-md">
                          <img
                            src={message.fileUrl}
                            alt={message.content || 'Image'}
                            className="max-h-60 max-w-full rounded-md object-contain cursor-pointer hover:scale-[1.02] transition-transform duration-200"
                            onClick={() => window.open(message.fileUrl, '_blank')}
                          />
                        </div>
                      )}
                      {message.fileType === 'video' && (
                        <video
                          src={message.fileUrl}
                          controls
                          className="max-h-60 max-w-full rounded-md"
                        />
                      )}
                      {message.fileType !== 'image' && message.fileType !== 'video' && (
                        <a
                          href={message.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center space-x-2 p-3 rounded-lg border transition-all ${
                            isOwnMessage
                              ? 'bg-blue-600 border-blue-400 text-white hover:bg-blue-700'
                              : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-50'
                          }`}
                        >
                          <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div className="overflow-hidden">
                            <p className="text-sm font-semibold truncate max-w-[180px]">{message.content}</p>
                            <p className="text-[10px] opacity-75">Click to download</p>
                          </div>
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm pr-6 break-words whitespace-pre-wrap">{message.content}</p>
                  )}
                  <span className="text-[10px] opacity-70 block text-right mt-1">
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

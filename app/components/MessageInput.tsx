'use client';

import React, { useState } from 'react';

interface MessageInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
}

export default function MessageInput({ onSend, isLoading }: MessageInputProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSend(message);
      setMessage('');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        borderTop: '1px solid #1e1e2e',
        padding: '14px 20px',
        background: 'linear-gradient(to top, #0d0d0d, #1a1a2e)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '12px 18px',
            backgroundColor: '#111118',
            border: '1px solid #2a2a3a',
            borderRadius: '24px',
            color: '#ffffff',
            fontSize: '15px',
            outline: 'none',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            boxShadow: '0 0 0 0 rgba(99, 102, 241, 0)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#6366f1';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.25)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#2a2a3a';
            e.currentTarget.style.boxShadow = '0 0 0 0 rgba(99, 102, 241, 0)';
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !message.trim()}
          style={{
            padding: '12px 24px',
            background: isLoading || !message.trim()
              ? '#2a2a3a'
              : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: isLoading || !message.trim() ? '#555' : '#ffffff',
            border: 'none',
            borderRadius: '24px',
            fontSize: '15px',
            fontWeight: 600,
            cursor: isLoading || !message.trim() ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: isLoading || !message.trim()
              ? 'none'
              : '0 4px 14px rgba(99, 102, 241, 0.4)',
          }}
          onMouseEnter={(e) => {
            if (!isLoading && message.trim()) {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.5)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = isLoading || !message.trim()
              ? 'none'
              : '0 4px 14px rgba(99, 102, 241, 0.4)';
          }}
        >
          {isLoading ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
          <span>{isLoading ? 'Sending' : 'Send'}</span>
        </button>
      </div>
    </form>
  );
}

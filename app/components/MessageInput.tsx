'use client';

import React, { useState } from 'react';

interface MessageInputProps {
  onSend: (message: string) => void;
  onSendFile: (file: File) => Promise<void>;
  isLoading?: boolean;
}

export default function MessageInput({ onSend, onSendFile, isLoading }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading && !isUploading) {
      onSend(message);
      setMessage('');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    e.target.value = '';
    
    try {
      setIsUploading(true);
      await onSendFile(file);
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const isInputDisabled = isLoading || isUploading;

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
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: '#111118',
            border: '1px solid #2a2a3a',
            color: '#a0a0b0',
            cursor: isInputDisabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            flexShrink: 0
          }}
          onMouseEnter={(e) => {
            if (!isInputDisabled) {
              e.currentTarget.style.borderColor = '#6366f1';
              e.currentTarget.style.color = '#ffffff';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#2a2a3a';
            e.currentTarget.style.color = '#a0a0b0';
          }}
        >
          <input
            type="file"
            disabled={isInputDisabled}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          {isUploading ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
              <circle cx="12" cy="12" r="10" stroke="#6366f1" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          )}
        </label>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          disabled={isInputDisabled}
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
          disabled={isInputDisabled || !message.trim()}
          style={{
            padding: '12px 24px',
            background: isInputDisabled || !message.trim()
              ? '#2a2a3a'
              : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: isInputDisabled || !message.trim() ? '#555' : '#ffffff',
            border: 'none',
            borderRadius: '24px',
            fontSize: '15px',
            fontWeight: 600,
            cursor: isInputDisabled || !message.trim() ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: isInputDisabled || !message.trim()
              ? 'none'
              : '0 4px 14px rgba(99, 102, 241, 0.4)',
          }}
          onMouseEnter={(e) => {
            if (!isInputDisabled && message.trim()) {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.5)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = isInputDisabled || !message.trim()
              ? 'none'
              : '0 4px 14px rgba(99, 102, 241, 0.4)';
          }}
        >
          {isInputDisabled ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
          <span>{isInputDisabled ? 'Sending' : 'Send'}</span>
        </button>
      </div>
    </form>
  );
}

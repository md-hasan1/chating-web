'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export interface Toast {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface ToastContextType {
  showToast: (title: string, message: string, type?: Toast['type']) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((title: string, message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, title, message, type }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none max-w-sm w-full">
        {toasts.map(toast => {
          const typeStyles = {
            success: 'bg-green-900/90 border-green-700 text-green-100 shadow-green-950/20',
            error: 'bg-red-900/90 border-red-700 text-red-100 shadow-red-950/20',
            warning: 'bg-yellow-900/90 border-yellow-700 text-yellow-100 shadow-yellow-950/20',
            info: 'bg-indigo-900/90 border-indigo-700 text-indigo-100 shadow-indigo-950/20'
          }[toast.type];

          const typeIcon = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
          }[toast.type];

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto p-4 rounded-xl border backdrop-blur-md shadow-lg transform transition-all duration-300 ease-out animate-slide-in flex items-start space-x-3 ${typeStyles}`}
            >
              <span className="text-lg flex-shrink-0">{typeIcon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{toast.title}</p>
                <p className="text-xs text-gray-300 mt-0.5">{toast.message}</p>
              </div>
              <button
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="text-gray-400 hover:text-white transition-colors text-xs font-bold leading-none p-1"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

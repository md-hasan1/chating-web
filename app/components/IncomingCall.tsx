'use client';

import React from 'react';

interface IncomingCallProps {
  callerName: string;
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingCall({ callerName, onAccept, onReject }: IncomingCallProps) {
  return (
    <div className="fixed bottom-6 right-6 bg-white rounded-lg shadow-2xl p-6 z-40 animate-bounce">
      <div className="text-center">
        <p className="text-gray-600 mb-2">Incoming call from</p>
        <h3 className="text-2xl font-bold text-gray-900 mb-6">{callerName}</h3>

        <div className="flex gap-4">
          <button
            onClick={onReject}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full font-medium transition-colors"
          >
            ❌ Reject
          </button>
          <button
            onClick={onAccept}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-full font-medium transition-colors"
          >
            ✅ Accept
          </button>
        </div>
      </div>
    </div>
  );
}

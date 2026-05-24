'use client';

import React from 'react';

interface IncomingCallProps {
  callerName: string;
  callType: 'audio' | 'video';
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingCall({ callerName, callType, onAccept, onReject }: IncomingCallProps) {
  const callerFirstLetter = callerName.charAt(0).toUpperCase();

  return (
    <div className="fixed bottom-6 right-6 md:right-10 bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_10px_50px_rgba(0,0,0,0.5)] p-5 z-50 w-full max-w-[340px] md:max-w-[360px] animate-bounce select-none">
      <div className="flex items-center space-x-4">
        {/* Pulsing Avatar */}
        <div className="relative">
          <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping scale-110"></div>
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center border border-white/10 shadow-lg">
            <span className="text-2xl font-bold text-white tracking-wide">{callerFirstLetter}</span>
          </div>
        </div>

        {/* Call Info */}
        <div className="flex-1 min-w-0">
          <h4 className="text-base font-bold text-slate-100 truncate leading-tight">{callerName}</h4>
          <p className="text-xs text-indigo-400 font-semibold tracking-wide mt-0.5 uppercase flex items-center">
            {callType === 'video' ? (
              <>
                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Incoming video call
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Incoming audio call
              </>
            )}
          </p>
        </div>
      </div>

      {/* Control Actions */}
      <div className="flex gap-3 mt-5">
        <button
          onClick={onReject}
          className="flex-1 py-2.5 px-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold text-xs rounded-xl border border-red-500/30 transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.05)]"
        >
          <svg className="w-4 h-4 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
          </svg>
          Decline
        </button>
        <button
          onClick={onAccept}
          className="flex-1 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition-all duration-200 active:scale-95 flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
          </svg>
          Answer
        </button>
      </div>
    </div>
  );
}

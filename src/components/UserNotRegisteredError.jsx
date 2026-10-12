import React from 'react';

export default function UserNotRegisteredError() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#121417] text-white p-6">
      <div className="max-w-md w-full p-8 bg-[#1e2227] rounded-xl border border-[#2a2f37]">
        <h1 className="text-2xl font-bold mb-4 text-amber-400">Access Restricted</h1>
        <p className="text-slate-300 mb-6">
          You are not registered to use this application. Please contact the administrator.
        </p>
        <button
          onClick={() => (window.location.href = '/')}
          className="w-full bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white py-2 rounded-lg"
        >
          Return Home
        </button>
      </div>
    </div>
  );
}

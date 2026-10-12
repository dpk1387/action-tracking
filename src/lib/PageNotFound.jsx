import React from 'react';
import { useLocation } from 'react-router-dom';

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.substring(1);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#121417] text-white">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-7xl font-light text-slate-600">404</h1>
          <div className="h-0.5 w-16 bg-slate-700 mx-auto"></div>
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-medium text-slate-200">
            Page Not Found
          </h2>
          <p className="text-slate-400 leading-relaxed">
            The page <span className="font-medium text-slate-300">"{pageName}"</span> could not be found.
          </p>
        </div>
        <div className="pt-6">
          <button
            onClick={() => (window.location.href = '/')}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-[#2a2f37] hover:bg-[#363c45] rounded-lg transition-colors"
          >
            Go to Poker Tracker
          </button>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { Power, Save, Trash2, ArrowLeft, X, AlertTriangle } from 'lucide-react';

export default function DirectorEndSessionDialog({
  isOpen,
  onClose,
  onSaveSession,
  onDiscardSession,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl text-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Power size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">End Tournament Session</h2>
              <div className="text-xs text-slate-400">Choose how to conclude this session</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Options */}
        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            Would you like to save this tournament session and view the results, discard all tournament progress, or return back to the director screen?
          </p>

          {/* Option 1: Save Session */}
          <button
            type="button"
            onClick={onSaveSession}
            className="w-full flex items-center gap-3.5 p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 hover:bg-emerald-900/50 text-left transition-all cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
              <Save size={18} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                Save Session
              </div>
              <div className="text-xs text-slate-400">
                Preserve tournament records, standings, and payouts, then return home
              </div>
            </div>
          </button>

          {/* Option 2: Discard Session */}
          <button
            type="button"
            onClick={onDiscardSession}
            className="w-full flex items-center gap-3.5 p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/40 hover:bg-rose-900/40 text-left transition-all cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 group-hover:scale-105 transition-transform">
              <Trash2 size={18} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-white group-hover:text-rose-300 transition-colors">
                Discard Session
              </div>
              <div className="text-xs text-slate-400">
                Wipe all tournament state and clock progress without saving
              </div>
            </div>
          </button>

          {/* Option 3: Go Back */}
          <button
            type="button"
            onClick={onClose}
            className="w-full flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 hover:bg-slate-800 text-left transition-all cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-lg bg-slate-700/40 border border-slate-600/40 flex items-center justify-center text-slate-300 shrink-0 group-hover:scale-105 transition-transform">
              <ArrowLeft size={18} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-white group-hover:text-slate-200 transition-colors">
                Go Back
              </div>
              <div className="text-xs text-slate-400">
                Resume directing the tournament without ending the session
              </div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900/60 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

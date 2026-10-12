import React, { useState } from 'react';
import { X, Save, Trash2, Play } from 'lucide-react';

export default function EndSessionDialog({ onSave, onDiscard, onClose, saving }) {
  const [busy, setBusy] = useState(false);
  const handleSave = async () => {
    setBusy(true);
    try { await onSave(); } finally { setBusy(false); }
  };
  const handleDiscard = async () => {
    setBusy(true);
    try { await onDiscard(); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#2a2f37] bg-[#1e2227] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">End session?</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <p className="text-sm text-slate-400 mb-5">Save it to resume later, discard it, or go back to the table.</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={handleSave}
            disabled={busy || saving}
            className="w-full rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm py-2.5 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Save size={16} /> {busy ? 'Saving…' : 'Save for later'}
          </button>
          <button
            onClick={handleDiscard}
            disabled={busy}
            className="w-full rounded-lg bg-[#c94c4c] hover:bg-[#d95959] text-white text-sm py-2.5 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Trash2 size={16} /> Discard session
          </button>
          <button
            onClick={onClose}
            disabled={busy}
            className="w-full rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-slate-300 text-sm py-2.5 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Play size={16} /> Continue playing
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { X, Users, Check, AlertCircle, FileText, Trash2 } from 'lucide-react';

export default function DirectorRosterModal({
  isOpen,
  onClose,
  remainingPlayers = 0,
  players = [],
  onSaveNames,
}) {
  const [namesText, setNamesText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Extract current active player names on open
  useEffect(() => {
    if (!isOpen) return;
    const active = (players || []).filter((p) => !p.eliminated && p.status !== 'eliminated');
    const existing = active.map((p) => p.name).filter(Boolean);
    if (existing.length > 0) {
      setNamesText(existing.join('\n'));
    } else {
      setNamesText('');
    }
    setErrorMsg('');
  }, [isOpen, players]);

  const parsedLines = useMemo(() => {
    return namesText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }, [namesText]);

  const handleSave = (e) => {
    e?.preventDefault();
    if (parsedLines.length === 0) {
      setErrorMsg('Please enter at least one player name.');
      return;
    }
    onSaveNames(parsedLines);
    onClose();
  };

  const handleClear = () => {
    setNamesText('');
    setErrorMsg('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-[#161c28]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Users size={19} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Enter Player Names</h2>
              <p className="text-xs text-slate-400">
                List of all remaining players approaching the money (one per line)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3.5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-600/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <FileText size={14} className="text-emerald-400" />
              <span>Enter or paste active player names:</span>
            </span>
            {namesText && (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Trash2 size={12} /> Clear
              </button>
            )}
          </div>

          <div className="relative">
            <textarea
              rows={10}
              value={namesText}
              onChange={(e) => {
                setNamesText(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder={`Phil Ivey\nDaniel Negreanu\nErik Seidel\nJustin Bonomo\nBryn Kenney\n...`}
              className="w-full bg-[#0e1219] border border-slate-700/80 rounded-xl p-3 text-white text-xs font-mono leading-relaxed focus:outline-none focus:border-emerald-500 shadow-inner"
            />
          </div>

          {/* Status summary */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-300">
                {parsedLines.length} {parsedLines.length === 1 ? 'player' : 'players'} entered
              </span>
              {remainingPlayers > 0 && (
                <span className="text-slate-500">
                  (Field Remaining: {remainingPlayers})
                </span>
              )}
            </div>
            {parsedLines.length > 0 && remainingPlayers > 0 && parsedLines.length !== remainingPlayers && (
              <span className="text-[11px] text-amber-400 font-medium">
                Field will adjust to {parsedLines.length}
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-slate-800 bg-[#161c28]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-300 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Check size={14} />
            Save Player Names
          </button>
        </div>
      </div>
    </div>
  );
}

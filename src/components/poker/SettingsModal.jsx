import React from 'react';
import { Settings, X } from 'lucide-react';
import { ROUNDING_OPTIONS } from '@/lib/goMode';

export default function SettingsModal({ isOpen, onClose, settings, onUpdateSettings, isGoMode }) {
  if (!isOpen) return null;

  const isBB = settings.displayUnit === 'bb';
  const is4Color = settings.suitColors === 4;
  const isLastAction = settings.actionDisplayMode === 'last_action' || settings.actionDisplayMode === 'last_only';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#181d24] border border-slate-700/80 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#12161c]">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Settings size={18} className="text-amber-400" />
            <span>{isGoMode ? 'GO Mode Settings' : 'Display Settings'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3.5 text-xs">
          {/* Custom Session Name */}
          <div className="space-y-1 pb-1">
            <div className="font-bold text-white">Session Name (Optional)</div>
            <input
              type="text"
              value={settings.sessionName || ''}
              onChange={(e) => onUpdateSettings({ sessionName: e.target.value })}
              placeholder="e.g. Friday Night Game"
              className="w-full bg-[#12161c] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs font-semibold focus:outline-none focus:border-amber-400 placeholder:text-slate-500"
            />
          </div>
          {!isGoMode && (
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-white">Amounts</div>
                <div className="text-[11px] text-slate-400">Show or hide chip/money values</div>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSettings({ hideAmounts: !settings.hideAmounts })}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer border ${
                  settings.hideAmounts
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {settings.hideAmounts ? 'Hidden' : 'Shown'}
              </button>
            </div>
          )}

          {isGoMode && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-white">Stack Approximation</div>
                  <div className="text-[11px] text-slate-400">Approximate opponent stacks to nearest denomination</div>
                </div>
                <select
                  value={settings.stackRounding ?? 100}
                  onChange={(e) => {
                    const val = e.target.value === 'exact' ? 'exact' : Number(e.target.value);
                    onUpdateSettings({ stackRounding: val });
                  }}
                  className="bg-[#12161c] border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-bold"
                >
                  {ROUNDING_OPTIONS.map((opt) => (
                    <option key={String(opt.value)} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
                <div>
                  <div className="font-bold text-white">Game Security</div>
                  <div className="text-[11px] text-slate-400">Turn lock between every player action</div>
                </div>
                <select
                  value={settings.goSecurityMode || 'modal'}
                  onChange={(e) => onUpdateSettings({ goSecurityMode: e.target.value })}
                  className="bg-[#12161c] border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-bold"
                >
                  <option value="modal">Verification Modal</option>
                  <option value="hold">Hold to Confirm</option>
                  <option value="passkey">Passkey System (2-digit)</option>
                  <option value="pin">PIN System (6-digit, lockout)</option>
                </select>
              </div>
            </>
          )}

          {/* Hide / Show Position */}
          <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
            <div>
              <div className="font-bold text-white">Player Positions</div>
              <div className="text-[11px] text-slate-400">Show or hide position badges</div>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ showPosition: !settings.showPosition })}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer border ${
                settings.showPosition
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {settings.showPosition ? 'Shown' : 'Hidden'}
            </button>
          </div>

          {/* Stack Units */}
          <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
            <div>
              <div className="font-bold text-white">Stack Units</div>
              <div className="text-[11px] text-slate-400">Display in Chips or Big Blinds</div>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ displayUnit: isBB ? 'chips' : 'bb' })}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer border ${
                isBB
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {isBB ? 'Big Blinds (BB)' : 'Chips'}
            </button>
          </div>

          {/* Suit Colors */}
          <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
            <div>
              <div className="font-bold text-white">Suit Colors</div>
              <div className="text-[11px] text-slate-400">2-color (Red/Black) or 4-color</div>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ suitColors: is4Color ? 2 : 4 })}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer border ${
                is4Color
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {is4Color ? '4 Colors' : '2 Colors'}
            </button>
          </div>

          {!isGoMode && (
            <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
              <div>
                <div className="font-bold text-white">Action Display</div>
                <div className="text-[11px] text-slate-400">Show all actions or last action only</div>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSettings({ actionDisplayMode: isLastAction ? 'all' : 'last_action' })}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer border ${
                  isLastAction
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {isLastAction ? 'Last Action Only' : 'All Action'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-[#12161c] border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs cursor-pointer shadow"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

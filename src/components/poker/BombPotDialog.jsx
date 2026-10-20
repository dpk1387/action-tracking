import React, { useState } from 'react';
import { X, Flame, Layers, Dices } from 'lucide-react';
import { money } from '@/lib/poker';

export const BOMB_POT_VARIANTS = [
  { id: 'plo6', label: 'PLO6 (Omaha 6 - 6 hole cards)', holeSize: 6 },
  { id: 'plo5', label: 'PLO5 (Omaha 5 - 5 hole cards)', holeSize: 5 },
  { id: 'plo4', label: 'PLO4 (Omaha 4 - 4 hole cards)', holeSize: 4 },
  { id: 'nlh', label: "NLH (No-Limit Hold'em - 2 hole cards)", holeSize: 2 },
  { id: 'crazy_pineapple', label: 'Crazy Pineapple (3 hole cards, discard after flop)', holeSize: 3 },
  { id: 'super_holdem', label: "Super Hold'em (3 hole cards, keep all 3)", holeSize: 3 },
  {
    id: 'dramaha',
    label: 'Dramaha (5 hole cards: 1/2 best PLO5 hand, 1/2 best 5-card draw hand)',
    holeSize: 5,
  },
];

export default function BombPotDialog({
  isOpen,
  bigBlind = 2,
  currency = '$',
  onConfirm,
  onClose,
}) {
  const [variant, setVariant] = useState('plo6'); // Default PLO6
  const [boardCount, setBoardCount] = useState(2); // Default Double Board
  const [anteAmount, setAnteAmount] = useState(bigBlind * 5 || 10);

  if (!isOpen) return null;

  const handleApply = (immediate = false) => {
    onConfirm({
      variant,
      boardCount: Number(boardCount) || 2,
      anteAmount: Number(anteAmount) || (bigBlind * 5),
      immediate,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl border border-amber-600/40 bg-[#161a22] p-6 shadow-2xl text-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2.5 text-amber-400 font-bold text-lg">
            <Flame className="text-amber-500 animate-pulse" size={22} />
            <span>Configure Bomb Pot</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            In a Bomb Pot, all players post a pre-determined ante and immediately see the flop with no preflop betting. Select your variant and number of boards below:
          </p>

          {/* 1. Variant Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Dices size={14} className="text-amber-400" />
              <span>Poker Variant</span>
            </label>
            <select
              value={variant}
              onChange={(e) => setVariant(e.target.value)}
              className="w-full rounded-xl bg-[#0f131a] border border-slate-700 px-3 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none"
            >
              {BOMB_POT_VARIANTS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Number of Boards Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Layers size={14} className="text-amber-400" />
              <span>Number of Boards</span>
            </label>
            <select
              value={boardCount}
              onChange={(e) => setBoardCount(Number(e.target.value))}
              className="w-full rounded-xl bg-[#0f131a] border border-slate-700 px-3 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none"
            >
              <option value={1}>1 Board (Single Board)</option>
              <option value={2}>2 Boards (Double Board) — Default</option>
              <option value={3}>3 Boards (Triple Board)</option>
            </select>
            <span className="text-[11px] text-slate-400 block">
              Default is PLO6 Double Board. Pots will be split equally across all active boards.
            </span>
          </div>

          {/* 3. Bomb Pot Ante Amount */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Bomb Pot Ante (Per Player)</span>
              <span className="text-[11px] text-slate-400 font-normal">
                Suggested: 5x BB = {money(bigBlind * 5, currency)}
              </span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-400">{currency}</span>
              <input
                type="number"
                min="1"
                value={anteAmount}
                onChange={(e) => setAnteAmount(e.target.value)}
                className="w-full rounded-xl bg-[#0f131a] border border-slate-700 px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row items-center gap-2 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={() => handleApply(false)}
            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-600 font-bold text-white text-xs cursor-pointer transition-colors shadow-md flex items-center justify-center gap-1.5"
          >
            <span>Set for Next Hand</span>
          </button>
          <button
            type="button"
            onClick={() => handleApply(true)}
            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 font-bold text-white text-xs cursor-pointer transition-colors shadow-md flex items-center justify-center gap-1.5"
          >
            <span>Deal Bomb Pot Now</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto py-2.5 px-4 rounded-xl border border-slate-700 hover:bg-slate-800 font-medium text-slate-300 text-xs cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

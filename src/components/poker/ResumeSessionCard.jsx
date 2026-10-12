import React from 'react';
import { Play, Plus, Clock, Users } from 'lucide-react';
import { money, VARIANTS } from '@/lib/poker';

export default function ResumeSessionCard({ saved, updatedAt, onResume, onNew }) {
  const hand = saved?.hand;
  if (!hand) return null;
  const variant = hand.variant || 'nlh';
  const players = (hand.players || []).map((p) => p.name);

  return (
    <div className="w-full max-w-md rounded-2xl border border-[#4a5a4a] bg-[#1e2227] p-6 shadow-2xl">
      <div className="flex items-center gap-2 text-emerald-300 mb-1">
        <Clock size={16} />
        <span className="text-sm font-semibold uppercase tracking-wide">Saved session in progress</span>
      </div>
      <h2 className="text-xl font-semibold text-white mb-1">
        {VARIANTS[variant]?.label || "Hold'em"} – Hand #{hand.handNumber}
      </h2>
      <div className="text-sm text-slate-400 mb-1">
        {hand.mode === 'cash' ? 'Cash game' : 'Tournament'} – Blinds {money(hand.smallBlind, hand.currency)} / {money(hand.bigBlind, hand.currency)}
      </div>
      {updatedAt && (
        <div className="text-xs text-slate-500 mb-3">Last saved {new Date(updatedAt).toLocaleString()}</div>
      )}
      <div className="flex items-start gap-2 text-sm text-slate-300 mb-5">
        <Users size={16} className="mt-0.5 text-slate-500" />
        <span>{players.join(', ') || 'No players'}</span>
      </div>
      <div className="flex flex-col gap-2">
        <button onClick={onResume} className="w-full rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm py-2.5 flex items-center justify-center gap-2 cursor-pointer">
          <Play size={16} /> Resume session
        </button>
        <button onClick={onNew} className="w-full rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-slate-300 text-sm py-2.5 flex items-center justify-center gap-2 cursor-pointer">
          <Plus size={16} /> Start new session
        </button>
      </div>
    </div>
  );
}

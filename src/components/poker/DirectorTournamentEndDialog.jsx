import React from 'react';
import { Trophy, Award, Home, RotateCcw, X, Users, DollarSign } from 'lucide-react';

export default function DirectorTournamentEndDialog({
  isOpen,
  onClose,
  directorState,
  onContinueHome,
  onResetTournament,
}) {
  if (!isOpen) return null;

  const mtt = directorState || {};
  const currency = mtt.currency || '$';
  const eliminations = mtt.eliminations || [];
  const payouts = mtt.payouts || [];
  const players = mtt.players || [];

  // Determine winner: player not eliminated
  const eliminatedNames = new Set(eliminations.map((e) => e.name));
  const alivePlayer = players.find((p) => !eliminatedNames.has(p.name)) || {
    name: 'Tournament Champion',
  };
  const winnerName = alivePlayer.name;
  const firstPlacePayout = payouts.find((p) => p.place === 1)?.amount || 0;
  const totalEntries = (mtt.totalPlayers || 0) + (mtt.reEntries || 0);
  const totalPool = mtt.totalPrizePool || totalEntries * (mtt.buyIn || 100);

  // Construct full standings list
  // 1st place: winner
  const standings = [
    {
      place: 1,
      placeLabel: '1st (Champion)',
      name: winnerName,
      payout: firstPlacePayout,
      isWinner: true,
    },
    ...eliminations.map((e) => ({
      place: e.place,
      placeLabel: e.placeLabel || `${e.place}th`,
      name: e.name,
      payout: e.payout || 0,
      isWinner: false,
    })),
  ].sort((a, b) => a.place - b.place);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#12161f] border border-emerald-500/40 rounded-3xl w-full max-w-xl shadow-[0_0_50px_rgba(16,185,129,0.2)] text-slate-200 overflow-hidden my-auto">
        {/* Banner */}
        <div className="bg-gradient-to-b from-emerald-950/80 to-[#12161f] p-6 text-center border-b border-slate-800">
          <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-3 shadow-lg animate-bounce">
            <Trophy size={36} />
          </div>
          <div className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-1">
            Tournament Concluded
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            {winnerName}
          </h1>
          <div className="text-sm font-semibold text-amber-300 font-mono mt-1">
            Champion · {currency}{firstPlacePayout.toLocaleString()}
          </div>

          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-slate-400 font-mono">
            <span>Total Field: {totalEntries} Entries</span>
            <span>·</span>
            <span>Prize Pool: {currency}{totalPool.toLocaleString()}</span>
          </div>
        </div>

        {/* Results List */}
        <div className="p-6 space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Final Standings & Payouts</span>
            <span className="text-[11px] text-emerald-400">{payouts.length} Places Paid</span>
          </div>

          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {standings.map((s, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-mono transition-colors ${
                  s.isWinner
                    ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
                    : s.payout > 0
                    ? 'bg-slate-900/60 border-slate-700/60 text-slate-200'
                    : 'bg-[#181d26] border-slate-800/80 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`font-bold w-12 ${
                      s.isWinner ? 'text-amber-400' : s.payout > 0 ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    {s.placeLabel}
                  </span>
                  <span className="font-semibold text-white">{s.name}</span>
                </div>
                <div className="text-right">
                  {s.payout > 0 ? (
                    <span className="font-bold text-emerald-400">
                      {currency}{s.payout.toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-slate-600">-</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onContinueHome}
              className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all"
            >
              <Home size={16} /> Continue to Home Screen
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-medium text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              Review Clock Screen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useMemo, useEffect } from 'react';
import { X } from 'lucide-react';
import { money } from '@/lib/poker';
import { levelTimerState, formatTimer } from '@/lib/levelTimer';

function calcOddChips(stack, retired, replacement) {
  if (retired <= 0 || replacement <= 0 || stack <= 0) return 0;
  const precision = Math.max(
    (retired.toString().split('.')[1] || '').length,
    (replacement.toString().split('.')[1] || '').length,
    (stack.toString().split('.')[1] || '').length
  );
  const factor = Math.pow(10, Math.min(precision, 6));
  const sInt = Math.round(stack * factor);
  const repInt = Math.round(replacement * factor);
  const retInt = Math.round(retired * factor);

  if (repInt <= 0 || retInt <= 0) return 0;
  const rem = sInt % repInt;
  return Math.round(rem / retInt);
}

export default function BreakDialog({ hand, onChipRace, onResume, onClose, now, race: raceOverride, dismissOverride }) {
  const brkItem = (hand?.blindSchedule || [])[hand?.tLevel];
  const race = raceOverride || brkItem?.race;
  const retired = Number(race?.retired) || 0;
  const replacement = Number(race?.replacement) || 0;
  const hasRace = !!race && retired > 0 && replacement > 0;

  const autoOddChips = useMemo(() => {
    if (!hasRace) return [];
    return (hand?.players || []).map((p) => {
      const stack = Number(p.stack) || 0;
      return calcOddChips(stack, retired, replacement);
    });
  }, [hand?.players, hasRace, retired, replacement]);

  const [oddChips, setOddChips] = useState(() => autoOddChips.map((n) => String(n || '')));
  const [winners, setWinners] = useState(() => new Set());
  const [useRound, setUseRound] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setOddChips((prev) => {
      const next = autoOddChips.map((n, i) => (prev[i] != null && prev[i] !== '' ? prev[i] : String(n || '')));
      if (prev.length !== autoOddChips.length) return autoOddChips.map((n) => String(n || ''));
      return next;
    });
  }, [autoOddChips]);

  const totals = useMemo(() => {
    const perPlayer = (oddChips || []).map((c) => {
      const n = Number(c) || 0;
      return { count: n, value: n * retired };
    });
    const totalValue = perPlayer.reduce((s, p) => s + p.value, 0);
    const raceChips = replacement > 0 ? Math.floor(totalValue / replacement) : 0;
    const remainder = replacement > 0 ? totalValue - raceChips * replacement : totalValue;
    return { perPlayer, totalValue, raceChips, remainder };
  }, [oddChips, retired, replacement]);

  const roundTotals = useMemo(() => {
    const perPlayer = totals.perPlayer.map((p) => {
      const newChips = replacement > 0 ? Math.round(p.value / replacement) : 0;
      const roundedValue = newChips * replacement;
      return { ...p, newChips, roundedValue, diff: roundedValue - p.value };
    });
    const totalRemoved = perPlayer.reduce((s, p) => s + p.value, 0);
    const totalAwarded = perPlayer.reduce((s, p) => s + p.roundedValue, 0);
    return { perPlayer, totalRemoved, totalAwarded };
  }, [totals, replacement]);

  const antiElimination = useMemo(() => {
    if (!hasRace || useRound) return {};
    const out = {};
    (hand?.players || []).forEach((p, i) => {
      const stack = Number(p.stack) || 0;
      const oddVal = totals.perPlayer[i]?.value || 0;
      const remaining = stack - oddVal;
      if (remaining === 0 && stack > 0 && !winners.has(p.id)) {
        out[p.id] = replacement;
      }
    });
    return out;
  }, [hasRace, useRound, hand?.players, totals.perPlayer, winners, replacement]);

  const eligibleWinnerIds = useMemo(() => {
    if (!hasRace || useRound) return new Set();
    const set = new Set();
    (hand?.players || []).forEach((p, i) => {
      if ((totals.perPlayer[i]?.count || 0) > 0) set.add(p.id);
    });
    return set;
  }, [hasRace, useRound, hand?.players, totals.perPlayer]);

  const toggleWinner = (pid) => {
    if (!eligibleWinnerIds.has(pid)) return;
    setWinners((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      return next;
    });
  };

  const applyRace = () => {
    setError('');
    if (!hasRace) return;
    if (retired <= 0) return setError('Enter the retired chip value at setup.');
    if (replacement <= retired) return setError('Replacement chip must be larger than the retired chip.');
    if (totals.totalValue <= 0) return setError('Enter each player\'s odd chips.');
    const players = hand.players;
    if (useRound) {
      const adj = {};
      players.forEach((p, i) => {
        const rt = roundTotals.perPlayer[i];
        adj[p.id] = rt.roundedValue - rt.value;
      });
      onChipRace(adj);
      onClose();
      return;
    }
    if (totals.raceChips === 0) {
      const adj = {};
      players.forEach((p, i) => {
        const out = totals.perPlayer[i].value;
        const anti = antiElimination[p.id] || 0;
        adj[p.id] = anti * replacement - out;
      });
      onChipRace(adj);
      onClose();
      return;
    }
    if (winners.size === 0) return setError('Select at least one race winner.');
    const wArr = [...winners];
    const base = Math.floor(totals.raceChips / wArr.length);
    let extra = totals.raceChips - base * wArr.length;
    const winnerChips = {};
    wArr.forEach((pid, i) => { winnerChips[pid] = base + (i < extra ? 1 : 0); });
    const adj = {};
    players.forEach((p, i) => {
      const out = totals.perPlayer[i].value;
      const inChips = winnerChips[p.id] || 0;
      const anti = antiElimination[p.id] || 0;
      adj[p.id] = inChips * replacement + anti * replacement - out;
    });
    onChipRace(adj);
    onClose();
  };

  const st = levelTimerState(hand, now);
  const raceLabel = hasRace ? `Race ${retired} chips into ${replacement}` : null;
  const canApply = hasRace && totals.totalValue > 0;
  const showWinnerPick = hasRace && !useRound && totals.raceChips > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-[#2a2f37] bg-[#1e2227] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Break</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        {st.active && st.phase === 'break' && (
          <div className={`rounded-xl border px-4 py-3 mb-4 text-center ${
            st.expired ? 'bg-[#3a3320] border-[#8a7a3a]' : 'bg-[#1e2a1e] border-[#4a5a4a]'
          }`}>
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Break</div>
            <div className="font-mono text-3xl font-bold text-white tabular-nums">
              {st.expired ? '0:00' : formatTimer(st)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Breaks keep running until the next hand – blinds update then.</div>
          </div>
        )}
        {!hasRace ? (
          <div className="text-sm text-slate-300 mb-4">No chip race is scheduled for this break. Resume play whenever everyone is back.</div>
        ) : (
          <div className="border-t border-[#2a2f37] pt-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Chip race</div>
            <div className="text-sm text-slate-300 mb-1">{raceLabel}</div>
            <div className="text-[11px] text-slate-500 mb-3">Odd chips are auto-filled from each player's stack – edit if needed. Pick the race winner(s) and apply.</div>
            <div className="flex rounded-lg border border-[#2a2f37] overflow-hidden mb-3">
              <button
                onClick={() => setUseRound(false)}
                className={`flex-1 px-3 py-2 text-xs ${!useRound ? 'bg-[#4a5a4a] text-white' : 'bg-[#15181d] text-slate-300'}`}
              >
                Chip race
              </button>
              <button
                onClick={() => setUseRound(true)}
                className={`flex-1 px-3 py-2 text-xs ${useRound ? 'bg-[#4a5a4a] text-white' : 'bg-[#15181d] text-slate-300'}`}
              >
                Round up/down
              </button>
            </div>
            {useRound && (
              <div className="text-[11px] text-slate-500 mb-3">
                Each player's odd chips are rounded to the nearest {money(replacement, hand.currency)} chip. Half or above rounds up; below half rounds down.
              </div>
            )}
            <div className="space-y-2 mb-3">
              {(hand.players || []).map((p, i) => {
                const canWin = eligibleWinnerIds.has(p.id);
                const isAntiElim = !useRound && antiElimination[p.id] > 0;
                return (
                  <div key={p.id} className="flex items-center gap-2 rounded-lg bg-[#15181d] border border-[#2a2f37] px-3 py-2">
                    {showWinnerPick && (
                      <label className={`flex items-center gap-2 shrink-0 ${canWin ? 'cursor-pointer' : 'cursor-not-allowed opacity-30'}`}>
                        <input
                          type="checkbox"
                          checked={winners.has(p.id)}
                          onChange={() => toggleWinner(p.id)}
                          disabled={!canWin}
                          className="w-4 h-4 accent-[#4a5a4a]"
                        />
                      </label>
                    )}
                    <span className="text-sm text-white flex-1 truncate">{p.name}</span>
                    <input
                      type="number"
                      value={oddChips[i]}
                      onChange={(e) => setOddChips((prev) => prev.map((c, j) => j === i ? e.target.value : c))}
                      placeholder="0"
                      className="w-16 rounded-md bg-[#1e2227] border border-[#2a2f37] px-2 py-1.5 text-white text-sm text-right"
                    />
                    <span className="text-xs text-slate-500 w-16 text-right">
                      {totals.perPlayer[i]?.value ? money(totals.perPlayer[i].value, hand.currency) : ''}
                    </span>
                    {useRound && totals.perPlayer[i]?.value > 0 && (
                      <span className="text-xs text-emerald-300 w-16 text-right">
                        {roundTotals.perPlayer[i].newChips > 0 ? `+${roundTotals.perPlayer[i].newChips} ${replacement}` : '– 0'}
                      </span>
                    )}
                    {isAntiElim && (
                      <span className="text-xs text-amber-300 w-auto" title="Would be eliminated – gets 1 chip to survive">
                        +1 anti-elim
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="rounded-lg bg-[#15181d] border border-[#2a2f37] p-3 mb-3 text-sm text-slate-300 space-y-1">
              <div className="flex justify-between"><span>Odd chips total</span><span>{money(totals.totalValue, hand.currency)}</span></div>
              {useRound ? (
                <>
                  <div className="flex justify-between"><span>Awarded after rounding</span><span>{money(roundTotals.totalAwarded, hand.currency)}</span></div>
                  <div className="flex justify-between text-amber-300/90"><span>Removed from play</span><span>{money(roundTotals.totalRemoved - roundTotals.totalAwarded, hand.currency)}</span></div>
                </>
              ) : (
                <>
                  <div className="flex justify-between"><span>Replacement chips to award</span><span>{totals.raceChips} × {money(replacement, hand.currency)}{totals.raceChips ? ` = ${money(totals.raceChips * replacement, hand.currency)}` : ''}</span></div>
                  {totals.remainder > 0 && <div className="flex justify-between text-amber-300/90"><span>Remainder (removed)</span><span>{money(totals.remainder, hand.currency)}</span></div>}
                </>
              )}
            </div>
            <button
              onClick={applyRace}
              disabled={!canApply && !useRound}
              className="w-full rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {useRound ? 'Apply rounding' : 'Apply chip race'}
            </button>
          </div>
        )}
        {error && <div className="text-sm text-rose-400 mt-3">{error}</div>}
        <div className="flex gap-2 mt-3">
          {dismissOverride && (
            <button onClick={dismissOverride} className="flex-1 rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-white text-sm py-2.5">
              Skip race
            </button>
          )}
          <button onClick={onResume} className="flex-1 rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm py-2.5">
            Resume play →
          </button>
        </div>
      </div>
    </div>
  );
}

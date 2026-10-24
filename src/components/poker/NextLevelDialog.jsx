import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { money, parseAmount } from '@/lib/poker';

export default function NextLevelDialog({
  smallBlind, bigBlind, anteAmount, anteType,
  players, currency, chipDenominations,
  isPreplanner, onSave, onChipRace, onClose,
}) {
  const [sb, setSb] = useState(smallBlind);
  const [bb, setBb] = useState(bigBlind);
  const [ante, setAnte] = useState(anteAmount);
  const [error, setError] = useState('');
  const isBBA = anteType === 'bba';
  const isBtnAnte = anteType === 'btn_ante';
  const isSBHalfAnte = anteType === 'sb_half_ante';
  const isFixedAnte = isBBA || isBtnAnte || isSBHalfAnte;
  const hasChips = Array.isArray(chipDenominations) && chipDenominations.length > 0;

  const [retiringValue, setRetiringValue] = useState('');
  const [raceValue, setRaceValue] = useState('');
  const [oddChips, setOddChips] = useState(() => (players || []).map(() => ''));
  const [winners, setWinners] = useState(() => new Set());
  const [useRound, setUseRound] = useState(false);
  const [appliedLevel, setAppliedLevel] = useState(false);

  useEffect(() => {
    if (isBBA || isBtnAnte) setAnte(bb);
    else if (isSBHalfAnte) setAnte(Math.max(1, Math.round((Number(bb) || 0) * 0.5)));
  }, [isBBA, isBtnAnte, isSBHalfAnte, bb]);

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

  const rv = parseAmount(retiringValue) ?? (Number(retiringValue) || 0);
  const xv = parseAmount(raceValue) ?? (Number(raceValue) || 0);

  const autoOddChips = useMemo(() => {
    if (rv <= 0 || xv <= 0) return [];
    return (players || []).map((p) => {
      const stack = Number(p.stack) || 0;
      return calcOddChips(stack, rv, xv);
    });
  }, [players, rv, xv]);

  useEffect(() => {
    if (!autoOddChips.length) return;
    setOddChips((prev) => {
      if (prev.length !== autoOddChips.length) return autoOddChips.map((n) => String(n || ''));
      return prev.map((c, i) => (c && c !== '' ? c : String(autoOddChips[i] || '')));
    });
  }, [autoOddChips]);

  const totals = useMemo(() => {
    const perPlayer = oddChips.map((c) => {
      const n = Number(c) || 0;
      return { count: n, value: n * rv };
    });
    const totalValue = perPlayer.reduce((s, p) => s + p.value, 0);
    const raceChips = xv > 0 ? Math.floor(totalValue / xv) : 0;
    const remainder = xv > 0 ? totalValue - raceChips * xv : totalValue;
    return { perPlayer, totalValue, raceChips, remainder };
  }, [oddChips, rv, xv]);

  const roundTotals = useMemo(() => {
    const perPlayer = totals.perPlayer.map((p) => {
      const newChips = xv > 0 ? Math.round(p.value / xv) : 0;
      const roundedValue = newChips * xv;
      return { ...p, newChips, roundedValue };
    });
    const totalAwarded = perPlayer.reduce((s, p) => s + p.roundedValue, 0);
    return { perPlayer, totalAwarded };
  }, [totals, xv]);

  const toggleWinner = (pid) => {
    setWinners((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      return next;
    });
  };

  const applyLevel = () => {
    const s = parseAmount(sb) ?? Number(sb);
    const b = parseAmount(bb) ?? Number(bb);
    const a = anteType !== 'none' ? (parseAmount(ante) ?? Number(ante)) : 0;
    if (s <= 0 || b <= 0) return setError('Blinds must be positive.');
    if (anteType !== 'none' && a <= 0) return setError('Ante must be positive.');
    onSave(s, b, a);
    setAppliedLevel(true);
  };

  const applyChipRace = () => {
    if (rv <= 0) return setError('Enter the value of the chip being colored up.');
    if (xv <= 0) return setError('Enter the value of the chip being raced to.');
    if (xv <= rv) return setError('Race chip must be larger than the retired chip.');
    if (totals.totalValue <= 0) return setError('Nothing to race – no odd chips entered.');
    if (useRound) {
      const adj = {};
      (players || []).forEach((p, i) => {
        const rt = roundTotals.perPlayer[i];
        adj[p.id] = rt.roundedValue - rt.value;
      });
      onChipRace(adj);
      onClose();
      return;
    }
    if (totals.raceChips === 0) {
      const adj = {};
      (players || []).forEach((p, i) => { adj[p.id] = -totals.perPlayer[i].value; });
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
    (players || []).forEach((p, i) => {
      const out = totals.perPlayer[i].value;
      const inChips = winnerChips[p.id] || 0;
      adj[p.id] = inChips * xv - out;
    });
    onChipRace(adj);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-[#2a2f37] bg-[#1e2227] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">{isPreplanner ? 'Pre-plan next level' : 'Next level'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-3 mb-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide">1. Set the next blinds</div>
          {isPreplanner && (
            <div className="text-[11px] text-emerald-300/80">This adds a new level to the blind schedule.</div>
          )}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-slate-400 block mb-1">Small blind</label>
              <input type="text" inputMode="decimal" value={sb} onChange={(e) => setSb(e.target.value)} className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-400 block mb-1">Big blind</label>
              <input type="text" inputMode="decimal" value={bb} onChange={(e) => setBb(e.target.value)} className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
            </div>
          </div>
          {anteType !== 'none' && anteType !== 'three_blinds' && (
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Ante {isBBA ? '(= big blind)' : isBtnAnte ? '(= button ante 1 BB)' : isSBHalfAnte ? '(= SB half ante 0.5 BB)' : ''}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={ante}
                disabled={isFixedAnte}
                onChange={(e) => setAnte(e.target.value)}
                className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm disabled:opacity-40"
              />
            </div>
          )}
          {!appliedLevel ? (
            <button onClick={applyLevel} className="w-full rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm py-2.5">
              Apply level
            </button>
          ) : (
            <div className="rounded-lg bg-[#2a3329] border border-[#4a5a4a] px-3 py-2 text-sm text-emerald-300">
              Level applied. Optional: run a chip race below, or close.
            </div>
          )}
        </div>
        {hasChips && appliedLevel && !isPreplanner && (
          <div className="border-t border-[#2a2f37] pt-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-3">2. Chip race / color up (optional)</div>
            <div className="flex gap-3 mb-3">
              <div className="flex-1">
                <label className="text-xs text-slate-400 block mb-1">Chip being colored up</label>
                <input type="text" inputMode="decimal" value={retiringValue} onChange={(e) => setRetiringValue(e.target.value)} placeholder="e.g. 25" className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-slate-400 block mb-1">Race chip value</label>
                <input type="text" inputMode="decimal" value={raceValue} onChange={(e) => setRaceValue(e.target.value)} placeholder="e.g. 100" className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
              </div>
            </div>
            <div className="flex rounded-lg border border-[#2a2f37] overflow-hidden mb-3">
              <button onClick={() => setUseRound(false)} className={`flex-1 px-3 py-2 text-xs ${!useRound ? 'bg-[#4a5a4a] text-white' : 'bg-[#15181d] text-slate-300'}`}>Chip race</button>
              <button onClick={() => setUseRound(true)} className={`flex-1 px-3 py-2 text-xs ${useRound ? 'bg-[#4a5a4a] text-white' : 'bg-[#15181d] text-slate-300'}`}>Round up/down</button>
            </div>
            <div className="space-y-2 mb-3">
              {(players || []).map((p, i) => (
                <div key={p.id} className="flex items-center gap-2 rounded-lg bg-[#15181d] border border-[#2a2f37] px-3 py-2">
                  {!useRound && totals.raceChips > 0 && (
                    <label className="flex items-center gap-2 cursor-pointer shrink-0">
                      <input type="checkbox" checked={winners.has(p.id)} onChange={() => toggleWinner(p.id)} className="w-4 h-4 accent-[#4a5a4a]" />
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
                    {totals.perPlayer[i]?.value ? money(totals.perPlayer[i].value, currency) : ''}
                  </span>
                  {useRound && totals.perPlayer[i]?.value > 0 && (
                    <span className="text-xs text-emerald-300 w-16 text-right">
                      {roundTotals.perPlayer[i].newChips > 0 ? `+${roundTotals.perPlayer[i].newChips} ${xv}` : '– 0'}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <button onClick={applyChipRace} disabled={totals.totalValue <= 0} className="w-full rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm py-2.5 disabled:opacity-40 disabled:cursor-not-allowed">
              {useRound ? 'Apply rounding' : 'Apply chip race'}
            </button>
          </div>
        )}
        {error && <div className="text-sm text-rose-400 mt-3">{error}</div>}
      </div>
    </div>
  );
}

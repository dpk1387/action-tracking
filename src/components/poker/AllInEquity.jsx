import React, { useState, useEffect, useMemo } from 'react';
import { parseCards, variantRanks, effectiveHoleSize, SUIT_SYMBOL, rankDisplay } from '@/lib/poker';

const SUIT_INFO = {
  s: { symbol: '♠', color: 'text-slate-200', bg: 'bg-slate-800 border-slate-600', name: 'Spades' },
  h: { symbol: '♥', color: 'text-rose-500', bg: 'bg-rose-950/80 border-rose-700/80', name: 'Hearts' },
  d: { symbol: '♦', color: 'text-blue-400', bg: 'bg-blue-950/80 border-blue-700/80', name: 'Diamonds' },
  c: { symbol: '♣', color: 'text-emerald-400', bg: 'bg-emerald-950/80 border-emerald-700/80', name: 'Clubs' },
};

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

export default function AllInEquity({ hand, nonFolded, holeCards = {}, onHoleChange }) {
  const variant = hand.variant || 'nlh';
  const holeSize = effectiveHoleSize(hand);
  const [text, setText] = useState({});
  const [activeSlot, setActiveSlot] = useState(null); // { pid, idx }
  const [selectedRank, setSelectedRank] = useState('A');
  const [error, setError] = useState('');
  const isShowtime = hand?.variant === 'showtime';
  const [showFolded, setShowFolded] = useState(() => isShowtime);

  useEffect(() => {
    if (isShowtime) setShowFolded(true);
  }, [isShowtime]);

  const allPlayers = hand?.players || nonFolded;
  const foldedPlayersCount = allPlayers.filter((p) => p.status === 'folded').length;
  const displayPlayers = showFolded ? allPlayers : nonFolded;

  // Sync state from props
  useEffect(() => {
    const initText = {};
    displayPlayers.forEach((p) => {
      if (holeCards[p.id]) {
        initText[p.id] = holeCards[p.id].map((c) => (c ? c.rank + c.suit : '')).join(' ').trim();
      }
    });
    setText(initText);
    setError('');

    // Default active slot to first incomplete hole card slot
    for (const p of displayPlayers) {
      const cards = holeCards[p.id] || [];
      if (cards.filter(Boolean).length < holeSize) {
        setActiveSlot({ pid: p.id, idx: cards.filter(Boolean).length });
        break;
      }
    }
  }, [hand?.handNumber, hand?.street, displayPlayers.map((p) => p.id).join(',')]);

  const usedCardsSet = useMemo(() => {
    const set = new Set();
    // Community cards on all boards
    (hand.communityCards || []).forEach((c) => { if (c && !c.hidden) set.add(c.rank + c.suit); });
    (hand.boardB || []).forEach((c) => { if (c && !c.hidden) set.add(c.rank + c.suit); });
    (hand.boardC || []).forEach((c) => { if (c && !c.hidden) set.add(c.rank + c.suit); });
    // Player hole cards
    displayPlayers.forEach((p) => {
      const cards = holeCards[p.id] || [];
      cards.forEach((c) => { if (c) set.add(c.rank + c.suit); });
    });
    return set;
  }, [hand.communityCards, hand.boardB, hand.boardC, displayPlayers, holeCards]);

  const onText = (pid, val) => {
    setText((prev) => ({ ...prev, [pid]: val }));
    const { cards, error: perr } = parseCards(val, variantRanks(variant));
    if (perr && val.trim().length > 0) {
      setError(perr);
    } else {
      setError('');
    }
    if (!perr && cards) {
      onHoleChange(pid, cards.length > 0 ? cards : null);
    } else if (!val.trim()) {
      onHoleChange(pid, null);
    }
  };

  const handlePickCard = (rank, suit) => {
    if (!activeSlot) return;
    const { pid, idx } = activeSlot;
    const existing = [...(holeCards[pid] || [])];
    existing[idx] = { rank, suit };
    const validCards = existing.filter(Boolean);

    // Update text representation for this player
    const textStr = validCards.map((c) => c.rank + c.suit).join(' ');
    setText((prev) => ({ ...prev, [pid]: textStr }));
    setError('');

    // Send updated cards array to parent
    onHoleChange(pid, validCards.length > 0 ? validCards : null);

    // Auto-advance active slot
    if (idx + 1 < holeSize) {
      setActiveSlot({ pid, idx: idx + 1 });
    } else {
      // Find next player who needs cards
      const pIndex = displayPlayers.findIndex((p) => p.id === pid);
      let found = false;
      for (let i = pIndex + 1; i < displayPlayers.length; i++) {
        const nextP = displayPlayers[i];
        const pCards = holeCards[nextP.id] || [];
        if (pCards.filter(Boolean).length < holeSize) {
          setActiveSlot({ pid: nextP.id, idx: pCards.filter(Boolean).length });
          found = true;
          break;
        }
      }
      if (!found) {
        for (let i = 0; i <= pIndex; i++) {
          const nextP = displayPlayers[i];
          const pCards = nextP.id === pid ? validCards : (holeCards[nextP.id] || []);
          if (pCards.filter(Boolean).length < holeSize) {
            setActiveSlot({ pid: nextP.id, idx: pCards.filter(Boolean).length });
            break;
          }
        }
      }
    }
  };

  const handleClearSlot = (pid, idx) => {
    const existing = [...(holeCards[pid] || [])];
    existing.splice(idx, 1);
    const validCards = existing.filter(Boolean);
    const textStr = validCards.map((c) => c.rank + c.suit).join(' ');
    setText((prev) => ({ ...prev, [pid]: textStr }));
    onHoleChange(pid, validCards.length > 0 ? validCards : null);
    setActiveSlot({ pid, idx: Math.min(idx, validCards.length) });
  };

  const activePlayer = displayPlayers.find((p) => p.id === activeSlot?.pid);
  const placeholder = 'e.g. ' + ['As', 'Kd', 'Qh', '2c', '3s', '4d'].slice(0, Math.max(2, holeSize)).join(' ');

  return (
    <div className="rounded-xl border border-[#2a2f37] bg-[#1e2227] p-4 shadow-lg space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 flex-wrap gap-2">
        <div>
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <span>Showdown Hole Cards</span>
            <span className="text-xs text-amber-300 font-mono font-normal">({holeSize} per player)</span>
          </div>
          <div className="text-[11px] text-slate-400">Click slots or type text cards (e.g. {placeholder})</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {foldedPlayersCount > 0 && (
            <button
              type="button"
              onClick={() => setShowFolded(!showFolded)}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer border ${
                showFolded
                  ? 'bg-purple-950 text-purple-300 border-purple-500/70 shadow'
                  : 'bg-[#151921] hover:bg-[#1f2633] text-slate-400 border-slate-700'
              }`}
            >
              {showFolded ? 'Hide Folded Players' : `+ ${foldedPlayersCount} Folded Player${foldedPlayersCount > 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {/* Player Cards Grid with Integrated Visual Slots & Text Input */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {displayPlayers.map((p) => {
            const cards = holeCards[p.id] || [];
            return (
              <div
                key={p.id}
                className={`flex items-center justify-between p-2 rounded-xl border gap-2 transition-all ${
                  activeSlot?.pid === p.id
                    ? 'bg-[#18202d] border-amber-500/70 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                    : 'bg-[#141820] border-slate-800'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate flex items-center gap-1.5" title={p.name}>
                    <span className="truncate">{p.name}</span>
                    {p.status === 'folded' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-950/90 text-purple-300 border border-purple-500/60 font-semibold shrink-0">
                        {isShowtime ? 'Showtime Fold' : 'Folded'}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {cards.filter(Boolean).length}/{holeSize} cards
                  </div>
                </div>

                {/* Card Slots */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {Array.from({ length: holeSize }, (_, k) => {
                    const c = cards[k];
                    const isCurrent = activeSlot?.pid === p.id && activeSlot?.idx === k;
                    const isHeart = c && c.suit === 'h';
                    const isDiamond = c && c.suit === 'd';
                    const isClub = c && c.suit === 'c';
                    const cardColor = isHeart
                      ? 'text-rose-600 font-bold'
                      : isDiamond
                      ? 'text-blue-600 font-bold'
                      : isClub
                      ? 'text-emerald-600 font-bold'
                      : 'text-slate-900 font-bold';

                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setActiveSlot({ pid: p.id, idx: k })}
                        className={`w-8 h-10 rounded-lg flex flex-col items-center justify-center font-bold border transition-all cursor-pointer relative ${
                          isCurrent
                            ? 'border-amber-400 bg-amber-950/60 shadow-[0_0_10px_rgba(245,158,11,0.5)] ring-2 ring-amber-400/80 scale-105'
                            : c
                            ? 'bg-slate-100 border-white shadow-sm'
                            : 'bg-[#0f1218] border-dashed border-slate-700 text-slate-500 hover:border-slate-500'
                        }`}
                      >
                        {c ? (
                          <>
                            <span className={`leading-none text-xs font-black font-bold ${cardColor}`}>
                              <strong className="font-bold">{rankDisplay(c.rank)}</strong>
                            </span>
                            <span className={`leading-none text-xs font-bold ${cardColor}`}>
                              {SUIT_SYMBOL[c.suit]}
                            </span>
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClearSlot(p.id, k);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  handleClearSlot(p.id, k);
                                }
                              }}
                              className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-600 text-white text-[9px] flex items-center justify-center font-black hover:bg-rose-500 cursor-pointer"
                              title="Remove card"
                            >
                              ×
                            </span>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-500">{k + 1}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Inline Quick Text Entry */}
                <input
                  value={text[p.id] || ''}
                  onChange={(e) => onText(p.id, e.target.value)}
                  onFocus={() => {
                    const cList = holeCards[p.id] || [];
                    const nextIdx = Math.min(cList.filter(Boolean).length, holeSize - 1);
                    setActiveSlot({ pid: p.id, idx: Math.max(0, nextIdx) });
                  }}
                  placeholder={placeholder}
                  className="w-24 sm:w-28 rounded-lg bg-[#0e1218] border border-slate-700 focus:border-amber-400 px-2 py-1 text-white text-xs font-mono shrink-0 focus:outline-none"
                  title="Or type cards directly (e.g. As Kd)"
                />
              </div>
            );
          })}
        </div>

          {/* Interactive Card Selection Keyboard */}
          <div className="rounded-xl bg-[#0e1219] border border-slate-800 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-bold">
                Filling Card for:{' '}
                <span className="text-amber-300 font-extrabold">
                  {activePlayer ? `${activePlayer.name} (Card ${(activeSlot?.idx ?? 0) + 1})` : 'Select a card slot above'}
                </span>
              </span>
              <span className="text-[10px] text-slate-500">Pick rank then suit</span>
            </div>

            {/* Rank Row */}
            <div className="grid grid-cols-13 gap-1">
              {RANKS.map((r) => {
                const isSelected = selectedRank === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedRank(r)}
                    className={`py-1.5 rounded-md font-black text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500 text-black shadow ring-1 ring-amber-300 scale-105'
                        : 'bg-[#1d2430] hover:bg-[#283244] text-slate-200 border border-slate-700/60'
                    }`}
                  >
                    {r === 'T' ? '10' : r}
                  </button>
                );
              })}
            </div>

            {/* Suit Row */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              {Object.entries(SUIT_INFO).map(([suitKey, info]) => {
                const cardKey = selectedRank ? (selectedRank + suitKey) : null;
                const activeCard = activeSlot ? (holeCards[activeSlot.pid] || [])[activeSlot.idx] : null;
                const isCurrentActiveCard = activeCard && activeCard.rank === selectedRank && activeCard.suit === suitKey;
                const isUsed = cardKey ? (usedCardsSet.has(cardKey) && !isCurrentActiveCard) : false;

                return (
                  <button
                    key={suitKey}
                    type="button"
                    disabled={!activeSlot || isUsed}
                    onClick={() => handlePickCard(selectedRank, suitKey)}
                    className={`py-2 px-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                      info.bg
                    } hover:brightness-125`}
                  >
                    <span className={`text-base font-extrabold leading-none ${info.color}`}>{info.symbol}</span>
                    <span className="text-white text-xs font-bold"><strong className="font-bold">{selectedRank === 'T' ? '10' : selectedRank}</strong>{info.symbol}</span>
                    {isUsed && <span className="text-[9px] text-slate-500 line-through">used</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {error && <div className="text-sm text-rose-400 mt-1 font-semibold">{error}</div>}
      </div>
  );
}

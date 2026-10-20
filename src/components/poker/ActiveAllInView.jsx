import React, { useState, useEffect, useMemo } from 'react';
import { Tv, Sparkles, X, Check, AlertCircle, Play, Shuffle } from 'lucide-react';
import { parseCards, variantRanks, calcEquity, effectiveHoleSize, formatKM } from '@/lib/poker';
import AllInView from '@/components/poker/AllInView';

const SUITS = ['s', 'h', 'd', 'c'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

function getFullDeck() {
  const d = [];
  RANKS.forEach((r) => SUITS.forEach((s) => d.push(`${r}${s}`)));
  return d;
}

export default function ActiveAllInView({
  broadcastData,
  onUpdateBroadcast,
  onClose,
  hideAmounts = false,
}) {
  const { tableId, tableName, rankedPlayers = [], tablePlayers = [] } = broadcastData;
  const variant = broadcastData?.hand?.variant || 'nlh';
  const holeSize = effectiveHoleSize({ variant });

  // 1. Hole card text state for each player
  const [holeTexts, setHoleTexts] = useState(() => {
    const init = {};
    if (broadcastData.holeCards) {
      Object.entries(broadcastData.holeCards).forEach(([pid, cards]) => {
        if (Array.isArray(cards)) {
          init[pid] = cards.map((c) => c.rank + c.suit).join(' ');
        }
      });
    }
    return init;
  });

  // 2. Community board text state
  const [boardText, setBoardText] = useState(() => {
    if (broadcastData.communityCards?.length) {
      return broadcastData.communityCards.map((c) => c.rank + c.suit).join(' ');
    }
    return '';
  });

  const [parseError, setParseError] = useState('');

  // Live equity & card parsing calculation
  const { parsedHoles, parsedBoard, currentEquity, allInHandPayload } = useMemo(() => {
    const allowed = variantRanks(variant);
    const holes = {};
    let err = null;

    const boardRes = parseCards(boardText, allowed);
    if (boardRes.error) {
      err = `Board: ${boardRes.error}`;
    }

    rankedPlayers.forEach((p) => {
      const txt = holeTexts[p.id] || '';
      if (txt.trim()) {
        const res = parseCards(txt, allowed);
        if (res.error) {
          err = `${p.name}: ${res.error}`;
        } else {
          holes[p.id] = res.cards;
        }
      }
    });

    setParseError(err || '');

    const allInPlayers = rankedPlayers.map((p, idx) => ({
      ...p,
      status: 'allin',
      chipRank: idx + 1,
    }));

    const handPayload = {
      ...(broadcastData.hand || {}),
      mode: 'tournament',
      variant,
      communityCards: boardRes.cards || [],
      street: (boardRes.cards || []).length >= 5 ? 'river' : (boardRes.cards || []).length >= 4 ? 'turn' : (boardRes.cards || []).length >= 3 ? 'flop' : 'preflop',
      players: allInPlayers,
      pots: [{ amount: allInPlayers.reduce((sum, p) => sum + (p.stack || 0), 0) }],
    };

    let eq = null;
    const readyPlayers = rankedPlayers.filter((p) => holes[p.id]?.length >= holeSize);
    if (readyPlayers.length >= 2 && !err) {
      try {
        eq = calcEquity(handPayload, holes, boardRes.cards || []);
      } catch (e) {
        console.error('Equity calc error', e);
      }
    }

    return {
      parsedHoles: holes,
      parsedBoard: boardRes.cards || [],
      currentEquity: eq,
      allInHandPayload: handPayload,
    };
  }, [rankedPlayers, holeTexts, boardText, variant, holeSize, broadcastData.hand]);

  // Sync state upward to parent and liveSync on change
  useEffect(() => {
    onUpdateBroadcast({
      ...broadcastData,
      hand: allInHandPayload,
      holeCards: parsedHoles,
      communityCards: parsedBoard,
      equity: currentEquity,
    });
  }, [parsedHoles, parsedBoard, currentEquity]);

  const handleHoleChange = (pid, val) => {
    setHoleTexts((prev) => ({ ...prev, [pid]: val }));
  };

  const handleBoardChange = (val) => {
    setBoardText(val);
  };

  // Helper: get used card strings
  const getUsedCards = () => {
    const used = new Set();
    Object.values(parsedHoles).forEach((cards) => {
      (cards || []).forEach((c) => used.add(`${c.rank}${c.suit}`.toLowerCase()));
    });
    parsedBoard.forEach((c) => used.add(`${c.rank}${c.suit}`.toLowerCase()));
    return used;
  };

  // Quick Deal Board functions
  const dealBoardCards = (targetCount) => {
    const used = getUsedCards();
    const available = getFullDeck().filter((c) => !used.has(c.toLowerCase()));
    // Shuffle available
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }

    const currentCount = parsedBoard.length;
    const needed = Math.max(0, targetCount - currentCount);
    if (needed === 0) return;

    const toAdd = available.slice(0, needed);
    const existingStr = boardText.trim();
    const newBoardStr = existingStr ? `${existingStr} ${toAdd.join(' ')}` : toAdd.join(' ');
    setBoardText(newBoardStr);
  };

  const handleDealRandomHoles = () => {
    const used = getUsedCards();
    const available = getFullDeck().filter((c) => !used.has(c.toLowerCase()));
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }

    let ptr = 0;
    const nextTexts = { ...holeTexts };
    rankedPlayers.forEach((p) => {
      if (!nextTexts[p.id]?.trim() && ptr + holeSize <= available.length) {
        const dealt = available.slice(ptr, ptr + holeSize);
        ptr += holeSize;
        nextTexts[p.id] = dealt.join(' ');
      }
    });
    setHoleTexts(nextTexts);
  };

  return (
    <div className="rounded-2xl border-2 border-emerald-500/50 bg-[#0c1017] p-4 sm:p-5 shadow-2xl space-y-4">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#222a38]">
        <div className="flex items-center gap-3">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <div>
            <div className="text-sm sm:text-base font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <Tv size={16} />
              <span>LIVE ON ALL SCREENS: {tableName} ALL-IN SHOWDOWN</span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Enter hole cards and community board cards below to calculate live odds and broadcast to TV/Spectators.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl bg-rose-900/60 hover:bg-rose-900 text-rose-200 border border-rose-700 text-xs font-bold cursor-pointer transition-colors shadow-sm"
        >
          Close All-In View
        </button>
      </div>

      {/* Visual AllInView Stage */}
      <div className="w-full">
        <AllInView
          hand={allInHandPayload}
          holeCards={parsedHoles}
          equity={currentEquity}
          hideAmounts={hideAmounts}
          pot={allInHandPayload?.pots?.[0]?.amount || 0}
        />
      </div>

      {/* Card Entry Section Directly in the View */}
      <div className="rounded-xl border border-emerald-500/30 bg-[#121722] p-4 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#242e3f]">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-400" />
            Enter Cards for Live All-In View
          </span>
          <span className="text-[11px] text-slate-400">
            Ordered by chip stack hierarchy going into hand
          </span>
        </div>

        {/* 1. Community Board Cards Input & Quick Deal Controls */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <label className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Community Board Cards (Flop · Turn · River)
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => dealBoardCards(3)}
                disabled={parsedBoard.length >= 3}
                className="px-2.5 py-1 rounded-lg bg-[#1f2838] hover:bg-[#2c394f] disabled:opacity-40 text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
              >
                Deal Flop (3)
              </button>
              <button
                type="button"
                onClick={() => dealBoardCards(4)}
                disabled={parsedBoard.length < 3 || parsedBoard.length >= 4}
                className="px-2.5 py-1 rounded-lg bg-[#1f2838] hover:bg-[#2c394f] disabled:opacity-40 text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
              >
                Deal Turn (1)
              </button>
              <button
                type="button"
                onClick={() => dealBoardCards(5)}
                disabled={parsedBoard.length < 4 || parsedBoard.length >= 5}
                className="px-2.5 py-1 rounded-lg bg-[#1f2838] hover:bg-[#2c394f] disabled:opacity-40 text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
              >
                Deal River (1)
              </button>
              <button
                type="button"
                onClick={() => dealBoardCards(5)}
                disabled={parsedBoard.length >= 5}
                className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 disabled:opacity-40 text-xs font-bold cursor-pointer transition-colors"
              >
                Fill Board (5)
              </button>
              {boardText && (
                <button
                  type="button"
                  onClick={() => setBoardText('')}
                  className="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <input
            type="text"
            value={boardText}
            onChange={(e) => handleBoardChange(e.target.value)}
            placeholder="e.g. As Kd 2c Qh 9s (type or click Deal buttons above)"
            className="w-full rounded-xl bg-[#090d14] border border-[#2b374a] px-3.5 py-2 text-sm text-white font-mono uppercase focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* 2. Player Hole Cards (Ranked by Chips) */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Player Hole Cards ({holeSize} cards each)
            </label>
            <button
              type="button"
              onClick={handleDealRandomHoles}
              className="px-2.5 py-1 rounded-lg bg-[#1f2838] hover:bg-[#2c394f] text-slate-200 text-xs font-semibold cursor-pointer flex items-center gap-1"
            >
              <Shuffle size={12} />
              <span>Deal Random Hole Cards</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rankedPlayers.map((p, idx) => {
              const eq = currentEquity?.byId?.[p.id];
              const isCovering = idx === 0;

              return (
                <div
                  key={p.id}
                  className="p-3 rounded-xl bg-[#18202d] border border-[#293649] flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black font-mono ${
                        isCovering ? 'bg-amber-500 text-black' : idx === 1 ? 'bg-slate-300 text-black' : 'bg-amber-800 text-amber-200'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-white">
                        {p.name}
                      </span>
                      <span className="text-[11px] text-amber-300/90 font-mono">
                        ({formatKM(p.stack)})
                      </span>
                    </div>

                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                      isCovering
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : idx === 1
                        ? 'bg-slate-300/20 text-slate-200 border-slate-400/40'
                        : 'bg-amber-800/20 text-amber-200 border-amber-700/40'
                    }`}>
                      {isCovering ? '🥇 1st (Covering Stack)' : `${idx + 1}${idx === 1 ? 'nd' : idx === 2 ? 'rd' : 'th'} Most Chips`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={holeTexts[p.id] || ''}
                      onChange={(e) => handleHoleChange(p.id, e.target.value)}
                      placeholder={`e.g. ${idx === 0 ? 'As Kd' : 'Qh Qs'}`}
                      className="flex-1 rounded-lg bg-[#090d14] border border-[#2b374a] px-3 py-1.5 text-xs text-white font-mono uppercase focus:outline-none focus:border-emerald-500"
                    />

                    {eq != null && (
                      <div className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold whitespace-nowrap">
                        {eq.toFixed(1)}%
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {parseError && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-950/60 border border-rose-500 text-rose-300 text-xs">
            <AlertCircle size={15} />
            <span>{parseError}</span>
          </div>
        )}
      </div>
    </div>
  );
}

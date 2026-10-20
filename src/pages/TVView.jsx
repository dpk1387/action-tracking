import React, { useState, useEffect, useMemo } from 'react';
import { subscribeLive, readLive, getShareCode } from '@/lib/liveSync';
import {
  money,
  formatBlinds,
  formatPlayerTagAmount,
  VARIANTS,
  GAME_TYPES,
  STREET_LABEL,
  SUIT_SYMBOL,
  SUIT_RED,
  rankDisplay,
  isAllInSituation,
  isAllInShowdown,
  positionForSeat,
} from '@/lib/poker';
import { levelTimerState, formatTimer, formatTimerLabel, scheduledLevelNumber } from '@/lib/levelTimer';
import { Maximize2, Minimize2, Tv, ListFilter } from 'lucide-react';
import AllInView from '@/components/poker/AllInView';
import TournamentClockView from '@/components/poker/TournamentClockView';
import { mttStore, useMTT } from '@/lib/mttStore';

function TVCard({ card }) {
  if (!card) return <div className="w-12 h-16 rounded-lg border-2 border-dashed border-slate-700/60" />;
  if (card.hidden) {
    return (
      <div className="w-12 h-16 rounded-lg bg-[#273527] border-2 border-[#4a5a4a] flex items-center justify-center shadow-lg">
        <span className="text-[#7fae7f] text-base font-bold">?</span>
      </div>
    );
  }
  const red = SUIT_RED[card.suit];
  return (
    <div className={`w-12 h-16 rounded-lg bg-slate-100 flex flex-col items-center justify-center font-bold text-lg shadow-xl ${red ? 'text-rose-600' : 'text-slate-900'}`}>
      <span>{rankDisplay(card.rank)}{SUIT_SYMBOL[card.suit]}</span>
    </div>
  );
}

export default function TVView() {
  const [liveState, setLiveState] = useState(() => readLive());
  const localMTT = useMTT();
  const [lastActionOnly, setLastActionOnly] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const unsub = subscribeLive((state) => {
      if (state) setLiveState(state);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const director = liveState?.director?.active ? liveState.director : (localMTT?.active ? localMTT : null);

  if (director) {
    return (
      <div className="relative min-h-screen bg-[#0a0d12]">
        <TournamentClockView directorState={director} isTV={true} />
        <button
          onClick={toggleFullscreen}
          className="fixed top-4 right-4 p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer z-50 shadow-lg"
          title="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </button>
      </div>
    );
  }

  const hand = liveState?.hand;
  const holeCards = liveState?.holeCards || liveState?._holeCards || {};
  const equity = liveState?.equity || null;
  const config = liveState?.config;
  const gameOver = liveState?.gameOver;
  const cur = hand?.currency || '$';
  const hideAmounts = !!liveState?.hideAmounts;
  const isTournament = hand?.mode === 'tournament' || config?.mode === 'tournament';
  const stackCurrency = isTournament ? '' : cur;

  // Reliable all-in detection
  const inAllIn = Boolean(
    hand && (
      isAllInShowdown(hand) ||
      isAllInSituation(hand, holeCards) ||
      (hand.players?.some((p) => p.status === 'allin') && hand.players?.filter((p) => p.status !== 'folded').length >= 2)
    )
  );

  const n = hand?.players?.length || 0;
  const buttonIdx = hand?.players ? hand.players.findIndex((p) => p.seat === hand.buttonSeat) : -1;

  // Order players starting from blinds (SB, BB) and ending with button (BTN)
  const orderedPlayers = useMemo(() => {
    if (!hand?.players || hand.players.length === 0) return [];
    return hand.players.map((p, originalIdx) => {
      const offset = (originalIdx - buttonIdx + n) % n;
      const posRank = offset === 0 ? n : offset; // 1: SB, 2: BB, ..., n: BTN
      const posLabel = positionForSeat(n, buttonIdx, originalIdx) || '';
      return { p, originalIdx, posRank, posLabel };
    }).sort((a, b) => a.posRank - b.posRank);
  }, [hand?.players, buttonIdx, n]);

  if (!hand && !gameOver) {
    return (
      <div className="min-h-screen bg-[#0d0f12] text-white flex flex-col items-center justify-center p-6 text-center">
        <Tv size={48} className="text-[#4a5a4a] mb-4 animate-pulse" />
        <h1 className="text-2xl font-bold mb-2">Poker TV Display Ready</h1>
        <p className="text-slate-400 max-w-md text-sm">
          Waiting for active game broadcast. Start or resume a session from the main Poker Tracker screen to mirror action here.
        </p>
        <div className="mt-4 font-mono text-xs text-slate-500">
          Share Code: {getShareCode() || 'local'}
        </div>
      </div>
    );
  }

  if (gameOver) {
    return (
      <div className="min-h-screen bg-[#0d0f12] text-white flex flex-col items-center justify-center p-8 text-center">
        <div className="text-emerald-400 text-5xl font-black mb-4 tracking-wider uppercase">
          Tournament Champion
        </div>
        <div className="text-6xl font-extrabold text-white mb-6">
          {gameOver.name}
        </div>
        <div className="text-slate-400 text-lg">
          Congratulations to the winner!
        </div>
      </div>
    );
  }

  const timer = levelTimerState(hand, now);
  const actions = hand?.actionHistory || [];
  const displayActions = lastActionOnly ? actions.slice(-1) : actions.slice(-14);
  const totalPot = hand.players.reduce((s, p) => s + (p.totalBet || 0), 0);

  return (
    <div className="min-h-screen bg-[#0d0f12] text-white flex flex-col select-none overflow-hidden p-3 sm:p-5">
      {/* Top Bar: Tournament Clock, Blinds, Status */}
      <div className="flex items-center justify-between border-b border-[#22272e] pb-3 mb-3 gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-lg sm:text-xl font-bold tracking-tight text-emerald-400">
              HAND #{hand.handNumber}
            </span>
          </div>
          <span className="text-slate-600 text-base">|</span>
          <span className="text-slate-300 font-semibold text-base sm:text-lg">
            {VARIANTS[hand.variant]?.label || "Hold'em"} ({GAME_TYPES[hand.gameType] || 'NL'})
          </span>
          {hand.blindSchedule?.length > 0 && (
            <span className="bg-[#242b23] border border-[#3b4c3a] text-emerald-300 text-xs px-2.5 py-1 rounded font-bold">
              Level {scheduledLevelNumber(hand)}
            </span>
          )}
        </div>

        {/* Central Timer */}
        {timer.active && (
          <div className="flex items-center gap-3 bg-[#191d23] border border-[#2c333d] px-4 py-1.5 rounded-xl shadow-lg">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">
              {timer.phase === 'break' ? 'Break' : 'Clock'}:
            </span>
            <span className={`font-mono text-2xl sm:text-3xl font-extrabold ${timer.expired ? 'text-rose-400' : 'text-white'}`}>
              {formatTimer(timer)}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {formatTimerLabel(timer)}
            </span>
          </div>
        )}

        {/* Controls & Fullscreen */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setLastActionOnly((v) => !v)}
            className="flex items-center gap-1.5 bg-[#191d23] hover:bg-[#252c36] text-xs px-3 py-1.5 rounded-lg border border-[#2a2f37] text-slate-300 cursor-pointer"
          >
            <ListFilter size={14} />
            {lastActionOnly ? 'Last Action Only' : 'Full Action Feed'}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-[#191d23] hover:bg-[#252c36] text-slate-300 border border-[#2a2f37] cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {/* Main TV Layout: Left (Table & Board / All In View) | Right (Action Feed & Stacks) */}
      {/* Width of sidebar lowered by ~25% to give ample room to actual action view, eliminating horizontal scrolling */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch min-h-0">
        {/* Table & Board View or All In View (lg:col-span-9 - widened by 25% of sidebar) */}
        {inAllIn ? (
          <div className="lg:col-span-9 flex flex-col min-w-0">
            <AllInView
              hand={hand}
              holeCards={holeCards}
              equity={equity}
              hideAmounts={hideAmounts}
              pot={totalPot}
            />
          </div>
        ) : (
          <div className="lg:col-span-9 flex flex-col justify-between bg-[#15181d] rounded-2xl border border-[#252b33] p-5 shadow-2xl relative min-w-0">
            {/* Header Blinds banner */}
            <div className="flex items-center justify-between bg-[#1c222b] p-3.5 rounded-xl border border-[#2a3442]">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">Blinds</div>
                <div className="text-xl sm:text-2xl font-black text-white">
                  {formatBlinds(hand)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">Current Street</div>
                <div className="text-xl sm:text-2xl font-black text-emerald-400">
                  {STREET_LABEL[hand.street] || 'Preflop'}
                </div>
              </div>
            </div>

            {/* Table Center with Pot & Community Cards */}
            <div className="my-auto py-6 flex flex-col items-center justify-center">
              {/* Pot Banner - Hidden if hideAmounts */}
              <div className="text-center mb-5">
                <span className="text-xs uppercase tracking-widest text-slate-400 font-bold block mb-1">Total Pot</span>
                <span className="text-4xl sm:text-5xl font-black text-emerald-300 drop-shadow-md">
                  {hideAmounts ? '—' : money(totalPot, cur)}
                </span>
              </div>

              {/* Board Cards */}
              <div className="flex flex-col items-center gap-3">
                <div className="flex gap-2.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <TVCard key={i} card={hand.communityCards?.[i]} />
                  ))}
                </div>
                {hand.doubleBoard && (
                  <div className="flex gap-2.5 mt-2">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <TVCard key={`b-${i}`} card={hand.boardB?.[i]} />
                    ))}
                  </div>
                )}
              </div>

              {/* Turn Announcement */}
              {hand.currentPlayer >= 0 && (
                <div className="mt-6 bg-[#253224] border border-[#4a6b48] px-5 py-2 rounded-full flex items-center gap-3 shadow-lg animate-pulse">
                  <span className="text-xs uppercase tracking-wider text-emerald-300 font-semibold">Action On:</span>
                  <span className="text-base sm:text-lg font-bold text-white">
                    {hand.players[hand.currentPlayer]?.name}
                  </span>
                </div>
              )}
            </div>

            {/* Quick Player Bar - Ordered by position starting from blinds (SB, BB) to button (BTN) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 pt-2 border-t border-[#22272e]">
              {orderedPlayers.map(({ p, originalIdx, posLabel }) => {
                const isTurn = hand.currentPlayer === originalIdx;
                const isFolded = p.status === 'folded';
                const isAllInPlayer = p.status === 'allin';
                const isBtn = originalIdx === buttonIdx;

                return (
                  <div
                    key={p.id}
                    className={`p-2 rounded-lg border text-center transition-all ${
                      isTurn
                        ? 'bg-[#293628] border-emerald-400 shadow-md scale-102 ring-1 ring-emerald-400/50'
                        : isAllInPlayer
                        ? 'bg-[#3d2020] border-rose-500'
                        : isFolded
                        ? 'bg-[#15171a] border-[#22262d] opacity-40'
                        : 'bg-[#1a1f26] border-[#28303d]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5 px-0.5">
                      <span className="font-bold uppercase text-slate-300">{posLabel || '—'}</span>
                      {isBtn && <span className="bg-white text-black text-[9px] font-bold px-1 rounded">D</span>}
                    </div>
                    <div className="text-xs font-semibold text-slate-200 truncate">
                      {p.name}
                    </div>
                    <div className={`text-xs font-bold font-mono mt-0.5 ${isAllInPlayer ? 'text-rose-300' : 'text-white'}`}>
                      {hideAmounts ? '—' : formatPlayerTagAmount(p.stack, stackCurrency, hand)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sidebar: Action Log & Player Stacks (lg:col-span-3 - lowered width by ~25%) */}
        <div className="lg:col-span-3 flex flex-col gap-3 min-w-0">
          {/* Action Log Box */}
          <div className="flex-1 bg-[#15181d] rounded-2xl border border-[#252b33] p-4 flex flex-col min-h-[220px]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 border-b border-[#22272e] pb-1.5">
              {lastActionOnly ? 'Latest Action' : 'Live Action Log'}
            </h3>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
              {displayActions.length === 0 ? (
                <div className="text-xs text-slate-500 py-6 text-center">
                  Waiting for initial hand action...
                </div>
              ) : (
                displayActions.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-1.5 rounded-lg bg-[#1c222b] border border-[#28303d] text-xs"
                  >
                    <div className="truncate mr-1">
                      <span className="text-slate-400 mr-1.5 font-mono text-[10px]">[{STREET_LABEL[a.street] || a.street}]</span>
                      <span className="font-bold text-white">{a.player}</span>
                    </div>
                    <div className="font-semibold text-emerald-400 shrink-0 text-right">
                      {a.action} {hideAmounts ? '' : (a.chips ? (stackCurrency ? money(a.chips, stackCurrency) : a.chips.toLocaleString()) : '')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Player Leaderboard */}
          <div className="bg-[#15181d] rounded-2xl border border-[#252b33] p-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Chip Counts</h4>
            <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
              {[...hand.players]
                .sort((a, b) => b.stack - a.stack)
                .map((p, idx) => (
                  <div key={p.id} className="flex items-center justify-between text-xs py-0.5 px-1.5 rounded hover:bg-[#1e242d]">
                    <span className="text-slate-300 truncate mr-2">
                      <span className="text-slate-500 mr-1 text-[10px]">{idx + 1}.</span> {p.name}
                    </span>
                    <span className="font-bold font-mono text-emerald-400 shrink-0">
                      {hideAmounts ? '—' : (stackCurrency ? money(p.stack, stackCurrency) : p.stack.toLocaleString())}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

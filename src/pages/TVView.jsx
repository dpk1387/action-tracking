import React, { useState, useEffect, useMemo } from 'react';
import { subscribeLive, readLive, getShareCode } from '@/lib/liveSync';
import {
  money,
  formatPotAmount,
  getMultipleBoardWinPercentages,
  formatBlinds,
  formatPlayerTagAmount,
  formatBetAmount,
  VARIANTS,
  GAME_TYPES,
  STREET_LABEL,
  SUIT_SYMBOL,
  SUIT_RED,
  rankDisplay,
  isAllInSituation,
  isAllInShowdown,
  positionForSeat,
  hasSoleDeepestStack,
  bettingFrozen,
  positions,
} from '@/lib/poker';
import { levelTimerState, formatTimer, formatTimerLabel, scheduledLevelNumber } from '@/lib/levelTimer';
import { Maximize2, Minimize2, Tv } from 'lucide-react';
import TournamentClockView from '@/components/poker/TournamentClockView';
import PokerTable from '@/components/poker/PokerTable';
import { useMTT } from '@/lib/mttStore';

function raiseLabelLocal(level) {
  if (!level || level <= 1) return 'Bet';
  if (level === 2) return 'Raise';
  return `${level}-bet`;
}

function BroadcastCard({ card }) {
  if (!card) return null;
  if (card.hidden) {
    return (
      <div className="w-8 h-11 sm:w-9 sm:h-12 rounded bg-[#1e251e] border border-amber-600/40 flex items-center justify-center shadow">
        <span className="text-amber-300 font-bold text-xs">?</span>
      </div>
    );
  }
  const red = SUIT_RED[card.suit];
  return (
    <div className="w-8 h-11 sm:w-9 sm:h-12 rounded-md bg-white border border-slate-300 flex flex-col items-center justify-center shadow-lg leading-none select-none px-1 shrink-0">
      <span className={`text-xs sm:text-sm font-black ${red ? 'text-rose-600' : 'text-slate-900'}`}>
        {rankDisplay(card.rank)}
      </span>
      <span className={`text-xs sm:text-sm ${red ? 'text-rose-600' : 'text-slate-900'}`}>
        {SUIT_SYMBOL[card.suit]}
      </span>
    </div>
  );
}

function getPlayerEquity(equity, p, hand, holeCards) {
  if (p.status === 'folded') return null;

  const isTriple = (Number(hand?.bombBoards) >= 3) || (hand?.boardC && hand?.boardC.length > 0) || (Number(hand?.runTimes) >= 3);
  const isMultipleBoards = Boolean(hand?.doubleBoard || isTriple || (Number(hand?.runTimes) >= 2));

  // Check multiple boards win percentage first
  if (isMultipleBoards && hand && holeCards) {
    const multiPct = getMultipleBoardWinPercentages(hand, holeCards);
    if (multiPct && multiPct[p.id] != null) {
      const val = multiPct[p.id];
      if (val >= 99.9) return '100%';
      if (val <= 0.05 && val > 0) return '<1%';
      if (Math.round(val) === 33) return '33%';
      if (Math.round(val) === 67 || Math.round(val) === 66) return '67%';
      if (Math.round(val) === 50) return '50%';
      return `${Math.round(val)}%`;
    }
  }

  if (!equity) return null;
  const val = equity.byId ? (equity.byId[p.id] ?? equity.byId[p.seat]) : (equity[p.id] ?? equity[p.seat]);
  if (val == null) return null;
  const num = Number(val);
  if (isNaN(num)) return null;
  const pct = num <= 1 ? (num * 100) : num;
  if (isMultipleBoards) {
    if (pct >= 99.9) return '100%';
    if (pct <= 0.05 && pct > 0) return '<1%';
    if (Math.round(pct) === 33) return '33%';
    if (Math.round(pct) === 67 || Math.round(pct) === 66) return '67%';
    if (Math.round(pct) === 50) return '50%';
    return `${Math.round(pct)}%`;
  }
  return `${Math.round(pct)}%`;
}

function getBroadcastActionText(p, isTurn, hand, cur, isSoleDeepest, actionEnded, viewOption = 'grid', lastActionPlayerName = null, activeUnit = 'chips') {
  if (p.status === 'folded') return 'FOLDED';

  const allin = p.status === 'allin' || p.stack <= 0 || p.lastAction?.type === 'allin';
  if (actionEnded && isSoleDeepest) {
    return '';
  }
  if (allin) {
    const amt = p.lastAction?.amount || p.currentBet;
    return amt ? `ALL IN FOR ${formatBetAmount(amt, cur, hand, activeUnit)}` : 'ALL-IN';
  }

  if (isTurn) {
    const toCall = Math.max(0, (hand.currentBet || 0) - (p.currentBet || 0));
    if (toCall > 0) {
      return `${formatBetAmount(toCall, cur, hand, activeUnit)} TO CALL`;
    }
    return 'TO ACT';
  }

  // If in last_action mode, hide action for everyone except the player who acted last
  if (viewOption === 'last_action') {
    if (!lastActionPlayerName || p.name !== lastActionPlayerName) {
      return '';
    }
  }

  const la = p.lastAction;
  if (la) {
    if (la.type === 'check') return 'CHECK';
    if (la.type === 'fold') return 'FOLDED';
    if (la.type === 'call') return `CALL ${formatBetAmount(la.callAmount != null ? la.callAmount : la.amount, cur, hand, activeUnit)}`;
    if (la.type === 'bet' || la.type === 'raise') {
      const lbl = raiseLabelLocal(la.raiseLevel).toUpperCase();
      return `${lbl} ${formatBetAmount(la.amount, cur, hand, activeUnit)}`;
    }
    if (la.type === 'sb' || la.type === 'bb' || la.type === '3b' || la.type === '4b') {
      return `${la.type.toUpperCase()} ${formatBetAmount(la.amount, cur, hand, activeUnit)}`;
    }
    if (la.type === 'straddle') return `STRADDLE ${formatBetAmount(la.amount, cur, hand, activeUnit)}`;
    if (la.type === 'kill') return `KILL ${formatBetAmount(la.amount, cur, hand, activeUnit)}`;
  }

  if (p.currentBet > 0 && viewOption !== 'last_action') {
    return `POSTED ${formatBetAmount(p.currentBet, cur, hand, activeUnit)}`;
  }

  return '';
}

export default function TVView() {
  const [liveState, setLiveState] = useState(() => readLive());
  const localMTT = useMTT();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewOption, setViewOption] = useState('grid'); // 'grid' | 'last_action' | 'table'
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
  const isTournament = hand?.mode === 'tournament' || config?.mode === 'tournament';
  const cur = isTournament ? '' : (hand?.currency || '$');
  const hideAmounts = !!liveState?.hideAmounts;
  const activeUnit = liveState?.displayUnit || hand?.displayUnit || 'chips';
  const stackCurrency = cur;

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
      const posLabel = positionForSeat(n, buttonIdx, originalIdx, hand?.variant) || '';
      return { p, originalIdx, posRank, posLabel };
    }).sort((a, b) => a.posRank - b.posRank);
  }, [hand?.players, hand?.variant, buttonIdx, n]);

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
  const totalPot = hand.players ? hand.players.reduce((s, p) => s + (p.totalBet || 0), 0) : 0;
  const actionEnded = hand.currentPlayer === -1 || bettingFrozen(hand) || hand.phase === 'ended' || hand.phase === 'awarded';

  const playerWinnings = useMemo(() => {
    if (!hand || hand.phase !== 'awarded' || !hand.pots) return {};
    const wins = {};
    (hand.pots || []).forEach((pot) => {
      (pot.winners || []).forEach((w) => {
        const pid = typeof w === 'object' ? w.playerId : w;
        const amt = typeof w === 'object' ? (w.amount || 0) : (pot.amount / (pot.winners.length || 1));
        wins[pid] = (wins[pid] || 0) + amt;
      });
    });
    return wins;
  }, [hand?.phase, hand?.pots]);

  const boardA = (hand.communityCards || []).filter((c) => c && !c.hidden);
  const boardB = (hand.boardB || []).filter((c) => c && !c.hidden);
  const boardC = (hand.boardC || []).filter((c) => c && !c.hidden);
  const numBoards = boardC.length > 0 ? 3 : boardB.length > 0 ? 2 : 1;

  const showListView = actionEnded && inAllIn;

  return (
    <div className="min-h-screen bg-[#090b0e] text-white flex flex-col select-none overflow-x-hidden p-3 sm:p-5">
      {/* Top Bar: Hand #, Variant, Level, Blinds, Timer, Fullscreen */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800/80 pb-3 mb-3 gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-lg sm:text-xl font-black tracking-tight text-emerald-400 font-mono">
              HAND #{hand.handNumber}
            </span>
          </div>
          <span className="text-slate-600 text-base">|</span>
          <span className="text-slate-200 font-bold text-sm sm:text-base">
            {VARIANTS[hand.variant]?.label || "Hold'em"} ({GAME_TYPES[hand.gameType] || 'NL'})
          </span>
          {hand.blindSchedule?.length > 0 && (
            <span className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs px-2.5 py-0.5 rounded-full font-bold">
              Level {scheduledLevelNumber(hand)}
            </span>
          )}
          <span className="text-slate-600 text-base">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs uppercase font-bold text-slate-400">Blinds:</span>
            <span className="text-sm sm:text-base font-extrabold text-white font-mono">
              {formatBlinds(hand)}
            </span>
          </div>
          <span className="text-slate-600 text-base">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs uppercase font-bold text-slate-400">Street:</span>
            <span className="text-sm sm:text-base font-extrabold text-emerald-400 uppercase">
              {STREET_LABEL[hand.street] || 'Preflop'}
            </span>
          </div>
        </div>

        {/* Central Timer & Viewing Options & Fullscreen */}
        <div className="flex flex-wrap items-center gap-2.5 ml-auto">
          {/* 3 Viewing options */}
          <div className="flex items-center gap-1 bg-[#141820] border border-slate-700/80 p-1 rounded-xl shadow">
            <button
              type="button"
              onClick={() => setViewOption('grid')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                viewOption === 'grid'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Broadcast Grid
            </button>
            <button
              type="button"
              onClick={() => setViewOption('last_action')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                viewOption === 'last_action'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Last Action Only
            </button>
            <button
              type="button"
              onClick={() => setViewOption('table')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                viewOption === 'table'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Table View
            </button>
          </div>

          {timer.active && (
            <div className="flex items-center gap-2.5 bg-[#141820] border border-slate-700/80 px-3.5 py-1.5 rounded-xl shadow-lg">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                {timer.phase === 'break' ? 'Break' : 'Clock'}:
              </span>
              <span className={`font-mono text-xl sm:text-2xl font-extrabold ${timer.expired ? 'text-rose-400' : 'text-white'}`}>
                {formatTimer(timer)}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {formatTimerLabel(timer)}
              </span>
            </div>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-[#141820] hover:bg-[#1e2430] text-slate-300 border border-slate-700/80 cursor-pointer shadow"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {/* Main TV Display Area */}
      <div className="flex-1 flex flex-col justify-start max-w-6xl w-full mx-auto py-2">
        {/* Pot Size Display - Respected by hideAmounts, hidden for TABLE VIEW and LIST VIEW */}
        {viewOption !== 'table' && !showListView && (
          <div className="flex flex-col items-center justify-center py-2 mb-4">
            <div className="text-xs uppercase tracking-widest text-amber-300 font-extrabold mb-0.5">
              Total Pot
            </div>
            <div className="text-4xl sm:text-6xl font-black text-white font-mono tracking-tight drop-shadow-lg">
              {hideAmounts ? '—' : formatPotAmount(totalPot, cur, hand, activeUnit)}
            </div>
          </div>
        )}

        {viewOption === 'table' ? (
          /* ========================================================= */
          /* TABLE VIEW: Mirrors the exact table view graphic          */
          /* ========================================================= */
          <div className="w-full max-w-5xl mx-auto my-2">
            <PokerTable
              hand={{ ...hand, displayUnit: activeUnit }}
              holeCards={holeCards}
              equity={equity}
              sidePots={hand.pots || []}
              pot={totalPot}
              positions={positions(hand)}
              tableSize={hand.tableSize || hand.players?.length || 9}
              hideAmounts={hideAmounts}
              cur={cur}
              alwaysShow={false}
              showPot={!hideAmounts}
              displayUnit={activeUnit}
            />
          </div>
        ) : showListView ? (
          /* ========================================================= */
          /* LIST VIEW: Displayed when action ends and there is an all-in */
          /* ========================================================= */
          <div className="w-full max-w-3xl mx-auto space-y-4">
            {/* Community Cards */}
            <div className="flex flex-col items-center justify-center gap-3 bg-[#11151c] border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="text-xs uppercase font-extrabold tracking-widest text-amber-400/90 flex items-center gap-2">
                <span>Community Cards</span>
                {numBoards > 1 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 border border-purple-500/60 text-purple-300">
                    {numBoards} Boards
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {numBoards > 1 && <span className="text-xs font-bold text-slate-400 mr-1">Board 1:</span>}
                {boardA.map((c, i) => <BroadcastCard key={i} card={c} />)}
                {boardA.length === 0 && <span className="text-xs text-slate-500 italic">No board cards dealt yet</span>}
              </div>
              {boardB.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-800/80 pt-2.5 w-full">
                  <span className="text-xs font-bold text-purple-300 mr-1">Board 2:</span>
                  {boardB.map((c, i) => <BroadcastCard key={i} card={c} />)}
                </div>
              )}
              {boardC.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-800/80 pt-2.5 w-full">
                  <span className="text-xs font-bold text-cyan-300 mr-1">Board 3:</span>
                  {boardC.map((c, i) => <BroadcastCard key={i} card={c} />)}
                </div>
              )}
            </div>

            {/* Active Contestants List - Strictly no folded players */}
            <div className="space-y-2">
              {orderedPlayers
                .filter(({ p }) => p.status !== 'folded' && p.status !== 'eliminated' && p.status !== 'out')
                .map(({ p, posLabel }) => {
                  // Look up strictly by player id, never by seat
                  const pCards = holeCards[p.id] ?? holeCards[String(p.id)] ?? [];
                  const playerEquity = getPlayerEquity(equity, p, hand, holeCards);
                  const isAllInPlayer = p.status === 'allin' || p.stack <= 0;
                  const wonAmt = playerWinnings[p.id];
                  const hasWon = wonAmt != null && wonAmt > 0;
                  const profit = hasWon ? wonAmt - (p.totalBet || 0) : null;

                  return (
                    <div
                      key={p.id}
                      className={`flex flex-wrap items-center justify-between rounded-xl p-3 border-2 transition-all gap-3 shadow-xl ${
                        hasWon
                          ? 'bg-[#152418] border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                          : isAllInPlayer
                          ? 'bg-[#1a141b] border-rose-500/70'
                          : 'bg-[#12161f] border-slate-800'
                      }`}
                    >
                      {/* Left: Position, Name, Stack */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="px-2 py-0.5 rounded bg-black/60 border border-slate-700 text-xs font-extrabold text-slate-300 uppercase shrink-0">
                          {posLabel || '—'}
                        </span>
                        <div className="flex items-baseline gap-2 truncate">
                          <span className="text-base sm:text-lg font-black text-white truncate">
                            {p.name}
                          </span>
                          {!isTournament && (
                            <span className="text-xs text-slate-500 shrink-0">
                              (Seat {p.seat})
                            </span>
                          )}
                        </div>
                        <span className="font-mono font-black text-amber-300 text-sm sm:text-base shrink-0 ml-1">
                          {hideAmounts ? '—' : formatPlayerTagAmount(p.stack, stackCurrency, hand, false, activeUnit)}
                        </span>
                        {/* Profit or All-in Outcome Badge */}
                        {hasWon ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500 text-emerald-300 text-xs font-black shrink-0 flex items-center gap-1 shadow">
                            ✓ {profit >= 0 ? `+${money(profit, cur)}` : money(profit, cur)}
                          </span>
                        ) : isAllInPlayer ? (
                          <span className="px-2 py-0.5 rounded bg-rose-950 border border-rose-600/70 text-rose-300 text-[11px] font-bold shrink-0">
                            ALL-IN
                          </span>
                        ) : null}
                      </div>

                      {/* Right: Equity and Hole Cards */}
                      <div className="flex items-center gap-2.5 shrink-0 ml-auto">
                        {playerEquity && (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-950/90 border border-emerald-500/80 text-emerald-300 font-mono text-sm sm:text-base font-black shadow">
                            {playerEquity}
                          </span>
                        )}
                        <div className="flex items-center gap-1.5">
                          {pCards.map((c, ci) => (
                            <BroadcastCard key={ci} card={c} />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* STANDARD VIEW: 2-column broadcast banner boxes             */
          /* ========================================================= */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full max-w-[620px] mx-auto">
            {orderedPlayers
              .filter(({ p }) => !inAllIn || (p.status !== 'folded' && p.status !== 'eliminated' && p.status !== 'out'))
              .map(({ p, originalIdx, posLabel }) => {
                const isTurn = hand.currentPlayer === originalIdx;
                const isFolded = p.status === 'folded';
                const isOut = p.status === 'eliminated' || p.status === 'out';
                const isAllInPlayer = p.status === 'allin';
                const isSoleDeepest = hasSoleDeepestStack(hand, p.id);
                const lastActionPlayerName = Array.isArray(hand?.actionHistory) && hand.actionHistory.length > 0
                  ? hand.actionHistory[hand.actionHistory.length - 1]?.player
                  : null;
                const actionText = getBroadcastActionText(p, isTurn, hand, cur, isSoleDeepest, actionEnded, viewOption, lastActionPlayerName, activeUnit);

                // Hole cards & equity are ONLY displayed if it's an all-in situation AND player is not folded or out
                const pCards = (!isFolded && !isOut) ? (holeCards[p.id] ?? holeCards[String(p.id)] ?? []) : [];
                const showCardsAndEquity = inAllIn && !isFolded && !isOut;
                const playerEquity = showCardsAndEquity ? getPlayerEquity(equity, p, hand, holeCards) : null;

                return (
                  <div
                    key={p.id}
                    className={`rounded-xl overflow-hidden border-2 transition-all flex flex-col shadow-2xl relative w-full ${
                      isTurn
                        ? 'border-amber-400 ring-2 ring-amber-400/80 shadow-[0_0_20px_rgba(245,158,11,0.5)]'
                        : isAllInPlayer
                        ? 'border-rose-500 ring-1 ring-rose-500/60'
                        : isFolded || isOut
                        ? 'border-slate-800 opacity-40 grayscale'
                        : 'border-slate-800'
                    }`}
                  >
                    {/* TOP HALF: Yellow only when active turn, otherwise solid black */}
                    <div
                      className={`px-3.5 py-2 flex items-center justify-between min-h-[56px] transition-colors ${
                        isTurn
                          ? 'bg-gradient-to-r from-[#cfac3e] via-[#f3d058] to-[#cfac3e]'
                          : 'bg-black border-b border-zinc-800'
                      }`}
                    >
                      {/* Left: Player Name (Black if turn, white if not turn) */}
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span
                          className={`font-black uppercase text-base sm:text-lg tracking-wider truncate ${
                            isTurn ? 'text-black' : 'text-white'
                          }`}
                        >
                          {p.name}
                        </span>
                      </div>

                      {/* Center: Hole Cards (ONLY shown if all-in and not folded/out) */}
                      {showCardsAndEquity && pCards.length > 0 && (
                        <div className="flex items-center gap-1.5 px-2">
                          {pCards.map((c, ci) => (
                            <BroadcastCard key={ci} card={c} />
                          ))}
                        </div>
                      )}

                      {/* Right: Equity on top & Position Tag below */}
                      <div className="flex flex-col items-end shrink-0 pl-2 leading-none z-10 gap-0.5">
                        {showCardsAndEquity && playerEquity && (
                          <span
                            className={`font-black text-sm sm:text-base font-mono ${
                              isTurn ? 'text-black' : 'text-white'
                            }`}
                          >
                            {playerEquity}
                          </span>
                        )}
                        <span
                          className={`font-extrabold text-xs uppercase tracking-wider ${
                            isTurn ? 'text-black' : 'text-slate-300'
                          }`}
                        >
                          {posLabel || '—'}
                        </span>
                      </div>
                    </div>

                    {/* BOTTOM HALF: Solid Black Bar */}
                    <div className="bg-black px-3 py-1.5 relative flex items-center justify-between border-t border-black min-h-[36px]">
                      {/* Left: Player Stack Size (Gold font, respected by hideAmounts) */}
                      <div className="text-[#f3d058] font-black font-mono text-sm sm:text-base tracking-tight shrink-0 z-10">
                        {hideAmounts ? '—' : formatPlayerTagAmount(p.stack, stackCurrency, hand, false, activeUnit)}
                      </div>

                      {/* Center: Action / Status / Amount to call (Centered bold white font) */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-12">
                        <span className="text-white font-black text-xs sm:text-[13px] uppercase tracking-wide truncate font-mono">
                          {actionText}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

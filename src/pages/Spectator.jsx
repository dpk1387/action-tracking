import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { subscribeLive, readLive } from '@/lib/liveSync';
import { db } from '@/api/base44Client';
import {
  money,
  formatPotAmount,
  formatBlinds,
  formatPlayerTagAmount,
  formatBetAmount,
  raiseLabel,
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
import { levelTimerState, formatTimer, formatTimerLabel } from '@/lib/levelTimer';
import { Eye, Clock } from 'lucide-react';
import AllInView from '@/components/poker/AllInView';
import TournamentClockView from '@/components/poker/TournamentClockView';
import { useMTT } from '@/lib/mttStore';

function getSpectatorAction(p, isTurn, hand, cur, activeUnit = 'chips') {
  if (p.status === 'folded') {
    return { text: 'FOLD', cls: 'bg-slate-900 border border-slate-700 text-slate-400' };
  }
  if (p.status === 'allin' || p.stack <= 0) {
    const amt = p.lastAction?.amount || p.currentBet || p.totalBet;
    return {
      text: amt ? `ALL-IN ${formatBetAmount(amt, cur, hand, activeUnit)}` : 'ALL-IN',
      cls: 'bg-rose-950 border border-rose-500 text-rose-300 animate-pulse',
    };
  }
  if (isTurn) {
    const toCall = Math.max(0, (hand.currentBet || 0) - (p.currentBet || 0));
    return {
      text: toCall > 0 ? `${formatBetAmount(toCall, cur, hand, activeUnit)} TO CALL` : 'TO ACT',
      cls: 'bg-amber-950 border border-amber-500 text-amber-300 animate-pulse',
    };
  }
  const la = p.lastAction;
  if (la) {
    if (la.type === 'check') return { text: 'CHECK', cls: 'bg-slate-800 text-slate-300' };
    if (la.type === 'fold') return { text: 'FOLD', cls: 'bg-slate-900 border border-slate-700 text-slate-400' };
    if (la.type === 'call') return { text: `CALL ${formatBetAmount(la.callAmount != null ? la.callAmount : la.amount, cur, hand, activeUnit)}`, cls: 'bg-emerald-950/80 border border-emerald-600 text-emerald-300 font-bold' };
    if (la.type === 'bet' || la.type === 'raise') {
      const lbl = la.raiseLevel === 2 ? 'RAISE' : la.raiseLevel > 2 ? `${la.raiseLevel}-BET` : 'BET';
      return { text: `${lbl} ${formatBetAmount(la.amount, cur, hand, activeUnit)}`, cls: 'bg-amber-950/80 border border-amber-500 text-amber-300 font-black' };
    }
    if (la.type === '3b' || la.type === '4b') {
      return { text: `${la.type.toUpperCase()} ${formatBetAmount(la.amount, cur, hand, activeUnit)}`, cls: 'bg-amber-950/80 border border-amber-500 text-amber-300 font-black' };
    }
    if (la.type === 'sb') return { text: `SB ${formatBetAmount(la.amount, cur, hand, activeUnit)}`, cls: 'bg-slate-800 text-slate-300' };
    if (la.type === 'bb') return { text: `BB ${formatBetAmount(la.amount, cur, hand, activeUnit)}`, cls: 'bg-slate-800 text-slate-300' };
    if (la.type === 'straddle') return { text: `STRADDLE ${formatBetAmount(la.amount, cur, hand, activeUnit)}`, cls: 'bg-purple-950 border border-purple-500 text-purple-300 font-bold' };
    if (la.type === 'kill') return { text: `KILL ${formatBetAmount(la.amount, cur, hand, activeUnit)}`, cls: 'bg-rose-950 border border-rose-500 text-rose-300 font-bold' };
  }
  return null;
}

function SpectatorCard({ card }) {
  if (!card) return <div className="w-10 h-14 sm:w-12 sm:h-16 rounded-md border border-dashed border-slate-700" />;
  if (card.hidden) {
    return (
      <div className="w-10 h-14 sm:w-12 sm:h-16 rounded-md bg-[#253225] border border-[#4a5a4a] flex items-center justify-center">
        <span className="text-[#7fae7f] text-sm font-bold">?</span>
      </div>
    );
  }
  const red = SUIT_RED[card.suit];
  return (
    <div className={`w-10 h-14 sm:w-12 sm:h-16 rounded-md bg-slate-100 flex flex-col items-center justify-center text-sm sm:text-base font-bold shadow ${red ? 'text-rose-600' : 'text-slate-900'}`}>
      <span>{rankDisplay(card.rank)}{SUIT_SYMBOL[card.suit]}</span>
    </div>
  );
}

export default function Spectator() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const [liveState, setLiveState] = useState(() => readLive());
  const localMTT = useMTT();
  const [loading, setLoading] = useState(!liveState);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Subscribe to BroadcastChannel / local storage
  useEffect(() => {
    const unsub = subscribeLive((state) => {
      if (state) {
        setLiveState(state);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  // Also query backend if code is provided
  useEffect(() => {
    if (!code) return;
    const fetchRemote = async () => {
      try {
        const res = await db.functions.invoke('readLiveSession', { shareCode: code });
        if (res.data?.state) {
          setLiveState(res.data.state);
          setLoading(false);
        }
      } catch (e) {
        console.error('Failed to read live session', e);
      }
    };
    fetchRemote();
    const interval = setInterval(fetchRemote, 2500);
    return () => clearInterval(interval);
  }, [code]);

  const director = liveState?.director?.active ? liveState.director : (localMTT?.active ? localMTT : null);

  if (director) {
    return (
      <div className="min-h-screen bg-[#0a0d12]">
        <TournamentClockView directorState={director} isSpectator={true} />
      </div>
    );
  }

  const hand = liveState?.hand;
  const config = liveState?.config;
  // Spectator view: amounts should never be hidden because spectators are away from the venue
  const hideAmounts = false;
  const isTournament = hand?.mode === 'tournament' || config?.mode === 'tournament';
  const cur = isTournament ? '' : (hand?.currency || '$');
  const stackCurrency = cur;

  const potTotal = hand?.players ? hand.players.reduce((s, p) => s + (p.totalBet || 0), 0) : 0;
  const actions = hand?.actionHistory || [];
  const holeCards = liveState?.holeCards || liveState?._holeCards || {};
  const equity = liveState?.equity || null;

  const timerState = isTournament && hand ? levelTimerState(hand, now) : null;

  // Detect all-in situation reliably so spectator view ALWAYS switches to all in view
  const inAllIn = Boolean(
    hand && (
      isAllInShowdown(hand) ||
      isAllInSituation(hand, holeCards) ||
      (hand.players?.some((p) => p.status === 'allin') && hand.players?.filter((p) => p.status !== 'folded').length >= 2)
    )
  );

  const n = hand?.players?.length || 0;
  const buttonIdx = hand?.players ? hand.players.findIndex((p) => p.seat === hand.buttonSeat) : -1;

  // Order players by position starting from blinds (SB, BB) and ending with button (BTN)
  const orderedPlayers = useMemo(() => {
    if (!hand?.players || hand.players.length === 0) return [];
    return hand.players.map((p, originalIdx) => {
      const offset = (originalIdx - buttonIdx + n) % n;
      const posRank = offset === 0 ? n : offset; // 1: SB, 2: BB, ..., n: BTN
      const posLabel = positionForSeat(n, buttonIdx, originalIdx, hand?.variant) || '';
      return { p, originalIdx, posRank, posLabel };
    }).sort((a, b) => a.posRank - b.posRank);
  }, [hand?.players, hand?.variant, buttonIdx, n]);

  if (loading && !hand) {
    return (
      <div className="min-h-screen bg-[#121417] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-8 h-8 border-4 border-[#2a2f37] border-t-emerald-400 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 text-sm">Connecting to poker table stream...</p>
      </div>
    );
  }

  if (!hand) {
    return (
      <div className="min-h-screen bg-[#121417] text-white flex flex-col items-center justify-center p-6 text-center">
        <Eye size={40} className="text-slate-600 mb-3" />
        <h2 className="text-xl font-bold mb-1">No Active Hand</h2>
        <p className="text-slate-400 text-sm max-w-sm">
          The table host is currently between hands or hasn't started the session yet.
        </p>
      </div>
    );
  }

  if (inAllIn) {
    return (
      <div className="min-h-screen bg-[#121417] text-white p-3 sm:p-6 max-w-6xl mx-auto space-y-4">
        {/* Top Banner */}
        <div className="flex items-center justify-between border-b border-[#2a2f37] pb-3 flex-wrap gap-2">
          <div>
            <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold block">
              Spectator View
            </span>
            <h1 className="text-lg sm:text-xl font-bold">
              Hand #{hand.handNumber} · {VARIANTS[hand.variant]?.label || "Hold'em"}
            </h1>
          </div>
          {timerState && timerState.active && (
            <div className="flex items-center gap-2 bg-[#1b222d] border border-emerald-500/40 rounded-xl px-3 py-1.5 shadow">
              <Clock size={16} className="text-emerald-400" />
              <div className="text-left">
                <div className="text-[11px] font-bold text-slate-300 leading-tight">
                  {formatTimerLabel(timerState)}
                </div>
                <div className="text-sm font-black font-mono text-emerald-300 leading-tight">
                  {formatTimer(timerState.timeRemainingMs)}
                  {timerState.paused && <span className="ml-1 text-[10px] text-amber-400 font-sans font-bold">(PAUSED)</span>}
                </div>
              </div>
            </div>
          )}
          <div className="text-right text-xs text-slate-400">
            <div>{hand.bombPot ? formatBlinds(hand) : `Blinds: ${formatBlinds(hand)}`}</div>
          </div>
        </div>

        <AllInView
          hand={hand}
          holeCards={holeCards}
          equity={equity}
          hideAmounts={false}
          pot={potTotal}
        />

        {/* Hand Action History Log */}
        <div className="rounded-xl border border-[#2a2f37] bg-[#1e2227] p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3 border-b border-[#2a2f37]/70 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Hand Action History ({actions.length})
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Hand #{hand.handNumber}</span>
          </div>
          <div className="space-y-1.5 max-h-56 overflow-y-auto text-xs">
            {actions.length === 0 ? (
              <div className="text-slate-500 py-3 text-center">No actions recorded yet.</div>
            ) : (
              [...actions].reverse().map((a, i) => (
                <div key={i} className="flex justify-between items-center py-1.5 border-b border-[#2a2f37]/50 text-slate-300">
                  <div>
                    <span className="text-slate-500 mr-2 font-mono text-[11px]">[{STREET_LABEL[a.street] || a.street}]</span>
                    <span className="font-semibold text-white">{a.player}</span>
                  </div>
                  <span className="text-emerald-400 font-semibold font-mono">
                    {a.action} {a.chips ? (cur ? money(a.chips, cur) : money(a.chips, '')) : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121417] text-white p-3 sm:p-6 max-w-6xl mx-auto space-y-4">
      {/* Top Banner */}
      <div className="flex items-center justify-between border-b border-[#2a2f37] pb-3 flex-wrap gap-2">
        <div>
          <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold block">
            Spectator View
          </span>
          <h1 className="text-lg sm:text-xl font-bold">
            Hand #{hand.handNumber} · {VARIANTS[hand.variant]?.label || "Hold'em"}
          </h1>
        </div>
        {timerState && timerState.active && (
          <div className="flex items-center gap-2 bg-[#1b222d] border border-emerald-500/40 rounded-xl px-3 py-1.5 shadow">
            <Clock size={16} className="text-emerald-400" />
            <div className="text-left">
              <div className="text-[11px] font-bold text-slate-300 leading-tight">
                {formatTimerLabel(timerState)}
              </div>
              <div className="text-sm font-black font-mono text-emerald-300 leading-tight">
                {formatTimer(timerState.timeRemainingMs)}
                {timerState.paused && <span className="ml-1 text-[10px] text-amber-400 font-sans font-bold">(PAUSED)</span>}
              </div>
            </div>
          </div>
        )}
        <div className="text-right text-xs text-slate-400">
          <div>{hand.bombPot ? formatBlinds(hand) : `Blinds: ${formatBlinds(hand)}`}</div>
        </div>
      </div>

      {/* Main Content: Responsive grid for Mobile and Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Pot & Board Area */}
        <div className="lg:col-span-7 rounded-2xl border border-[#2a2f37] bg-[#1e2227] p-5 sm:p-8 text-center shadow-lg space-y-4">
          <div>
            <span className="text-xs uppercase text-slate-400 tracking-wider">Pot Size</span>
            <div className="text-4xl sm:text-5xl font-extrabold text-white mt-0.5">
              {formatPotAmount(potTotal, cur)}
            </div>
            <div className="text-xs sm:text-sm text-emerald-300 font-medium mt-1">
              Street: {STREET_LABEL[hand.street] || 'Preflop'}
            </div>
          </div>

          {/* Board Cards */}
          <div className="flex justify-center gap-2 sm:gap-3 pt-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <SpectatorCard key={i} card={hand.communityCards?.[i]} />
            ))}
          </div>
          {hand.doubleBoard && (
            <div className="flex justify-center gap-2 sm:gap-3 pt-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <SpectatorCard key={`b-${i}`} card={hand.boardB?.[i]} />
              ))}
            </div>
          )}

          {hand.currentPlayer >= 0 && (
            <div className="text-xs sm:text-sm text-amber-300 font-semibold bg-[#2a2318] border border-amber-500/30 py-1.5 px-4 rounded-full inline-block">
              Action on: {hand.players[hand.currentPlayer]?.name}
            </div>
          )}
        </div>

        {/* Sidebar: Players (ordered SB to BTN) & Action Log */}
        <div className="lg:col-span-5 space-y-4">
          {/* Players & Stacks - Ordered from blinds to button */}
          <div className="rounded-xl border border-[#2a2f37] bg-[#1e2227] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Players & Stacks
              </h3>
              <span className="text-[10px] text-slate-500">Ordered SB → BTN</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
              {orderedPlayers.map(({ p, originalIdx, posLabel }) => {
                const isTurn = hand.currentPlayer === originalIdx;
                const isFolded = p.status === 'folded';
                const isAllInPlayer = p.status === 'allin';
                const action = getSpectatorAction(p, isTurn, hand, cur);

                return (
                  <div
                    key={p.id}
                    className={`p-2.5 rounded-lg border text-sm flex items-center justify-between transition-colors gap-2 ${
                      isTurn
                        ? 'bg-[#293628] border-emerald-400 shadow-md ring-1 ring-emerald-400/50'
                        : isAllInPlayer
                        ? 'bg-[#3d2020] border-rose-500'
                        : isFolded
                        ? 'bg-[#15171a] border-[#22262d] opacity-40'
                        : 'bg-[#15181d] border-[#2a2f37]'
                    }`}
                  >
                    <div className="truncate flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded bg-black/60 text-[10px] font-bold text-slate-300 uppercase shrink-0">
                        {posLabel || '—'}
                      </span>
                      <span className="font-semibold text-white truncate">
                        {p.name}
                      </span>
                    </div>

                    {/* Middle: Action Badge with amount */}
                    <div className="shrink-0 px-1">
                      {action && (
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase shrink-0 ${action.cls}`}>
                          {action.text}
                        </span>
                      )}
                    </div>

                    {/* Right: Stack Size */}
                    <div className="font-mono font-bold text-emerald-400 text-right whitespace-nowrap shrink-0">
                      {formatPlayerTagAmount(p.stack, stackCurrency, hand, !isTournament)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Actions */}
          <div className="rounded-xl border border-[#2a2f37] bg-[#1e2227] p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Hand Action Log
            </h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto text-xs">
              {actions.length === 0 ? (
                <div className="text-slate-500 py-4 text-center">No actions recorded yet.</div>
              ) : (
                [...actions].reverse().map((a, i) => (
                  <div key={i} className="flex justify-between py-1 border-b border-[#2a2f37]/50 text-slate-300">
                    <div>
                      <span className="text-slate-500 mr-2 font-mono">[{STREET_LABEL[a.street] || a.street}]</span>
                      <span className="font-medium text-white">{a.player}</span>
                    </div>
                    <span className="text-emerald-400 font-semibold font-mono">
                      {a.action} {hideAmounts ? '' : (a.chips ? (cur ? money(a.chips, cur) : money(a.chips, '')) : '')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

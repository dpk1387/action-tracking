import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { subscribeLive, readLive } from '@/lib/liveSync';
import { db } from '@/api/base44Client';
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
import { Eye } from 'lucide-react';
import AllInView from '@/components/poker/AllInView';
import TournamentClockView from '@/components/poker/TournamentClockView';
import { useMTT } from '@/lib/mttStore';

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
  const cur = hand?.currency || '$';
  const hideAmounts = !!liveState?.hideAmounts;
  const isTournament = hand?.mode === 'tournament' || config?.mode === 'tournament';
  const stackCurrency = isTournament ? '' : cur;

  const potTotal = hand?.players ? hand.players.reduce((s, p) => s + (p.totalBet || 0), 0) : 0;
  const actions = hand?.actionHistory || [];
  const holeCards = liveState?.holeCards || liveState?._holeCards || {};
  const equity = liveState?.equity || null;

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
      const posLabel = positionForSeat(n, buttonIdx, originalIdx) || '';
      return { p, originalIdx, posRank, posLabel };
    }).sort((a, b) => a.posRank - b.posRank);
  }, [hand?.players, buttonIdx, n]);

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
        <div className="flex items-center justify-between border-b border-[#2a2f37] pb-3">
          <div>
            <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold block">
              Spectator View
            </span>
            <h1 className="text-lg sm:text-xl font-bold">
              Hand #{hand.handNumber} · {VARIANTS[hand.variant]?.label || "Hold'em"}
            </h1>
          </div>
          <div className="text-right text-xs text-slate-400">
            <div>{hand.bombPot ? formatBlinds(hand) : `Blinds: ${formatBlinds(hand)}`}</div>
          </div>
        </div>

        <AllInView
          hand={hand}
          holeCards={holeCards}
          equity={equity}
          hideAmounts={hideAmounts}
          pot={potTotal}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121417] text-white p-3 sm:p-6 max-w-6xl mx-auto space-y-4">
      {/* Top Banner */}
      <div className="flex items-center justify-between border-b border-[#2a2f37] pb-3">
        <div>
          <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold block">
            Spectator View
          </span>
          <h1 className="text-lg sm:text-xl font-bold">
            Hand #{hand.handNumber} · {VARIANTS[hand.variant]?.label || "Hold'em"}
          </h1>
        </div>
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
              {hideAmounts ? '—' : money(potTotal, cur)}
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
                const isBtn = originalIdx === buttonIdx;

                return (
                  <div
                    key={p.id}
                    className={`p-2.5 rounded-lg border text-sm flex items-center justify-between transition-colors ${
                      isTurn
                        ? 'bg-[#293628] border-emerald-400 shadow-md ring-1 ring-emerald-400/50'
                        : isAllInPlayer
                        ? 'bg-[#3d2020] border-rose-500'
                        : isFolded
                        ? 'bg-[#15171a] border-[#22262d] opacity-40'
                        : 'bg-[#15181d] border-[#2a2f37]'
                    }`}
                  >
                    <div className="truncate mr-2 flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-black/60 text-[10px] font-bold text-slate-300 uppercase shrink-0">
                        {posLabel || '—'}
                      </span>
                      <div className="truncate">
                        <div className="font-semibold text-white truncate flex items-center gap-1">
                          {isBtn && <span className="bg-white text-black text-[9px] font-bold px-1 rounded">D</span>}
                          {p.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {isAllInPlayer ? 'ALL-IN' : isFolded ? 'Folded' : p.lastAction?.type || 'In hand'}
                        </div>
                      </div>
                    </div>
                    <div className="font-mono font-bold text-emerald-400 text-right whitespace-nowrap">
                      {hideAmounts ? '—' : formatPlayerTagAmount(p.stack, stackCurrency, hand)}
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
                    <span className="text-emerald-400 font-semibold">
                      {a.action} {hideAmounts ? '' : (a.chips ? (stackCurrency ? money(a.chips, stackCurrency) : a.chips.toLocaleString()) : '')}
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

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { subscribeLive, readLive } from '@/lib/liveSync';
import { db } from '@/api/base44Client';
import { money, formatBlinds, formatPlayerTagAmount, VARIANTS, GAME_TYPES, STREET_LABEL, SUIT_SYMBOL, SUIT_RED, rankDisplay, isAllInSituation } from '@/lib/poker';
import { Eye, Clock } from 'lucide-react';
import AllInView from '@/components/poker/AllInView';

function SpectatorCard({ card }) {
  if (!card) return <div className="w-10 h-14 rounded-md border border-dashed border-slate-700" />;
  if (card.hidden) {
    return (
      <div className="w-10 h-14 rounded-md bg-[#253225] border border-[#4a5a4a] flex items-center justify-center">
        <span className="text-[#7fae7f] text-sm">?</span>
      </div>
    );
  }
  const red = SUIT_RED[card.suit];
  return (
    <div className={`w-10 h-14 rounded-md bg-slate-100 flex flex-col items-center justify-center text-sm font-bold shadow ${red ? 'text-rose-600' : 'text-slate-900'}`}>
      <span>{rankDisplay(card.rank)}{SUIT_SYMBOL[card.suit]}</span>
    </div>
  );
}

export default function Spectator() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const [liveState, setLiveState] = useState(() => readLive());
  const [loading, setLoading] = useState(!liveState);

  // Subscribe to BroadcastChannel / storage
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

  const hand = liveState?.hand;
  const cur = hand?.currency || '$';

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

  const potTotal = hand.players.reduce((s, p) => s + (p.totalBet || 0), 0);
  const actions = hand.actionHistory || [];
  const holeCards = liveState?.holeCards || {};
  const equity = liveState?.equity || null;
  const inAllIn = isAllInSituation(hand, holeCards);

  if (inAllIn) {
    return (
      <div className="min-h-screen bg-[#121417] text-white p-4 max-w-4xl mx-auto space-y-4">
        {/* Top Banner */}
        <div className="flex items-center justify-between border-b border-[#2a2f37] pb-3">
          <div>
            <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold block">
              Spectator View
            </span>
            <h1 className="text-lg font-bold">
              Hand #{hand.handNumber} · {VARIANTS[hand.variant]?.label || "Hold'em"}
            </h1>
          </div>
          <div className="text-right text-xs text-slate-400">
            <div>Blinds: {formatBlinds(hand)}</div>
          </div>
        </div>

        <AllInView hand={hand} holeCards={holeCards} equity={equity} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121417] text-white p-4 max-w-xl mx-auto space-y-4">
      {/* Top Banner */}
      <div className="flex items-center justify-between border-b border-[#2a2f37] pb-3">
        <div>
          <span className="text-xs uppercase tracking-wider text-emerald-400 font-bold block">
            Spectator View
          </span>
          <h1 className="text-lg font-bold">
            Hand #{hand.handNumber} · {VARIANTS[hand.variant]?.label || "Hold'em"}
          </h1>
        </div>
        <div className="text-right text-xs text-slate-400">
          <div>Blinds: {formatBlinds(hand)}</div>
        </div>
      </div>

      {/* Pot & Board Area */}
      <div className="rounded-2xl border border-[#2a2f37] bg-[#1e2227] p-5 text-center shadow-lg space-y-4">
        <div>
          <span className="text-xs uppercase text-slate-400 tracking-wider">Pot Size</span>
          <div className="text-4xl font-extrabold text-white mt-0.5">
            {money(potTotal, cur)}
          </div>
          <div className="text-xs text-emerald-300 font-medium mt-1">
            Street: {STREET_LABEL[hand.street] || 'Preflop'}
          </div>
        </div>

        {/* Board Cards */}
        <div className="flex justify-center gap-2 pt-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <SpectatorCard key={i} card={hand.communityCards?.[i]} />
          ))}
        </div>
        {hand.doubleBoard && (
          <div className="flex justify-center gap-2 pt-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <SpectatorCard key={`b-${i}`} card={hand.boardB?.[i]} />
            ))}
          </div>
        )}

        {hand.currentPlayer >= 0 && (
          <div className="text-xs text-amber-300 font-semibold bg-[#2a2318] py-1.5 px-3 rounded-full inline-block">
            Action on: {hand.players[hand.currentPlayer]?.name}
          </div>
        )}
      </div>

      {/* Players & Stacks */}
      <div className="rounded-xl border border-[#2a2f37] bg-[#1e2227] p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Players & Stacks
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {hand.players.map((p, idx) => {
            const isTurn = hand.currentPlayer === idx;
            const isFolded = p.status === 'folded';
            const isAllIn = p.status === 'allin';
            const isBtn = p.seat === hand.buttonSeat;

            return (
              <div
                key={p.id}
                className={`p-2.5 rounded-lg border text-sm flex items-center justify-between ${
                  isTurn
                    ? 'bg-[#293628] border-emerald-400'
                    : isAllIn
                    ? 'bg-[#3d2020] border-rose-500'
                    : isFolded
                    ? 'bg-[#15171a] border-[#22262d] opacity-40'
                    : 'bg-[#15181d] border-[#2a2f37]'
                }`}
              >
                <div className="truncate mr-2">
                  <div className="font-semibold text-white truncate flex items-center gap-1">
                    {isBtn && <span className="bg-white text-black text-[9px] font-bold px-1 rounded">D</span>}
                    {p.name}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {isAllIn ? 'ALL-IN' : isFolded ? 'Folded' : p.lastAction?.type || 'In hand'}
                  </div>
                </div>
                <div className="font-mono font-bold text-white text-right">
                  {formatPlayerTagAmount(p.stack, cur, hand)}
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
        <div className="space-y-1.5 max-h-44 overflow-y-auto text-xs">
          {actions.length === 0 ? (
            <div className="text-slate-500 py-4 text-center">No actions recorded yet.</div>
          ) : (
            [...actions].reverse().map((a, i) => (
              <div key={i} className="flex justify-between py-1 border-b border-[#2a2f37]/50 text-slate-300">
                <span>
                  <span className="text-slate-500 mr-2 font-mono">{STREET_LABEL[a.street]}:</span>
                  <span className="font-medium text-white">{a.player}</span>
                </span>
                <span className="text-emerald-400 font-semibold">
                  {a.action} {a.chips ? money(a.chips, cur) : ''}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

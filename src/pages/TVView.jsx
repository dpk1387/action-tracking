import React, { useState, useEffect } from 'react';
import { subscribeLive, readLive, getShareCode } from '@/lib/liveSync';
import { money, formatBlinds, formatPlayerTagAmount, VARIANTS, GAME_TYPES, STREET_LABEL, SUIT_SYMBOL, SUIT_RED, rankDisplay, isAllInSituation } from '@/lib/poker';
import { levelTimerState, formatTimer, formatTimerLabel, scheduledLevelNumber } from '@/lib/levelTimer';
import { Maximize2, Minimize2, Tv, ListFilter } from 'lucide-react';
import AllInView from '@/components/poker/AllInView';

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

  const hand = liveState?.hand;
  const holeCards = liveState?.holeCards || {};
  const equity = liveState?.equity || null;
  const config = liveState?.config;
  const gameOver = liveState?.gameOver;
  const cur = hand?.currency || '$';
  const inAllIn = isAllInSituation(hand, holeCards);

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

  const buttonIdx = hand.players.findIndex((p) => p.seat === hand.buttonSeat);

  return (
    <div className="min-h-screen bg-[#0d0f12] text-white flex flex-col select-none overflow-hidden p-4 sm:p-6">
      {/* Top Bar: Tournament Clock, Blinds, Status */}
      <div className="flex items-center justify-between border-b border-[#22272e] pb-4 mb-4 gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-xl font-bold tracking-tight text-emerald-400">
              HAND #{hand.handNumber}
            </span>
          </div>
          <span className="text-slate-500 text-lg">|</span>
          <span className="text-slate-300 font-semibold text-lg">
            {VARIANTS[hand.variant]?.label || "Hold'em"} ({GAME_TYPES[hand.gameType] || 'NL'})
          </span>
          {hand.blindSchedule?.length > 0 && (
            <span className="bg-[#242b23] border border-[#3b4c3a] text-emerald-300 text-sm px-2.5 py-1 rounded font-bold">
              Level {scheduledLevelNumber(hand)}
            </span>
          )}
        </div>

        {/* Central Timer */}
        {timer.active && (
          <div className="flex items-center gap-3 bg-[#191d23] border border-[#2c333d] px-5 py-2 rounded-xl shadow-lg">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">
              {timer.phase === 'break' ? 'Break' : 'Clock'}:
            </span>
            <span className={`font-mono text-3xl font-extrabold ${timer.expired ? 'text-rose-400' : 'text-white'}`}>
              {formatTimer(timer)}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {formatTimerLabel(timer)}
            </span>
          </div>
        )}

        {/* Controls & Fullscreen */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLastActionOnly((v) => !v)}
            className="flex items-center gap-1.5 bg-[#191d23] hover:bg-[#252c36] text-xs px-3 py-2 rounded-lg border border-[#2a2f37] text-slate-300 cursor-pointer"
          >
            <ListFilter size={14} />
            {lastActionOnly ? 'Last Action Only' : 'Full Action Feed'}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-[#191d23] hover:bg-[#252c36] text-slate-300 border border-[#2a2f37] cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {/* Main TV Layout: Left (Table & Board) | Right (Action Feed & Stacks) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Table & Board View */}
        {inAllIn ? (
          <div className="lg:col-span-2">
            <AllInView hand={hand} holeCards={holeCards} equity={equity} />
          </div>
        ) : (
          <div className="lg:col-span-2 flex flex-col justify-between bg-[#15181d] rounded-2xl border border-[#252b33] p-6 shadow-2xl relative">
            {/* Header Blinds banner */}
            <div className="flex items-center justify-between bg-[#1c222b] p-4 rounded-xl border border-[#2a3442]">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">Blinds</div>
                <div className="text-2xl font-black text-white">
                  {formatBlinds(hand)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">Current Street</div>
                <div className="text-2xl font-black text-emerald-400">
                  {STREET_LABEL[hand.street] || 'Preflop'}
                </div>
              </div>
            </div>

            {/* Table Center with Pot & Community Cards */}
            <div className="my-auto py-8 flex flex-col items-center justify-center">
              {/* Pot Banner */}
              <div className="text-center mb-6">
                <span className="text-sm uppercase tracking-widest text-slate-400 font-bold block mb-1">Total Pot</span>
                <span className="text-5xl font-black text-emerald-300 drop-shadow-md">
                  {money(hand.players.reduce((s, p) => s + p.totalBet, 0), cur)}
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
                <div className="mt-8 bg-[#253224] border border-[#4a6b48] px-6 py-2.5 rounded-full flex items-center gap-3 shadow-lg animate-pulse">
                  <span className="text-xs uppercase tracking-wider text-emerald-300 font-semibold">Action On:</span>
                  <span className="text-lg font-bold text-white">
                    {hand.players[hand.currentPlayer]?.name}
                  </span>
                </div>
              )}
            </div>

            {/* Quick Player Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-2 border-t border-[#22272e]">
              {hand.players.map((p, idx) => {
                const isTurn = hand.currentPlayer === idx;
                const isFolded = p.status === 'folded';
                const isAllIn = p.status === 'allin';
                const isBtn = idx === buttonIdx;

                return (
                  <div
                    key={p.id}
                    className={`p-2.5 rounded-lg border text-center transition-all ${
                      isTurn
                        ? 'bg-[#293628] border-emerald-400 shadow-md scale-105'
                        : isAllIn
                        ? 'bg-[#3d2020] border-rose-500'
                        : isFolded
                        ? 'bg-[#15171a] border-[#22262d] opacity-40'
                        : 'bg-[#1a1f26] border-[#28303d]'
                    }`}
                  >
                    <div className="text-xs font-semibold text-slate-300 truncate flex items-center justify-center gap-1">
                      {isBtn && <span className="bg-white text-black text-[9px] font-bold px-1 rounded">D</span>}
                      {p.name}
                    </div>
                    <div className={`text-sm font-bold ${isAllIn ? 'text-rose-300' : 'text-white'}`}>
                      {formatPlayerTagAmount(p.stack, cur, hand)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sidebar: Action Log & Player Stacks */}
        <div className="flex flex-col gap-4">
          {/* Action Log Box */}
          <div className="flex-1 bg-[#15181d] rounded-2xl border border-[#252b33] p-5 flex flex-col">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 border-b border-[#22272e] pb-2">
              {lastActionOnly ? 'Latest Action' : 'Live Action Log'}
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2">
              {displayActions.length === 0 ? (
                <div className="text-xs text-slate-500 py-8 text-center">
                  Waiting for initial hand action...
                </div>
              ) : (
                displayActions.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-lg bg-[#1c222b] border border-[#28303d] text-xs"
                  >
                    <div>
                      <span className="text-slate-400 mr-2 font-mono">[{STREET_LABEL[a.street] || a.street}]</span>
                      <span className="font-bold text-white">{a.player}</span>
                    </div>
                    <div className="font-semibold text-emerald-400">
                      {a.action} {a.chips ? money(a.chips, cur) : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Player Leaderboard */}
          <div className="bg-[#15181d] rounded-2xl border border-[#252b33] p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Chip Counts</h4>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {[...hand.players]
                .sort((a, b) => b.stack - a.stack)
                .map((p, idx) => (
                  <div key={p.id} className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-[#1e242d]">
                    <span className="text-slate-300 truncate">
                      <span className="text-slate-500 mr-1.5">{idx + 1}.</span> {p.name}
                    </span>
                    <span className="font-bold font-mono text-white">{money(p.stack, cur)}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

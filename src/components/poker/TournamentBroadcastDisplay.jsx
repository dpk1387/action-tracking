import React, { useState, useEffect } from 'react';
import { Maximize2, Minimize2, Tv, Sparkles, Clock, Users, Layers, Award } from 'lucide-react';
import {
  formatBlinds,
  money,
  isAllInSituation,
  isAllInShowdown,
} from '@/lib/poker';
import {
  levelTimerState,
  formatTimer,
  formatTimerLabel,
  scheduledLevelNumber,
} from '@/lib/levelTimer';
import { getMTTSummary } from '@/lib/mttStore';
import AllInView from '@/components/poker/AllInView';

function formatNumber(num) {
  if (num == null || isNaN(num)) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toLocaleString();
}

export default function TournamentBroadcastDisplay({
  liveState,
  title = 'Tournament Arena',
  showFullscreenButton = true,
}) {
  const [now, setNow] = useState(Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);

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
  const config = liveState?.config;
  const mtt = liveState?.mtt;
  const holeCards = liveState?.holeCards || liveState?._holeCards || {};
  const equity = liveState?.equity || null;
  const hideAmounts = !!liveState?.hideAmounts;

  // Check if TD explicitly showed all-in on screen OR if hand is in an all-in situation
  const isTDAllInScreenActive = Boolean(liveState?.allInScreenActive && liveState?.allInHand);
  const isHandAllIn = Boolean(
    hand && (
      isAllInShowdown(hand) ||
      isAllInSituation(hand, holeCards) ||
      (hand.players?.some((p) => p.status === 'allin') && hand.players?.filter((p) => p.status !== 'folded').length >= 2)
    )
  );

  const showAllInView = isTDAllInScreenActive || isHandAllIn;

  // Active all-in data payload
  const activeAllInHand = isTDAllInScreenActive ? liveState.allInHand : hand;
  const activeAllInHoles = isTDAllInScreenActive ? (liveState.allInHoleCards || {}) : holeCards;
  const activeAllInEquity = isTDAllInScreenActive ? (liveState.allInEquity || null) : equity;

  // Clock state
  const timerState = hand ? levelTimerState(hand, now) : null;
  const timerLabel = formatTimer(timerState);
  const currentLevelNum = hand ? scheduledLevelNumber(hand) : 1;
  const inBreak = hand?.inBreak;
  const isPaused = timerState?.paused;

  // Next level preview
  const nextLevelItem = hand?.blindSchedule?.[currentLevelNum];
  const nextBlindsStr = nextLevelItem
    ? nextLevelItem.type === 'break'
      ? `Break (${nextLevelItem.minutes || 10}m)`
      : `${formatNumber(nextLevelItem.smallBlind)} / ${formatNumber(nextLevelItem.bigBlind)}${nextLevelItem.ante ? ` (Ante ${formatNumber(nextLevelItem.ante)})` : ''}`
    : null;

  // Field Size calculations
  const mttSummary = mtt ? getMTTSummary(mtt) : null;
  const activePlayers = hand?.players ? hand.players.filter((p) => (p.stack || 0) > 0) : [];
  const totalEntries = mttSummary?.totalEntries || (hand?.players?.length || 0);
  const remainingPlayers = mttSummary?.remainingPlayers || activePlayers.length;
  const totalChips = mttSummary?.totalChips || (hand?.players ? hand.players.reduce((sum, p) => sum + (p.stack || 0), 0) : 0);
  const averageStack = mttSummary?.averageStack || (remainingPlayers > 0 ? Math.round(totalChips / remainingPlayers) : 0);
  const activeTableCount = mttSummary?.activeTableCount || 1;
  const currentBB = Number(hand?.bigBlind || 1);
  const avgInBB = currentBB > 0 ? (averageStack / currentBB).toFixed(1) : null;

  if (showAllInView && activeAllInHand) {
    return (
      <div className="min-h-screen bg-[#0a0c10] text-white flex flex-col p-4 sm:p-6 overflow-x-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#252b36]">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
            <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs sm:text-sm font-black uppercase tracking-wider">
              {liveState?.allInTableName ? `${liveState.allInTableName} · ALL-IN SHOWDOWN` : 'ALL-IN SHOWDOWN'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-300">
            <span className="font-bold text-white">Level {currentLevelNum}</span>
            <span className="text-slate-500">·</span>
            <span className="font-mono text-emerald-400 font-bold">{formatBlinds(hand)}</span>
            {showFullscreenButton && (
              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded-lg bg-[#181d24] hover:bg-[#252c36] text-slate-300 border border-[#2b3543] cursor-pointer ml-2"
                title="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            )}
          </div>
        </div>

        {/* All In View */}
        <div className="flex-1 flex flex-col min-h-0 justify-center">
          <AllInView
            hand={activeAllInHand}
            holeCards={activeAllInHoles}
            equity={activeAllInEquity}
            hideAmounts={hideAmounts}
            pot={activeAllInHand?.pots?.[0]?.amount || 0}
          />
        </div>
      </div>
    );
  }

  // STANDARD TOURNAMENT DISPLAY: ONLY Blinds, Time/Level #, Field Size
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0e14] via-[#090b10] to-[#06070a] text-white flex flex-col p-4 sm:p-8 select-none overflow-x-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-6 sm:mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
            <Tv size={22} />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white uppercase">
              {mtt?.name || config?.name || title}
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Official Tournament Broadcast</span>
              {activeTableCount > 1 && (
                <>
                  <span>•</span>
                  <span className="text-purple-300 font-medium">{activeTableCount} Active Tables</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${
            inBreak
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : isPaused
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          }`}>
            <span className={`w-2 h-2 rounded-full ${inBreak ? 'bg-amber-400 animate-pulse' : isPaused ? 'bg-rose-400' : 'bg-emerald-400 animate-pulse'}`} />
            {inBreak ? 'ON BREAK' : isPaused ? 'TIMER PAUSED' : 'LIVE PLAY'}
          </div>

          {showFullscreenButton && (
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-[#141922] hover:bg-[#1e2533] text-slate-300 border border-[#263142] cursor-pointer transition-colors"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          )}
        </div>
      </div>

      {/* Main Broadcast Center: ONLY Blinds, Time/Level #, Field Size */}
      <div className="flex-1 flex flex-col justify-center max-w-6xl w-full mx-auto gap-6 sm:gap-8 my-auto">
        {/* ROW 1: BLINDS & TIMER / LEVEL (Hero Section) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* SECTION 1: THE BLINDS (lg:col-span-6) */}
          <div className="lg:col-span-6 rounded-3xl bg-gradient-to-br from-[#131720] via-[#10131b] to-[#0c0f16] border border-[#232b3a] p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Sparkles size={16} className="text-amber-400" />
                Current Blinds
              </span>
              <span className="px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-300 text-xs font-semibold border border-purple-500/20">
                {hand?.anteType === 'three_blinds' ? '3 Blinds' : hand?.anteType === 'bba' ? 'Big Blind Ante' : hand?.anteType === 'btn_ante' ? 'Button Ante' : hand?.anteType === 'sb_half_ante' ? 'Small Blind 1/2 Ante' : hand?.anteAmount ? 'Ante Included' : 'No Ante'}
              </span>
            </div>

            <div className="my-auto py-2">
              <div className="text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight drop-shadow-md">
                {hand ? `${formatNumber(hand.smallBlind)} / ${formatNumber(hand.bigBlind)}` : '—'}
              </div>
              {hand && (hand.anteAmount > 0 || hand.anteType === 'bba') && (
                <div className="mt-3 text-lg sm:text-2xl font-bold text-amber-300 flex items-center gap-2">
                  <span>Ante:</span>
                  <span className="font-mono">{formatNumber(hand.anteAmount || hand.bigBlind)}</span>
                </div>
              )}
            </div>

            {nextBlindsStr && (
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-400 font-semibold">Next Level Blinds:</span>
                <span className="font-mono font-bold text-slate-200">{nextBlindsStr}</span>
              </div>
            )}
          </div>

          {/* SECTION 2: TIME & LEVEL # (lg:col-span-6) */}
          <div className="lg:col-span-6 rounded-3xl bg-gradient-to-br from-[#131720] via-[#10131b] to-[#0c0f16] border border-[#232b3a] p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

            <div className="flex items-center justify-between mb-4">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Clock size={16} className="text-emerald-400" />
                Tournament Clock
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs sm:text-sm font-extrabold uppercase tracking-wide">
                Level {currentLevelNum}
              </span>
            </div>

            <div className="my-auto py-2 flex flex-col items-center justify-center text-center">
              <div className={`text-5xl sm:text-7xl md:text-8xl font-black font-mono tracking-tight ${
                inBreak
                  ? 'text-amber-300 animate-pulse'
                  : isPaused
                  ? 'text-rose-400'
                  : timerState?.expired
                  ? 'text-rose-400 animate-pulse'
                  : 'text-white'
              }`}>
                {inBreak ? `BREAK ${timerLabel}` : timerLabel || '00:00'}
              </div>
              <div className="text-xs sm:text-sm text-slate-400 font-semibold uppercase tracking-wider mt-2">
                {inBreak ? 'Tournament on Break' : isPaused ? 'Clock Stopped' : 'Remaining in Level'}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs sm:text-sm text-slate-400">
              <span>Status: <strong className="text-slate-200">{inBreak ? 'Break Period' : isPaused ? 'Paused' : 'Active Clock'}</strong></span>
              <span>Clock Method: <strong className="text-slate-200 capitalize">{hand?.levelConfig?.method || 'Minutes'}</strong></span>
            </div>
          </div>
        </div>

        {/* SECTION 3: FIELD SIZE & ROOM METRICS */}
        <div className="rounded-3xl bg-[#11141c] border border-[#212837] p-6 sm:p-8 shadow-2xl">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5 flex items-center gap-2">
            <Users size={16} className="text-sky-400" />
            Field Size & Tournament Statistics
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {/* Metric 1: Remaining Players */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#161b24] border border-[#252f3f] flex flex-col justify-between">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
                Players Remaining
              </span>
              <div className="text-3xl sm:text-4xl font-black text-white font-mono">
                {remainingPlayers}
                <span className="text-slate-500 text-lg sm:text-xl font-normal ml-1.5">
                  / {totalEntries}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 mt-2">
                {totalEntries - remainingPlayers} players eliminated
              </span>
            </div>

            {/* Metric 2: Average Stack */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#161b24] border border-[#252f3f] flex flex-col justify-between">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
                Average Stack
              </span>
              <div className="text-3xl sm:text-4xl font-black text-amber-300 font-mono">
                {formatNumber(averageStack)}
              </div>
              <span className="text-[11px] text-amber-400/80 font-medium mt-2">
                {avgInBB ? `≈ ${avgInBB} Big Blinds` : 'Chips per player'}
              </span>
            </div>

            {/* Metric 3: Total Chips in Play */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#161b24] border border-[#252f3f] flex flex-col justify-between">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
                Total Chips in Play
              </span>
              <div className="text-3xl sm:text-4xl font-black text-emerald-300 font-mono">
                {formatNumber(totalChips)}
              </div>
              <span className="text-[11px] text-slate-500 mt-2">
                Room-wide total
              </span>
            </div>

            {/* Metric 4: Active Tables */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#161b24] border border-[#252f3f] flex flex-col justify-between">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
                Active Tables
              </span>
              <div className="text-3xl sm:text-4xl font-black text-purple-300 font-mono">
                {activeTableCount}
              </div>
              <span className="text-[11px] text-purple-400/80 font-medium mt-2">
                {mtt ? 'Auto-balanced' : 'Single Table (STT)'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

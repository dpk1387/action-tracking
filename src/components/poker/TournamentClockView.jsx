import React, { useMemo } from 'react';
import { Clock, Trophy, Users, AlertTriangle, Coffee, Sparkles, Check } from 'lucide-react';
import { getConsolidatedPayoutLadder, getOrdinalSuffix } from '@/lib/payoutEngine';
import { parseAmount } from '@/lib/poker';

/**
 * Robust chip and blind parser supporting numbers, strings, K, and M.
 * E.g. "1k" -> 1000, "1.5K" -> 1500, "2M" -> 2000000, 500 -> 500
 */
export function parseChipValue(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  const p = parseAmount(v);
  if (p != null) return p;
  const clean = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(clean) ? 0 : clean;
}

export function formatChips(val) {
  const num = parseChipValue(val);
  return num.toLocaleString();
}

/**
 * Formats total seconds into MM:SS (or HH:MM:SS) string.
 */
export function formatSeconds(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/**
 * Checks if a level object is a break (supports type: 'break', kind: 'break', isBreak: true, or name: 'Break')
 */
export function isBreakLevel(levelObj) {
  if (!levelObj) return false;
  return (
    levelObj.type === 'break' ||
    levelObj.kind === 'break' ||
    levelObj.isBreak === true ||
    String(levelObj.name || '').toLowerCase().includes('break')
  );
}

/**
 * Returns the 1-based blind level count up to targetIdx (excluding scheduled breaks)
 */
export function getLevelNumber(sched = [], targetIdx = 0) {
  if (!sched || !Array.isArray(sched) || targetIdx < 0) return 1;
  let count = 0;
  for (let i = 0; i <= targetIdx && i < sched.length; i++) {
    if (!isBreakLevel(sched[i])) {
      count++;
    }
  }
  return Math.max(1, count);
}

/**
 * Format Blinds according to user specification:
 * - If no ante: SB / BB
 * - Traditional ante: SB / BB / ANTE (ANTE)
 * - BBA: SB / BB - ANTE (BBA) (e.g. 25 / 50 - 50 (BBA))
 */
export function formatBlindsText(levelObj, tournamentAnteType = 'bba') {
  if (!levelObj) return '';
  if (isBreakLevel(levelObj)) {
    const dur = parseChipValue(levelObj.durationMinutes || levelObj.minutes) || 10;
    return `Scheduled Break (${dur}m)`;
  }

  const sbVal = parseChipValue(levelObj.smallBlind);
  const bbVal = parseChipValue(levelObj.bigBlind);
  const anteVal = parseChipValue(levelObj.ante);
  const anteType = levelObj.anteType || tournamentAnteType || 'bba';

  const sb = sbVal.toLocaleString();
  const bb = bbVal.toLocaleString();

  if (anteType === 'none' || (anteType !== 'bba' && anteVal <= 0)) {
    return `${sb} / ${bb}`;
  }

  const anteStr = anteVal.toLocaleString();
  if (anteType === 'traditional') {
    return `${sb} / ${bb} / ${anteStr} (ANTE)`;
  }

  // BBA format: SB / BB - 50 (BBA) (e.g. 25 / 50 - 50 (BBA))
  const bbaAnte = anteVal > 0 ? anteVal : bbVal;
  return `${sb} / ${bb} - ${bbaAnte.toLocaleString()} (BBA)`;
}

export default function TournamentClockView({
  directorState,
  isTV = false,
  isSpectator = false,
}) {
  const mtt = directorState || {};
  const clock = mtt.clock || {};
  const sched = clock.blindSchedule || [];
  const currentLevelIdx = clock.level || 0;
  const currentLevelObj = sched[currentLevelIdx] || { smallBlind: 25, bigBlind: 50, ante: 0 };
  const nextLevelObj = sched[currentLevelIdx + 1] || null;

  const totalEntries = (mtt.totalPlayers || 0) + (mtt.reEntries || 0);
  const remaining = mtt.remainingPlayers ?? totalEntries;
  const startingStack = parseChipValue(mtt.startingStack || 10000);
  const totalChips = mtt.totalChips || totalEntries * startingStack;
  const avgStack = remaining > 0 ? Math.round(totalChips / remaining) : 0;

  const isBreakActive = isBreakLevel(currentLevelObj);
  const currentBreakDuration = parseChipValue(currentLevelObj?.durationMinutes || currentLevelObj?.minutes) || 10;
  const currentLevelNum = getLevelNumber(sched, currentLevelIdx);

  // Effective BB for average BB calculation (uses last or next active blind level during breaks)
  let effectiveBB = parseChipValue(currentLevelObj.bigBlind);
  if (isBreakActive || !effectiveBB) {
    for (let i = currentLevelIdx - 1; i >= 0; i--) {
      if (!isBreakLevel(sched[i]) && parseChipValue(sched[i].bigBlind) > 0) {
        effectiveBB = parseChipValue(sched[i].bigBlind);
        break;
      }
    }
    if (!effectiveBB) {
      for (let i = currentLevelIdx + 1; i < sched.length; i++) {
        if (!isBreakLevel(sched[i]) && parseChipValue(sched[i].bigBlind) > 0) {
          effectiveBB = parseChipValue(sched[i].bigBlind);
          break;
        }
      }
    }
  }
  effectiveBB = effectiveBB || 1;
  const avgBB = (avgStack / effectiveBB).toFixed(1);

  // Find next break in schedule
  let nextBreakInfo = null;
  let foundBreak = false;

  for (let i = currentLevelIdx; i < sched.length; i++) {
    const lvl = sched[i];
    if (isBreakLevel(lvl)) {
      foundBreak = true;
      const breakMins = parseChipValue(lvl.durationMinutes || lvl.minutes) || 10;
      if (i === currentLevelIdx) {
        nextBreakInfo = `Current Break (${breakMins} min)`;
      } else {
        const minsLeftInCurrent = Math.ceil((clock.secondsLeft || 0) / 60);
        let futureMins = 0;
        for (let j = currentLevelIdx + 1; j < i; j++) {
          if (!isBreakLevel(sched[j])) {
            const rowMins = parseChipValue(sched[j]?.durationMinutes || sched[j]?.minutes);
            futureMins += rowMins > 0 ? rowMins : (clock.levelDurationMinutes || 15);
          }
        }
        const totalMinutes = minsLeftInCurrent + futureMins;
        const levelBeforeBreak = getLevelNumber(sched, i - 1);
        nextBreakInfo = `Next break in ~${totalMinutes}m (after Level ${levelBeforeBreak})`;
      }
      break;
    }
  }

  if (!foundBreak) {
    nextBreakInfo = 'No scheduled breaks remaining';
  }

  const payouts = mtt.payouts || [];
  const consolidatedLadder = useMemo(() => getConsolidatedPayoutLadder(payouts), [payouts]);
  const totalPaidSpots = payouts.length;
  const anteType = mtt.anteType || 'bba';

  const isMysteryBounty = mtt.tournamentType === 'mystery bounty';
  const mbConfig = mtt.mysteryBountyConfig;
  const mbPhase = mbConfig?.startPhase || 'itm';
  const mbStartLevel = Number(mbConfig?.startLevel) || 8;
  const mbStartField = Number(mbConfig?.startFieldSize) || 18;

  const isMysteryBountyActive = useMemo(() => {
    if (!isMysteryBounty) return false;
    if (mbPhase === 'itm') {
      return totalPaidSpots > 0 && remaining <= totalPaidSpots;
    }
    if (mbPhase === 'freezeout') {
      return currentLevelIdx >= (mtt.lateRegLevel || 4);
    }
    if (mbPhase === 'level') {
      return currentLevelIdx + 1 >= mbStartLevel;
    }
    if (mbPhase === 'field') {
      return remaining <= mbStartField;
    }
    return false;
  }, [isMysteryBounty, mbPhase, totalPaidSpots, remaining, currentLevelIdx, mtt.lateRegLevel, mbStartLevel, mbStartField]);

  const topEnvelope = useMemo(() => {
    if (!isMysteryBounty || !mbConfig?.envelopes?.length) return null;
    const amounts = mbConfig.envelopes.map((e) => Number(e.amount) || 0);
    return amounts.length ? Math.max(...amounts) : null;
  }, [isMysteryBounty, mbConfig]);

  return (
    <div
      className={`w-full flex flex-col justify-between select-none ${
        isTV || isSpectator
          ? 'min-h-screen bg-[#0a0d12] text-white p-4 sm:p-8'
          : 'bg-[#10141b] text-white rounded-2xl border border-slate-800/80 p-5 sm:p-7 shadow-2xl'
      }`}
    >
      {/* Top Banner: Tournament Title & Hand-For-Hand / Late-Reg Status */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-4 border-b border-slate-800/80 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Trophy size={22} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              {mtt.name || 'Tournament Director'}
              {mtt.currency && mtt.buyIn > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {mtt.currency}{mtt.buyIn} Buy-in
                </span>
              )}
            </h1>
            <div className="text-xs text-slate-400">
              {mtt.tablesCount} {mtt.tablesCount === 1 ? 'Table' : 'Tables'} · Starting Stack:{' '}
              {formatChips(startingStack)} ·{' '}
              {mtt.tournamentType ? mtt.tournamentType.toUpperCase() : 'FREEZEOUT'}
            </div>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex flex-wrap items-center gap-2">
          {mtt.isHandForHand && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 font-bold text-xs uppercase tracking-wider animate-pulse">
              <AlertTriangle size={15} />
              Hand for Hand
            </div>
          )}

          {mtt.lateRegEnabled && (
            <div
              className={`text-xs px-2.5 py-1 rounded-md font-medium border ${
                currentLevelIdx < (mtt.lateRegLevel || 4)
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700/50'
              }`}
            >
              Late Reg:{' '}
              {currentLevelIdx < (mtt.lateRegLevel || 4)
                ? `Open (thru L${mtt.lateRegLevel || 4})`
                : 'Closed'}
            </div>
          )}

          {isMysteryBounty && (
            <div
              className={`text-xs px-2.5 py-1 rounded-md font-bold border flex items-center gap-1.5 ${
                isMysteryBountyActive
                  ? 'bg-purple-950/80 text-purple-200 border-purple-500/60 shadow-[0_0_10px_rgba(168,85,247,0.3)] animate-pulse'
                  : 'bg-slate-800/80 text-purple-300/80 border-slate-700/60'
              }`}
            >
              <Sparkles size={13} className="text-purple-400" />
              <span>
                {isMysteryBountyActive ? 'Mystery Bounty Active!' : `Mystery Bounty: ${
                  mbPhase === 'itm'
                    ? `Starts at Bubble (${totalPaidSpots} left)`
                    : mbPhase === 'freezeout'
                    ? 'Starts when Late Reg closes'
                    : mbPhase === 'level'
                    ? `Starts at L${mbStartLevel}`
                    : `Starts at ${mbStartField} players`
                }`}
              </span>
              {topEnvelope != null && topEnvelope > 0 && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-200 font-mono">
                  Top: {mtt.currency || '$'}{formatChips(topEnvelope)}
                </span>
              )}
            </div>
          )}

          {!clock.isRunning && (
            <div className="text-xs px-2.5 py-1 rounded-md font-semibold bg-rose-950/60 text-rose-300 border border-rose-800/50 uppercase tracking-wider">
              Clock Paused
            </div>
          )}
        </div>
      </div>

      {/* Main 3-Column Clock Grid: Left (Field/Chips) | Middle (Clock/Level) | Right (Blinds/Payouts) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start my-auto py-2">
        {/* LEFT COLUMN: Field Remaining & Total Chips */}
        <div className="lg:col-span-3 flex flex-col justify-center space-y-6 bg-slate-900/40 p-5 rounded-2xl border border-slate-800/60">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-2">
              <Users size={14} className="text-emerald-400" />
              Field Remaining
            </div>
            {/* Players remaining number bolder and bigger than starting player count */}
            <div className="flex items-baseline gap-2 font-mono">
              <span className="text-5xl sm:text-6xl xl:text-7xl font-black text-white tracking-tighter drop-shadow-sm">
                {remaining}
              </span>
              <span className="text-2xl sm:text-3xl font-medium text-slate-500">
                / {totalEntries}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {totalEntries - remaining} players eliminated
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/60">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
              Total Chips In Play
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-amber-300 font-mono tracking-tight">
              {formatChips(totalChips)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {totalEntries} Entries × {formatChips(startingStack)}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/60 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Average Stack
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-200 font-mono">
                {formatChips(avgStack)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Avg BB
              </div>
              <div className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono">
                {avgBB} BB
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN: Level #, Time Remaining, Next Break */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center text-center px-2 py-4 sm:py-6">
          {/* Level Header */}
          <div className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm sm:text-base font-bold uppercase tracking-widest mb-3">
            {isBreakActive ? (
              <span className="flex items-center gap-2 text-amber-300 font-extrabold">
                <Coffee size={18} /> Tournament Break ({currentBreakDuration}m)
              </span>
            ) : (
              <span>Level {currentLevelNum}</span>
            )}
          </div>

          {/* Time Remaining (Huge Tabular Figures) */}
          <div className="my-2">
            <span
              className={`font-mono font-black tracking-tight tabular-nums drop-shadow-[0_10px_25px_rgba(0,0,0,0.6)] ${
                clock.secondsLeft <= 60 && !isBreakActive
                  ? 'text-rose-500 animate-pulse text-7xl sm:text-8xl xl:text-9xl'
                  : 'text-white text-7xl sm:text-8xl xl:text-9xl'
              }`}
            >
              {formatSeconds(clock.secondsLeft)}
            </span>
          </div>

          {/* Next Break Information */}
          <div className="mt-4 flex items-center gap-2 text-xs sm:text-sm text-slate-400 bg-slate-900/60 px-4 py-2 rounded-xl border border-slate-800">
            <Coffee size={16} className="text-amber-400 shrink-0" />
            <span className="font-medium text-slate-300">{nextBreakInfo}</span>
          </div>

          {/* Hand for Hand Notice Bar if enabled */}
          {mtt.isHandForHand && (
            <div className="mt-4 w-full bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-amber-300 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 animate-bounce">
              <AlertTriangle size={18} />
              Hand for Hand play is enabled. One hand dealt at a time across all tables!
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Level and Blinds, Prize Structure, Next Level */}
        <div className="lg:col-span-4 flex flex-col space-y-5 bg-slate-900/40 p-5 rounded-2xl border border-slate-800/60">
          {/* Current Level and Blinds (Formatted: SB / BB - 50 (BBA)) */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1.5 flex items-center justify-between">
              <span>Current Blinds</span>
              <span className="text-[11px] text-emerald-400">
                {isBreakActive ? 'Break' : `Level ${currentLevelNum}`}
              </span>
            </div>
            {isBreakActive ? (
              <div className="text-2xl font-bold text-amber-300 font-mono">
                Scheduled Break ({currentBreakDuration}m)
              </div>
            ) : (
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight">
                {formatBlindsText(currentLevelObj, anteType)}
              </div>
            )}
          </div>

          {/* Next Level Preview */}
          <div className="pt-3 border-t border-slate-800/60">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1 flex items-center justify-between">
              <span>Next Level</span>
              {nextLevelObj && (
                <span className="text-[11px] text-slate-400">
                  {isBreakLevel(nextLevelObj)
                    ? 'Break'
                    : `Level ${getLevelNumber(sched, currentLevelIdx + 1)}`}
                </span>
              )}
            </div>
            {nextLevelObj ? (
              isBreakLevel(nextLevelObj) ? (
                <div className="text-base font-semibold text-amber-400 flex items-center gap-1.5">
                  <Coffee size={15} /> Scheduled Break ({parseChipValue(nextLevelObj.durationMinutes || nextLevelObj.minutes) || 10}m)
                </div>
              ) : (
                <div className="text-base sm:text-lg font-bold text-slate-300 font-mono">
                  {formatBlindsText(nextLevelObj, anteType)}
                </div>
              )
            ) : (
              <div className="text-sm text-slate-500 italic">Final scheduled level</div>
            )}
          </div>

          {/* Prize Structure (Color rule: Green ONLY when claimed!) */}
          <div className="pt-3 border-t border-slate-800/60">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="flex items-center gap-1">
                  <Trophy size={13} className="text-amber-400" />
                  Prize Pool ({mtt.currency || '$'}
                  {formatChips(mtt.totalPrizePool || totalEntries * (mtt.buyIn || 100))})
                </span>
                {mtt.bountyPool > 0 && (
                  <span className="text-[10px] text-slate-400 font-normal">
                    Rank: {mtt.currency || '$'}{formatChips(mtt.rankPool || (mtt.totalPrizePool - mtt.bountyPool))} · Bounty: {mtt.currency || '$'}{formatChips(mtt.bountyPool)}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-500">
                {payouts.length} ITM Spots
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {consolidatedLadder.length === 0 ? (
                <div className="text-xs text-slate-500 py-1">No payouts configured</div>
              ) : (
                consolidatedLadder.map((item, idx) => {
                  // PRIZE COLORING RULE:
                  // A place/bracket is CLAIMED when ALL its spots have finished (eliminated).
                  // Green ONLY shows when claimed!
                  const isClaimed =
                    item.startPlace === 1
                      ? remaining === 1
                      : remaining < item.startPlace;

                  // Money Bubble: only when remaining is exactly totalPaidSpots + 1, and this is the last paid spot
                  const isMoneyBubble =
                    totalPaidSpots > 0 &&
                    remaining === totalPaidSpots + 1 &&
                    item.endPlace === totalPaidSpots;

                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg transition-colors font-mono ${
                        isClaimed
                          ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 font-semibold'
                          : isMoneyBubble
                          ? 'bg-amber-950/30 text-amber-300 border border-amber-800/40'
                          : 'bg-slate-800/40 text-slate-300 border border-slate-700/30'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold">
                          {item.label}
                        </span>
                        {item.percent > 0 && (
                          <span className="text-slate-400 text-[11px]">
                            {item.percent.toFixed(item.percent % 1 === 0 ? 0 : 1)}%
                          </span>
                        )}
                        {isClaimed && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold flex items-center gap-0.5">
                            <Check size={10} /> {item.startPlace === 1 ? 'Champion' : 'Claimed'}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`font-extrabold ${isClaimed ? 'text-emerald-300' : 'text-white'}`}>
                          {mtt.currency || '$'}{formatChips(item.perPlayerAmount)}
                        </span>
                        {item.isBracket && (
                          <span className="text-[10px] text-slate-400 block">
                            each (${formatChips(item.totalAmount)} total)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer info for TV/Spectator view */}
      {(isTV || isSpectator) && (
        <div className="pt-4 border-t border-slate-800/60 mt-6 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <span>Tournament Broadcast Display</span>
          <span>
            {clock.isRunning ? 'Clock Running' : 'Clock Paused'} · Level Duration:{' '}
            {clock.levelDurationMinutes || 15}m
          </span>
        </div>
      )}
    </div>
  );
}

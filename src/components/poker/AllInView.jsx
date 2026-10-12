import React, { useMemo } from 'react';
import {
  money,
  formatSidePotAmount,
  SUIT_SYMBOL,
  SUIT_RED,
  rankDisplay,
  variantMeta,
  calculateAllInOuts,
  positionForSeat,
  getButtonIndex,
  STREET_LABEL,
  calcEquity,
} from '@/lib/poker';

const POSITION_ORDER = {
  'SB': 1,
  'BB': 2,
  'D/SB': 1,
  'UTG': 3,
  'UTG+1': 4,
  'UTG+2': 5,
  'UTG+3': 6,
  'LJ': 7,
  'HJ': 8,
  'CO': 9,
  'BTN': 10,
  'D': 10,
};

function OutCard({ card }) {
  if (!card) return null;
  const red = SUIT_RED[card.suit];
  return (
    <div
      className={`inline-flex items-center justify-center gap-0.5 px-1.5 py-0.5 min-w-[34px] h-[20px] rounded border border-slate-300 bg-white shadow-sm text-xs font-bold leading-none select-none shrink-0 ${
        red ? 'text-rose-600' : 'text-slate-900'
      }`}
    >
      <span>{rankDisplay(card.rank)}</span>
      <span className="text-[11px] leading-none">{SUIT_SYMBOL[card.suit]}</span>
    </div>
  );
}

function AllInHoleCard({ card }) {
  if (!card) return null;
  const red = SUIT_RED[card.suit];
  return (
    <div
      className={`w-7 h-10 rounded-md bg-white border border-slate-300 shadow-md flex flex-col items-center justify-center select-none shrink-0 ${
        red ? 'text-rose-600' : 'text-slate-900'
      }`}
    >
      <span className="font-bold text-xs leading-none">
        {rankDisplay(card.rank)}
      </span>
      <span className="text-xs leading-none mt-0.5">
        {SUIT_SYMBOL[card.suit]}
      </span>
    </div>
  );
}

function AllInBoardCard({ card }) {
  if (!card || card.hidden) {
    return (
      <div className="w-10 h-14 rounded-lg border-2 border-dashed border-slate-700/80 bg-[#171c23]/60 flex items-center justify-center">
        <span className="text-slate-600 text-xs font-bold">·</span>
      </div>
    );
  }
  const red = SUIT_RED[card.suit];
  return (
    <div
      className={`w-10 h-14 rounded-lg bg-white border border-slate-300 flex flex-col items-center justify-center font-bold shadow-lg select-none shrink-0 transition-transform ${
        red ? 'text-rose-600' : 'text-slate-900'
      }`}
    >
      <span className="text-sm leading-none">{rankDisplay(card.rank)}</span>
      <span className="text-base leading-none mt-0.5">{SUIT_SYMBOL[card.suit]}</span>
    </div>
  );
}

export default function AllInView({
  hand,
  holeCards = {},
  equity = null,
  sidePots = [],
  pot = 0,
  positions = [],
  onToggleClassic,
}) {
  const cur = hand?.currency || '';
  const n = hand?.players?.length || 0;
  const buttonIdx = getButtonIndex(hand);

  // Active contestants in all-in showdown (non-folded)
  const contestants = useMemo(() => {
    if (!hand?.players) return [];
    const nonFolded = hand.players.filter((p) => p.status !== 'folded');

    return nonFolded.map((p) => {
      const idx = hand.players.findIndex((x) => x.id === p.id);
      const posLabel = positions[idx] || positionForSeat(n, buttonIdx, idx) || '';
      const order = POSITION_ORDER[posLabel] ?? 99;
      const isAtRisk = p.status === 'allin' || p.stack <= 0 || p._wasCapped;
      return {
        player: p,
        position: posLabel,
        posOrder: order,
        isAtRisk,
      };
    });
  }, [hand, positions, n, buttonIdx]);

  // Order: earlier positions on top, later positions on the bottom
  const sortedContestants = useMemo(() => {
    return [...contestants].sort((a, b) => a.posOrder - b.posOrder);
  }, [contestants]);

  // Total Pot
  const totalPot = useMemo(() => {
    if (pot > 0) return pot;
    return (hand?.players || []).reduce((s, p) => s + (p.totalBet || 0), 0);
  }, [pot, hand]);

  // Local fallback equity if not yet computed by parent
  const computedEquity = useMemo(() => {
    if (equity?.byId) return equity;
    if (!hand || !holeCards) return null;
    const holes = contestants.map((c) => holeCards[c.player.id]);
    if (holes.some((h) => !h || !h.length)) return null;
    const variant = hand.variant || 'nlh';
    const iters = 5000;
    try {
      const res = calcEquity(holes, hand.communityCards || [], iters, variant);
      const byId = {};
      contestants.forEach((c, i) => {
        byId[c.player.id] = res.results[i].win;
      });
      return { byId, split: res.split };
    } catch {
      return null;
    }
  }, [equity, hand, holeCards, contestants]);

  // Live outs for trailing players (updates whenever board cards change)
  const allInOuts = useMemo(() => {
    return calculateAllInOuts(hand, holeCards);
  }, [hand, holeCards]);

  const boardLen = (hand?.communityCards || []).filter((c) => c && !c.hidden).length;

  return (
    <div className="relative w-full min-h-[490px] h-[520px] rounded-[2rem] border-2 border-[#364536] bg-gradient-to-b from-[#14181e] via-[#111419] to-[#0c0f13] overflow-hidden p-5 flex flex-col justify-between shadow-2xl select-none">
      {/* Subtle table background watermark/glow */}
      <div className="absolute inset-4 rounded-[1.6rem] border border-[#273229]/50 pointer-events-none bg-[#182318]/10" />

      {/* Top Bar: Title & Status */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-600/80 text-rose-300 font-extrabold text-xs uppercase tracking-wider shadow-[0_0_12px_rgba(244,63,94,0.3)] animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            All-In Showdown
          </span>
          <span className="text-xs font-semibold text-slate-400">
            Street: <span className="text-emerald-400 font-bold">{STREET_LABEL[hand?.street] || 'Preflop'}</span>
          </span>
        </div>

        {onToggleClassic && (
          <button
            type="button"
            onClick={onToggleClassic}
            className="text-[11px] font-semibold text-slate-400 hover:text-white bg-[#202630] border border-[#2d3644] px-2.5 py-1 rounded-md transition-colors cursor-pointer"
          >
            Classic Table
          </button>
        )}
      </div>

      {/* Main Content Area: Left (Tags + Outs beside them) & Bottom-Right (Board + Pot) */}
      <div className="relative z-10 flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch mt-3">
        {/* Left Side: Player tags stacked (earlier on top, later on bottom) + Outs beside them */}
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          {/* Player tags column: earlier on top, later on bottom */}
          <div className="flex flex-col gap-2.5 w-full max-w-[340px]">
            {sortedContestants.map((item) => {
              const p = item.player;
              const eqVal = computedEquity?.byId?.[p.id];
              const eqPct = eqVal != null ? Math.round(eqVal) : null;
              const isAtRisk = item.isAtRisk;
              const cards = holeCards[p.id] || [];

              return (
                <div
                  key={p.id}
                  className={`w-full rounded-xl border-2 overflow-hidden shadow-xl transition-all ${
                    isAtRisk
                      ? 'border-rose-500 bg-[#2d1215] shadow-[0_0_18px_rgba(244,63,94,0.35)]'
                      : 'border-[#2f3846] bg-[#161a22]'
                  }`}
                >
                  {/* Row 1 (taller): [name] | [hole cards] | [equity] */}
                  <div className="grid grid-cols-[1.2fr_1.3fr_0.9fr] h-13 border-b border-slate-700/60 divide-x divide-slate-700/60 items-center">
                    {/* Name */}
                    <div className="px-3 truncate">
                      <div className="font-bold text-sm text-white truncate leading-tight">
                        {p.name}
                      </div>
                    </div>

                    {/* Hole Cards */}
                    <div className="px-2 flex items-center justify-center gap-1.5 h-full">
                      {cards.map((c, j) => (
                        <AllInHoleCard key={j} card={c} />
                      ))}
                    </div>

                    {/* Equity */}
                    <div className="px-2.5 flex items-center justify-end h-full">
                      <span className="font-black font-mono text-xl text-emerald-400 drop-shadow">
                        {eqPct != null ? `${eqPct}%` : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Row 2 (shorter): [stack remaining] | [all in] | [position] */}
                  <div className="grid grid-cols-[1.2fr_1.3fr_0.9fr] h-7 divide-x divide-slate-700/60 items-center text-xs bg-black/30">
                    {/* Stack Remaining */}
                    <div className="px-3 font-mono text-slate-400 truncate">
                      {p.status === 'allin' || p.stack <= 0 ? '-' : money(p.stack, cur)}
                    </div>

                    {/* Action / All In */}
                    <div className="px-2 flex items-center justify-center font-bold text-[10px] uppercase tracking-wider">
                      {p.status === 'allin' ? (
                        <span className="text-rose-400 font-extrabold tracking-wider">
                          All In
                        </span>
                      ) : null}
                    </div>

                    {/* Position */}
                    <div className="px-2.5 flex items-center justify-end font-bold text-slate-300 text-xs tracking-wider">
                      {item.position || ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Outs section: near top left going down, next to the player tags */}
          <div className="flex-1 w-full max-w-[340px] flex flex-col gap-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>Showdown Outs</span>
              {boardLen >= 5 ? (
                <span className="text-[10px] text-amber-300 font-normal">(River complete)</span>
              ) : boardLen >= 3 ? (
                <span className="text-[10px] text-emerald-300 font-normal">
                  (Live for next card)
                </span>
              ) : (
                <span className="text-[10px] text-slate-500 font-normal">(Preflop)</span>
              )}
            </div>

            {boardLen >= 5 ? (
              <div className="p-2.5 rounded-lg border border-slate-700/70 bg-[#161a22]/70 text-xs text-slate-400">
                All 5 community cards dealt. Showdown complete.
              </div>
            ) : allInOuts.length === 0 ? (
              <div className="p-2.5 rounded-lg border border-slate-700/70 bg-[#161a22]/70 text-xs text-slate-400">
                {boardLen < 3
                  ? 'Outs update once the flop is dealt.'
                  : 'Hands currently tied or drawing to same outs.'}
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                {allInOuts.map((entry) => (
                  <div
                    key={entry.player.id}
                    className="p-2.5 rounded-lg border border-slate-700/70 bg-[#161a22]/90 shadow-md flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-white truncate">{entry.player.name}</span>
                      <span className="font-mono text-amber-300 font-bold ml-2 shrink-0">
                        {entry.outs.length} out{entry.outs.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {entry.outs.length === 0 ? (
                      <span className="text-[11px] text-rose-400 italic">
                        Drawing dead (0 outs)
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        {entry.outs.map((card) => (
                          <OutCard key={card.rank + card.suit} card={card} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Bottom Right (Community cards right above pot sizes, Pot sizes bottom right) */}
        <div className="flex flex-col justify-end items-end gap-3 self-end mt-auto">
          {/* Community Cards: right above pot sizes */}
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Board
              </span>
              <span className="text-xs font-bold text-emerald-400">
                {STREET_LABEL[hand?.street] || 'Preflop'}
              </span>
            </div>

            <div className="flex gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <AllInBoardCard key={i} card={hand?.communityCards?.[i]} />
              ))}
            </div>

            {hand?.doubleBoard && (
              <div className="flex gap-2 mt-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <AllInBoardCard key={`b${i}`} card={(hand?.boardB || [])[i]} />
                ))}
              </div>
            )}
          </div>

          {/* Pot (and side pots) sizes: bottom right */}
          <div className="flex flex-col items-end rounded-2xl border border-[#2a3442] bg-[#161d26]/95 px-5 py-3 shadow-2xl min-w-[220px]">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Total Pot
            </div>
            <div className="text-3xl font-black text-white font-mono drop-shadow">
              {money(totalPot, cur)}
            </div>
            {sidePots.length > 0 && (
              <div className="text-xs text-amber-300 font-semibold mt-1">
                Side pots: {sidePots.map((sp) => formatSidePotAmount(sp.amount, cur)).join(' / ')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

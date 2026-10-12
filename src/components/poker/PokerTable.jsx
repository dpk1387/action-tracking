import React, { useRef, useEffect, useState, useMemo } from 'react';
import { money, formatPlayerTagAmount, formatBetAmount, formatSidePotAmount, SUIT_SYMBOL, SUIT_RED, rankDisplay, variantMeta, describeHand, calculateEffectiveM, calculateAllInOuts, isAllInSituation, isAllInShowdown } from '@/lib/poker';
import AllInView from './AllInView';

function raiseLabelLocal(level) {
  if (!level || level <= 1) return 'Bet';
  if (level === 2) return 'Raise';
  return `${level}-bet`;
}

function OutCard({ card }) {
  if (!card) return null;
  const red = SUIT_RED[card.suit];
  return (
    <div
      className={`inline-flex items-center justify-center gap-0.5 px-1.5 py-0.5 min-w-[34px] h-[20px] rounded border border-slate-300 bg-white shadow-sm text-xs font-bold leading-none select-none ${
        red ? 'text-rose-600' : 'text-slate-900'
      }`}
    >
      <span>{rankDisplay(card.rank)}</span>
      <span className="text-[11px] leading-none">{SUIT_SYMBOL[card.suit]}</span>
    </div>
  );
}

function Card({ card, highlight, anim, delay, style }) {
  if (!card) return <div className="w-8 h-11 rounded-md border border-dashed border-slate-600/70" />;
  const isHidden = card.hidden;
  const red = !isHidden && SUIT_RED[card.suit];
  const hl = highlight && !isHidden && highlight.has(card.rank + card.suit);
  const ring = hl ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-[#1e2227]' : '';

  if (isHidden || !anim) {
    if (isHidden) return (
      <div className="w-8 h-11 rounded-md bg-[#3a4a3a] border border-[#4a5a4a] flex items-center justify-center">
        <span className="text-[#7fae7f] text-xs">?</span>
      </div>
    );
    return (
      <div className={`w-8 h-11 rounded-md bg-slate-100 flex items-center justify-center text-sm font-bold shadow ${red ? 'text-rose-600' : 'text-slate-900'} ${ring}`}>
        <span>{rankDisplay(card.rank)}{SUIT_SYMBOL[card.suit]}</span>
      </div>
    );
  }

  return (
    <div
      className={`relative w-8 h-11 ${anim}`}
      style={{ transformStyle: 'preserve-3d', animationDelay: `${delay || 0}s`, ...style }}
    >
      <div
        className="absolute inset-0 rounded-md bg-[#3a4a3a] border border-[#4a5a4a] flex items-center justify-center"
        style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
      >
        <span className="text-[#7fae7f] text-xs">?</span>
      </div>
      <div
        className={`absolute inset-0 rounded-md bg-slate-100 flex items-center justify-center text-sm font-bold shadow ${red ? 'text-rose-600' : 'text-slate-900'} ${ring}`}
        style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
      >
        <span>{rankDisplay(card.rank)}{SUIT_SYMBOL[card.suit]}</span>
      </div>
    </div>
  );
}

function MiniCard({ card, highlight }) {
  if (card.hidden) return (
    <span className="inline-flex items-center justify-center w-5 h-7 rounded bg-[#3a4a3a] border border-[#4a5a4a] text-[10px] text-[#7fae7f] mr-0.5">?</span>
  );
  const red = SUIT_RED[card.suit];
  const hl = highlight && highlight.has(card.rank + card.suit);
  return (
    <span className={`inline-flex items-center justify-center w-5 h-7 rounded bg-slate-100 text-[10px] font-bold mr-0.5 ${red ? 'text-rose-600' : 'text-slate-900'} ${hl ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-[#1e2227]' : ''}`}>
      {rankDisplay(card.rank)}{SUIT_SYMBOL[card.suit]}
    </span>
  );
}

export default function PokerTable({ hand, positions, pot, sidePots = [], holeCards, equity, hideAmounts, highlightKeys, stackVisibleIds, showPot, alwaysShow, helpMode = false }) {
  const n = hand.players.length;
  const tableSize = hand.tableSize || n;
  const cur = hand.currency;
  const lowGame = variantMeta(hand.variant).group === 'low';

  const stackFor = (p) => p.stack;

  const fmtEq = (v) => {
    if (v <= 0) return '0';
    if (v >= 100) return '100';
    if (v < 0.1) return '<0.1';
    if (v > 99.9) return '>99.9';
    return v.toFixed(1);
  };

  const buttonIndex = hand.players.findIndex((p) => p.seat === hand.buttonSeat);
  const sbIndex = n === 2 ? buttonIndex : (buttonIndex + 1) % n;
  const bbIndex = n === 2 ? (buttonIndex + 1) % n : (buttonIndex + 2) % n;
  const sbSeat = hand.players[sbIndex]?.seat;
  const bbSeat = hand.players[bbIndex]?.seat;
  const potIsPublic = hand.gameType === 'pl';

  const stackShown = (p) => (alwaysShow ? true : (stackVisibleIds ? stackVisibleIds.has(p.id) : !hideAmounts));
  const potShown = showPot !== undefined ? showPot : (!hideAmounts || potIsPublic);
  const sg = hand.sideGames || {};
  const killOn = !!(sg.killPot || sg.halfKill);
  const standUp = !!sg.standUp;
  const wonSet = new Set((hand.wonPots || []).map((s) => Number(s)));
  const nonFolded = hand.players.filter((p) => p.status !== 'folded');
  const shownHoles = nonFolded.filter((p) => (alwaysShow && p.status === 'allin') || (holeCards && holeCards[p.id]));

  const potOdds = (() => {
    if (!helpMode || !hand || hand.phase === 'ended' || hand.phase === 'awarded') return null;
    if (hand.currentPlayer < 0 || !hand.players) return null;
    const actor = hand.players[hand.currentPlayer];
    if (!actor || actor.status === 'folded' || actor.status === 'allin') return null;
    const toCall = Math.max(0, (hand.currentBet || 0) - (actor.currentBet || 0));
    const costToCall = Math.min(toCall, actor.stack || 0);
    const potNow = (hand.players || []).reduce((sum, p) => sum + (p.totalBet || 0), 0);
    const totalPotAfterCall = potNow + costToCall;
    if (totalPotAfterCall <= 0) return { percent: 0, costToCall: 0, totalPotAfterCall: 0, playerName: actor.name };
    const pct = Math.round((costToCall / totalPotAfterCall) * 100);
    return {
      percent: pct,
      costToCall,
      totalPotAfterCall,
      playerName: actor.name,
    };
  })();

  const [showClassic, setShowClassic] = useState(false);
  useEffect(() => {
    setShowClassic(false);
  }, [hand?.handNumber]);

  const seenRef = useRef({});
  const boardLenRef = useRef(-1);
  const [burnKey, setBurnKey] = useState(0);

  useEffect(() => { seenRef.current = {}; boardLenRef.current = -1; }, [hand.handNumber]);

  useEffect(() => {
    const total = (hand.communityCards || []).filter((c) => !c.hidden).length +
      (hand.doubleBoard ? (hand.boardB || []).filter((c) => !c.hidden).length : 0);
    if (boardLenRef.current >= 0 && total > boardLenRef.current) {
      setBurnKey((k) => k + 1);
    }
    boardLenRef.current = total;
  }, [hand.communityCards, hand.boardB, hand.doubleBoard]);

  const inAllIn = isAllInShowdown(hand);

  const allInOuts = useMemo(() => {
    return calculateAllInOuts(hand, holeCards);
  }, [hand, holeCards]);

  if (inAllIn && !showClassic) {
    return (
      <AllInView
        hand={hand}
        holeCards={holeCards}
        equity={equity}
        sidePots={sidePots}
        pot={pot}
        positions={positions}
        onToggleClassic={() => setShowClassic(true)}
      />
    );
  }

  const animateKeys = (board) => {
    if (!board) return [];
    return board.map((c, i) => {
      const key = c && !c.hidden ? (c.rank + c.suit) : `slot-${i}`;
      if (!key || seenRef.current[key]) return null;
      seenRef.current[key] = true;
      if (i < 3) {
        const offsets = ['-22%', '0%', '22%'];
        return { anim: 'deal-flop-full', delay: 0.4 + i * 0.22, style: { '--flop-offset': offsets[i] } };
      }
      return { anim: 'deal-turn-river-full', delay: 0.4 };
    });
  };

  const mainAnim = animateKeys(hand.communityCards);
  const bAnim = hand.doubleBoard ? animateKeys(hand.boardB) : [];

  return (
    <div className="relative w-full h-[480px] rounded-[2rem] border-2 border-[#364536] bg-[#1e2227] overflow-hidden">
      {inAllIn && (
        <button
          type="button"
          onClick={() => setShowClassic(false)}
          className="absolute top-4 right-4 z-30 px-3 py-1 rounded-md bg-rose-950/90 border border-rose-500 text-rose-300 font-bold text-xs shadow-lg cursor-pointer hover:bg-rose-900 transition-colors animate-pulse"
        >
          Switch to All-In View
        </button>
      )}
      <div className="absolute inset-6 rounded-[1.6rem] bg-[#232a23]/40" />
      {Array.from({ length: tableSize }, (_, seatIdx) => {
        const seatNum = seatIdx + 1;
        const angle = (-90 + (seatIdx * 360) / tableSize) * (Math.PI / 180);
        const x = 50 + 43 * Math.cos(angle);
        const y = 50 + 41 * Math.sin(angle);
        const playerIndex = hand.players.findIndex((p) => p.seat === seatNum);
        const p = playerIndex >= 0 ? hand.players[playerIndex] : null;

        if (!p) {
          return (
            <div key={`empty-${seatNum}`} className="absolute" style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}>
              <div className="relative w-28 rounded-lg border-2 border-dashed border-[#2a2f37] bg-[#15181d]/40 px-2 py-2 text-center opacity-40">
                <div className="text-[10px] text-slate-600">Seat {seatNum}</div>
                <div className="text-[10px] text-slate-700 mt-0.5">Empty</div>
              </div>
            </div>
          );
        }

        const i = playerIndex;
        const isCurrent = hand.currentPlayer === i;
        const isButton = i === buttonIndex;
        const isKiller = killOn && hand.lastWinnerSeat != null && Number(p.seat) === Number(hand.lastWinnerSeat);
        const isNit = standUp && !wonSet.has(Number(p.seat));
        const allin = p.status === 'allin';
        const folded = p.status === 'folded';
        const atRisk = allin || p._wasCapped;
        const la = p.lastAction;
        const laText = la
          ? la.type === 'fold'
            ? 'Fold'
            : la.type === 'check'
            ? 'Check'
            : la.type === 'allin'
            ? `All-in ${formatBetAmount(la.amount, cur)}`
            : la.type === 'straddle'
            ? `Straddle ${formatBetAmount(la.amount, cur)}`
            : la.type === 'kill'
            ? `Kill ${formatBetAmount(la.amount, cur)}`
            : la.type === 'bet' || la.type === 'raise'
            ? `${raiseLabelLocal(la.raiseLevel)} ${formatBetAmount(la.amount, cur)}`
            : la.type === 'call'
            ? `Call ${formatBetAmount(la.amount, cur)}`
            : la.type === 'sb'
            ? `SB ${formatBetAmount(la.amount, cur)}`
            : la.type === 'bb'
            ? `BB ${formatBetAmount(la.amount, cur)}`
            : ''
          : 'Waiting';

        return (
          <div key={p.id} className="absolute" style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}>
            <div
              className={`relative w-32 rounded-lg border px-2 py-1.5 text-center transition-all ${
                atRisk
                  ? 'bg-[#3a1f1f] border-[#c94c4c]'
                  : folded
                  ? 'bg-[#1a1d22] border-[#2a2f37] opacity-40'
                  : isCurrent
                  ? 'bg-[#2a3329] border-[#7fae7f] shadow-[0_0_0_2px_rgba(127,174,127,0.4)]'
                  : 'bg-[#15181d] border-[#2a2f37]'
              }`}
            >
              {(isButton || p.seat === bbSeat || p.seat === sbSeat) && (
                <span className={`absolute -top-2 -right-2 px-1.5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                  isButton ? 'bg-white text-[#15181d]'
                    : p.seat === bbSeat ? 'bg-[#3a4a8a] text-white'
                    : 'bg-[#8a6a3a] text-white'
                }`}>
                  {isButton ? (n === 2 ? 'D/SB' : 'D') : p.seat === bbSeat ? 'BB' : 'SB'}
                </span>
              )}
              {isKiller && (
                <span className={`absolute -top-2 -left-2 px-1.5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center ${hand.killActive ? 'bg-[#c94c4c] text-white' : 'bg-[#6b4a2a] text-white'}`}>KILL</span>
              )}
              <div className="text-[11px] text-slate-400 truncate flex items-center justify-center gap-1">
                <span className="truncate">{p.name} · {positions[i]}</span>
                {isNit && <span className="shrink-0 rounded bg-amber-500/20 text-amber-300 px-1 text-[9px] font-semibold">NIT</span>}
              </div>
              {stackShown(p) && (
                <div className={`text-sm font-semibold ${atRisk ? 'text-rose-300' : 'text-white'}`}>{formatPlayerTagAmount(p.stack, cur, hand)}</div>
              )}
              {helpMode && hand.mode !== 'cash' && (() => {
                const effM = calculateEffectiveM(p, hand);
                if (effM == null) return null;
                const formattedM = effM < 100 ? effM.toFixed(1) : Math.round(effM).toString();
                return (
                  <div className="text-[10px] font-mono font-medium text-cyan-300 mt-0.5">
                    Eff M: {formattedM}
                  </div>
                );
              })()}
              <div className={`text-[10px] mt-0.5 ${atRisk ? 'text-rose-200' : folded ? 'text-slate-500' : 'text-emerald-300/80'}`}>
                {laText}
              </div>
              {(() => {
                const oot = Array.isArray(hand.ootActions) && hand.ootActions.find((o) => o.playerId === p.id && o.street === hand.street);
                if (!oot) return null;
                const label = oot.kind === 'passive'
                  ? 'OOT: check/call'
                  : oot.kind === 'aggressive'
                  ? (() => {
                      const lvl = oot.raiseLevel || 1;
                      const tier = lvl <= 1 ? 'bet' : lvl === 2 ? 'raise' : `${lvl}-bet`;
                      return `OOT: ${tier}${oot.amount ? ' ' + formatBetAmount(oot.amount, cur) : ''}`;
                    })()
                  : `OOT: ${oot.kind}`;
                return (
                  <div className="text-[10px] mt-0.5 font-medium text-amber-300/90 truncate">
                    {label}
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 w-[85%] max-w-[440px]">
        <div className="text-center">
          <div className="text-xs text-slate-400 uppercase tracking-wider">Pot</div>
          <div className="text-3xl font-bold text-white">{potShown ? money(pot, cur) : '—'}</div>
          {potShown && sidePots.length > 0 && (
            <div className="text-[10px] text-amber-300/80 mt-0.5">
              Side pots: {sidePots.map((sp) => formatSidePotAmount(sp.amount, cur)).join(' / ')}
            </div>
          )}
        </div>
        {!lowGame && (
          <div className="flex flex-col items-center gap-1">
            <div className="relative flex gap-1.5">
              {burnKey > 0 && (
                <div
                  key={`burn-${burnKey}`}
                  className="burn-card absolute left-0 top-0 w-8 h-11 rounded-md bg-[#3a4a3a] border border-[#4a5a4a] flex items-center justify-center pointer-events-none z-10"
                >
                  <span className="text-[#7fae7f] text-xs">?</span>
                </div>
              )}
              {[0, 1, 2, 3, 4].map((i) => (
                <Card key={i} card={hand.communityCards[i]} highlight={highlightKeys} anim={mainAnim[i]?.anim} delay={mainAnim[i]?.delay} style={mainAnim[i]?.style} />
              ))}
            </div>
            {hand.doubleBoard && (
              <div className="flex gap-1.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Card key={`b${i}`} card={(hand.boardB || [])[i]} highlight={highlightKeys} anim={bAnim[i]?.anim} delay={bAnim[i]?.delay} style={bAnim[i]?.style} />
                ))}
              </div>
            )}
            {helpMode && potOdds && (
              <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-600/70 text-emerald-300 text-xs font-semibold shadow-sm mt-1">
                <span>Pot odds: {potOdds.percent}%</span>
                {potOdds.costToCall > 0 && (
                  <span className="text-[10px] text-emerald-400/80 font-normal">
                    ({potOdds.playerName ? `${potOdds.playerName} ` : ''}calls {money(potOdds.costToCall, cur)})
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

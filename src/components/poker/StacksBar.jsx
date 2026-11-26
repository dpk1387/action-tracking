import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import AnimatedAmount from '@/components/poker/AnimatedAmount';
import { money } from '@/lib/poker';

function getOrdinal(n) {
  const num = Math.round(Number(n) || 0);
  if (num <= 0) return '';
  const s = ['TH', 'ST', 'ND', 'RD'];
  const v = num % 100;
  return `${num}${s[(v - 20) % 10] || s[v] || s[0] || 'TH'}`;
}

export default function StacksBar({
  hand,
  players = [],
  positions = [],
  currency,
  hideAmounts,
  showPosition = true,
  stackVisibleIds,
  freezeStacks,
  frozenStacks,
  displayUnit = 'chips',
  triggerElimination,
}) {
  // Map of seat -> { player, position }
  const [eliminating, setEliminating] = useState({});
  const prevPlayersRef = useRef(players);
  const prevPositionsRef = useRef(positions);
  const dismissedSeatsRef = useRef(new Set());
  const eliminatingSeatsRef = useRef(new Set());

  const prevHandNumberRef = useRef(hand?.handNumber);

  useEffect(() => {
    const currentHandNum = hand?.handNumber;
    const handChanged = currentHandNum !== prevHandNumberRef.current;
    prevHandNumberRef.current = currentHandNum;

    // If a seat currently has a live player with positive stack, ensure it is not dismissed
    (players || []).forEach((p) => {
      if (p && p.seat != null && p.stack > 0) {
        dismissedSeatsRef.current.delete(p.seat);
        eliminatingSeatsRef.current.delete(p.seat);
      }
    });

    const prev = prevPlayersRef.current || [];
    const prevPos = prevPositionsRef.current || [];
    const currentSeats = new Map();
    (players || []).forEach((p, idx) => {
      if (p && p.seat != null) currentSeats.set(p.seat, { p, idx });
    });

    // When next hand button is pressed (hand number changes), check for players who busted or left during the previous hand
    if (handChanged) {
      prev.forEach((oldP, oldIdx) => {
        if (!oldP || oldP.seat == null) return;
        if (dismissedSeatsRef.current.has(oldP.seat) || eliminatingSeatsRef.current.has(oldP.seat)) {
          return;
        }
        const curr = currentSeats.get(oldP.seat);
        const isGone = !curr || (curr.p.name && oldP.name && curr.p.name !== oldP.name);
        const isBusted = oldP.stack <= 0 || (curr && curr.p.stack <= 0);

        if (isGone || isBusted) {
          eliminatingSeatsRef.current.add(oldP.seat);
          const liveCount = (players || []).filter((p) => p && p.stack > 0).length;
          const rankLabel = getOrdinal(liveCount + 1);
          // Hold on screen for 2.0 seconds showing OUT/busted rank before collapsing
          setEliminating((prevElim) => ({
            ...prevElim,
            [oldP.seat]: {
              player: oldP,
              position: prevPos[oldIdx] || '',
              rankLabel,
            },
          }));

          // After 2.0 seconds, remove and mark dismissed so AnimatePresence triggers the smooth collapse
          setTimeout(() => {
            dismissedSeatsRef.current.add(oldP.seat);
            eliminatingSeatsRef.current.delete(oldP.seat);
            setEliminating((prevElim) => {
              const next = { ...prevElim };
              delete next[oldP.seat];
              return next;
            });
          }, 2000);
        }
      });
    }

    prevPlayersRef.current = players;
    prevPositionsRef.current = positions;
  }, [players, positions, hand?.handNumber]);

  // When End Tournament is pressed, show the elimination for 2nd (and any other busted player) immediately
  useEffect(() => {
    if (!triggerElimination) return;
    (players || []).forEach((p, idx) => {
      if (!p || p.seat == null) return;
      if (p.stack <= 0 && !eliminatingSeatsRef.current.has(p.seat)) {
        eliminatingSeatsRef.current.add(p.seat);
        const liveCount = (players || []).filter((pl) => pl && pl.stack > 0).length;
        const rankLabel = getOrdinal(liveCount + 1);
        setEliminating((prevElim) => ({
          ...prevElim,
          [p.seat]: {
            player: p,
            position: positions[idx] || '',
            rankLabel,
          },
        }));
      }
    });
  }, [triggerElimination, players, positions]);

  const stackFor = (p) => {
    if (freezeStacks && frozenStacks && frozenStacks[p.seat] != null) return frozenStacks[p.seat];
    return p.stack;
  };

  const activeList = (players || []).map((p, idx) => {
    const elim = eliminating[p.seat];
    return {
      seat: p.seat,
      player: elim ? elim.player : p,
      position: elim ? elim.position : (positions[idx] || ''),
      rankLabel: elim ? elim.rankLabel : undefined,
      isEliminating: Boolean(elim),
    };
  });

  const activeSeats = new Set(activeList.map((a) => a.seat));
  const items = [...activeList];
  Object.keys(eliminating).forEach((seatStr) => {
    const s = Number(seatStr);
    const elim = eliminating[s];
    if (elim && !activeSeats.has(s)) {
      items.push({
        seat: s,
        player: elim.player,
        position: elim.position,
        rankLabel: elim.rankLabel,
        isEliminating: true,
      });
    }
  });

  items.sort((a, b) => a.seat - b.seat);

  const isTourney = hand?.mode === 'tournament';
  const effectiveCurrency = isTourney ? '' : (currency || '');
  const activeUnit = displayUnit || hand?.displayUnit || 'chips';

  const formatStackAmount = (val, cur) => {
    const n = Number(val || 0);
    const absN = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (activeUnit === 'bb') {
      const bbVal = Number(hand?.bigBlind) || 0;
      if (bbVal > 0) {
        const bbs = absN / bbVal;
        if (absN > 0 && bbs < 1) {
          return `${sign}<1 BB`;
        }
        const rounded = Math.round(bbs);
        return `${sign}${rounded} BB`;
      }
    }
    const hasDec = !Number.isInteger(n);
    const formatted = absN.toLocaleString('en-US', {
      minimumFractionDigits: hasDec ? 2 : 0,
      maximumFractionDigits: 2,
    });
    const sym = isTourney ? '' : (cur || effectiveCurrency || '');
    return `${sign}${sym}${formatted}`;
  };

  const renderItem = (item) => {
    const p = item.player;
    const seat = item.seat;

    if (item.isEliminating) {
      return (
        <motion.div
          layout
          key={p.id || `seat-${seat}`}
          initial={{ opacity: 1, scale: 1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{
            opacity: 0,
            scale: 0.85,
            width: 0,
            minWidth: 0,
            maxWidth: 0,
            flexGrow: 0,
            flexShrink: 1,
            flexBasis: 0,
            paddingLeft: 0,
            paddingRight: 0,
            marginLeft: 0,
            marginRight: 0,
            borderWidth: 0,
            overflow: 'hidden',
            transition: { duration: 0.75, ease: [0.32, 0.72, 0, 1] },
          }}
          transition={{
            layout: { duration: 0.75, ease: [0.32, 0.72, 0, 1] },
          }}
          className="flex-1 min-w-0 rounded-lg border border-rose-500 bg-[#3a1f1f] px-2 py-2 shadow-[0_0_12px_rgba(244,63,94,0.5)] animate-pulse shrink-0 overflow-hidden"
        >
          <div className="text-xs text-rose-300 font-medium truncate flex items-center justify-between">
            <span className="line-through truncate">{p.name}</span>
            <span className="ml-1 text-[8px] bg-rose-600 text-white px-1 py-0.5 rounded font-bold uppercase shrink-0">
              OUT
            </span>
          </div>
          <div className="text-lg font-bold text-rose-400">
            {item.rankLabel || 'OUT'}
          </div>
        </motion.div>
      );
    }

    const isZero = p.stack <= 0;
    const isBustedAwarded = isZero && hand?.phase === 'awarded';
    const liveCount = (players || []).filter((pl) => pl && pl.stack > 0).length;
    const bustedRankLabel = getOrdinal(liveCount + 1);
    const frozen = freezeStacks && frozenStacks && frozenStacks[p.seat] != null;

    return (
      <motion.div
        layout
        key={p.id || `seat-${seat}`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{
          opacity: 0,
          scale: 0.85,
          width: 0,
          minWidth: 0,
          maxWidth: 0,
          flexGrow: 0,
          flexShrink: 1,
          flexBasis: 0,
          paddingLeft: 0,
          paddingRight: 0,
          marginLeft: 0,
          marginRight: 0,
          borderWidth: 0,
          overflow: 'hidden',
          transition: { duration: 0.75, ease: [0.32, 0.72, 0, 1] },
        }}
        transition={{
          layout: { duration: 0.75, ease: [0.32, 0.72, 0, 1] },
        }}
        className={`flex-1 min-w-0 rounded-lg border px-2 py-2 shrink-0 overflow-hidden ${
          isBustedAwarded
            ? 'bg-[#3a1f1f] border-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]'
            : p.status === 'allin'
            ? 'bg-[#3a1f1f] border-[#c94c4c]'
            : p.status === 'folded'
            ? 'bg-[#1a1d22] border-[#2a2f37] opacity-50'
            : 'bg-[#1e2227] border-[#2a2f37]'
        }`}
      >
        <div className="text-xs text-slate-400 truncate flex items-center justify-between">
          <span className="truncate">{p.name}{showPosition ? ` · ${(item.position || '').replace('UTG+', '+')}` : ''}</span>
          {isBustedAwarded && (
            <span className="ml-1 text-[8px] bg-rose-500 text-white px-1 py-0.5 rounded font-bold uppercase shrink-0">
              {bustedRankLabel}
            </span>
          )}
        </div>
        {(stackVisibleIds ? stackVisibleIds.has(p.id) : !hideAmounts) && (
          <div
            className={`text-lg font-bold tabular-nums ${
              isBustedAwarded || p.status === 'allin'
                ? 'text-rose-300'
                : frozen
                ? 'text-sky-300'
                : 'text-white'
            }`}
          >
            <AnimatedAmount
              value={stackFor(p)}
              currency={currency}
              animate
              formatter={formatStackAmount}
            />
          </div>
        )}
      </motion.div>
    );
  };

  const renderRow = (rowItems, rowKey) => (
    <div key={rowKey} className="flex gap-2 w-full overflow-hidden">
      <AnimatePresence initial={false}>
        {rowItems.map((item) => renderItem(item))}
      </AnimatePresence>
    </div>
  );

  if (items.length >= 11) {
    const row1 = items.slice(0, 6);
    const row2 = items.slice(6);
    return (
      <div className="flex flex-col gap-2 w-full">
        {renderRow(row1, 'row-1')}
        {renderRow(row2, 'row-2')}
      </div>
    );
  }

  return renderRow(items, 'row-single');
}

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import AnimatedAmount from '@/components/poker/AnimatedAmount';
import { money } from '@/lib/poker';

export default function StacksBar({
  hand,
  players = [],
  positions = [],
  currency,
  hideAmounts,
  stackVisibleIds,
  freezeStacks,
  frozenStacks,
}) {
  // Map of seat -> { player, position }
  const [eliminating, setEliminating] = useState({});
  const prevPlayersRef = useRef(players);
  const prevPositionsRef = useRef(positions);

  useEffect(() => {
    const prev = prevPlayersRef.current || [];
    const prevPos = prevPositionsRef.current || [];
    const currentSeats = new Map();
    players.forEach((p, idx) => {
      if (p && p.seat != null) currentSeats.set(p.seat, { p, idx });
    });

    prev.forEach((oldP, oldIdx) => {
      if (!oldP) return;
      const curr = currentSeats.get(oldP.seat);
      const isGone = !curr || curr.p.id !== oldP.id;
      const isBustedNow = curr && curr.p.stack <= 0 && oldP.stack > 0 && hand?.phase !== 'awarded';
      if ((isGone || isBustedNow) && !eliminating[oldP.seat]) {
        // Hold on screen for 1 second showing OUT/busted state before collapsing
        setEliminating((prevElim) => ({
          ...prevElim,
          [oldP.seat]: {
            player: oldP,
            position: prevPos[oldIdx] || '',
          },
        }));

        // After 1 second, remove so AnimatePresence triggers the smooth collapse
        setTimeout(() => {
          setEliminating((prevElim) => {
            const next = { ...prevElim };
            delete next[oldP.seat];
            return next;
          });
        }, 1100);
      }
    });

    prevPlayersRef.current = players;
    prevPositionsRef.current = positions;
  }, [players, positions, hand?.phase]);

  const stackFor = (p) => {
    if (freezeStacks && frozenStacks && frozenStacks[p.seat] != null) return frozenStacks[p.seat];
    return p.stack;
  };

  const activeList = (players || []).map((p, idx) => ({
    seat: p.seat,
    player: p,
    position: positions[idx] || '',
    isEliminating: false,
  }));

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
        isEliminating: true,
      });
    }
  });

  items.sort((a, b) => a.seat - b.seat);

  return (
    <div className="flex gap-2 w-full overflow-hidden">
      <AnimatePresence initial={false}>
        {items.map((item) => {
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
                <div className="text-lg font-bold text-rose-400 line-through">
                  0
                </div>
              </motion.div>
            );
          }

          const isZero = p.stack <= 0;
          const isBustedAwarded = isZero && hand?.phase === 'awarded';
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
                <span className="truncate">{p.name} · {(item.position || '').replace('UTG+', '+')}</span>
                {isBustedAwarded && (
                  <span className="ml-1 text-[8px] bg-rose-500 text-white px-1 py-0.5 rounded font-bold uppercase shrink-0">
                    OUT
                  </span>
                )}
              </div>
              {(stackVisibleIds ? stackVisibleIds.has(p.id) : !hideAmounts) && (
                <div
                  className={`text-lg font-bold font-mono ${
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
                    formatter={(val, cur) => (cur ? `${cur}${Number(val || 0).toLocaleString('en-US')}` : Number(val || 0).toLocaleString('en-US'))}
                  />
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

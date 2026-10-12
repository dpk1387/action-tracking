import React, { useState } from 'react';
import { parseCards, variantRanks, bettingFrozen } from '@/lib/poker';

export default function CommunityCardInput({ hand, onDeal, onDealHidden, onFillBoard, holeCards }) {
  const [textA, setTextA] = useState('');
  const [textB, setTextB] = useState('');
  const [error, setError] = useState('');

  const nonFolded = hand.players.filter((p) => p.status !== 'folded');
  const hasAllin = nonFolded.length >= 2 && nonFolded.some((p) => p.status === 'allin' || p.stack === 0);
  const activeCount = nonFolded.filter((p) => p.status === 'active' && p.stack > 0).length;
  const frozen = bettingFrozen(hand);
  const noFurtherBetting = (hasAllin || frozen) && (hand.currentPlayer === -1 || frozen);
  const hiddenA = hand.communityCards.filter((c) => c.hidden).length;
  const hiddenB = hand.doubleBoard ? (hand.boardB || []).filter((c) => c.hidden).length : 0;
  const hiddenCount = hiddenA + hiddenB;
  const next = { preflop: 'flop', flop: 'turn', turn: 'river' }[hand.street];
  const isRiver = hand.street === 'river';
  const complete = (hand.currentPlayer === -1 || noFurtherBetting || frozen || hand.phase === 'ended') && hand.phase !== 'awarded';
  const dbl = !!hand.doubleBoard;

  const heldKeys = new Set();
  if (holeCards) {
    for (const pid of Object.keys(holeCards)) {
      const cards = holeCards[pid];
      if (Array.isArray(cards)) cards.forEach((c) => heldKeys.add(c.rank + c.suit));
    }
  }
  const boardKeys = new Set();
  hand.communityCards.forEach((c) => { if (!c.hidden) boardKeys.add(c.rank + c.suit); });
  if (dbl) (hand.boardB || []).forEach((c) => { if (!c.hidden) boardKeys.add(c.rank + c.suit); });

  const parseBoth = () => {
    const allowed = variantRanks(hand.variant);
    const a = parseCards(textA, allowed);
    if (a.error) return { error: `Board 1: ${a.error}` };
    let bCards = [];
    if (dbl) {
      const b = parseCards(textB, allowed);
      if (b.error) return { error: `Board 2: ${b.error}` };
      bCards = b.cards;
    }
    const seen = new Set();
    const check = (cards, label) => {
      for (const c of cards) {
        const k = c.rank + c.suit;
        if (heldKeys.has(k)) return `${label}: ${c.rank}${c.suit} is in a player's hand`;
        if (boardKeys.has(k)) return `${label}: ${c.rank}${c.suit} is already on the board`;
        if (seen.has(k)) return `${label}: ${c.rank}${c.suit} entered twice`;
        seen.add(k);
      }
      return null;
    };
    const eA = check(a.cards, 'Board 1');
    if (eA) return { error: eA };
    if (dbl) {
      const eB = check(bCards, 'Board 2');
      if (eB) return { error: eB };
    }
    return { aCards: a.cards, bCards };
  };

  const dealReal = () => {
    setError('');
    const expected = next === 'flop' ? 3 : 1;
    const { aCards, bCards, error: perr } = parseBoth();
    if (perr) return setError(perr);
    if (aCards.length !== expected) return setError(`Board 1: enter ${expected} card(s) for the ${next.toUpperCase()}.`);
    if (dbl && bCards.length !== expected) return setError(`Board 2: enter ${expected} card(s) for the ${next.toUpperCase()}.`);
    const all = dbl ? [...aCards, ...bCards] : aCards;
    const res = onDeal(all);
    if (res && res.error) setError(res.error);
    else { setTextA(''); setTextB(''); }
  };

  const fillHidden = () => {
    setError('');
    const { aCards, bCards, error: perr } = parseBoth();
    if (perr) return setError(perr);
    if (aCards.length !== hiddenA) return setError(`Board 1: enter ${hiddenA} card(s).`);
    if (dbl && bCards.length !== hiddenB) return setError(`Board 2: enter ${hiddenB} card(s).`);
    const all = dbl ? [...aCards, ...bCards] : aCards;
    const res = onFillBoard(all);
    if (res && res.error) setError(res.error);
    else { setTextA(''); setTextB(''); }
  };

  const dealHidden = () => {
    setError('');
    const res = onDealHidden();
    if (res && res.error) setError(res.error);
  };

  const hiddenLabelA = hiddenA >= 5 ? 'flop, turn & river' : hiddenA >= 4 ? 'flop & turn' : hiddenA === 3 ? 'flop' : 'turn';
  const showdown = (hand.currentPlayer === -1 || noFurtherBetting) && (hasAllin || frozen || hand.phase === 'ended');
  const streetUpper = next ? next.toUpperCase() : '';
  const countHint = next === 'flop' ? '3 cards' : '1 card';

  return (
    <div className="rounded-xl border border-[#2a2f37] bg-[#1e2227] p-4">
      {hiddenCount > 0 && showdown ? (
        <>
          <div className="text-xs text-slate-400 mb-2">
            Enter the {hiddenLabelA} already on board 1{dbl ? ', then board 2' : ''} (rank-suit, e.g. Td 8s 2c). Use T for ten.
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-slate-400">Board 1</span>
              <input value={textA} onChange={(e) => setTextA(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fillHidden()} placeholder={`${hiddenA} cards`} className="flex-1 rounded-lg bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
            </div>
            {dbl && (
              <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs text-slate-400">Board 2</span>
                <input value={textB} onChange={(e) => setTextB(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fillHidden()} placeholder={`${hiddenB} cards`} className="flex-1 rounded-lg bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
              </div>
            )}
          </div>
          <button onClick={fillHidden} className="mt-2 rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm px-4 py-2">Confirm board</button>
        </>
      ) : (hasAllin || frozen || noFurtherBetting) && complete && next ? (
        <>
          <div className="text-xs text-slate-400 mb-2">
            All-in – enter the {streetUpper} for board 1{dbl ? ', then board 2' : ''} (rank-suit, e.g. As Kd). Use T for ten.
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-slate-400">Board 1</span>
              <input value={textA} onChange={(e) => setTextA(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && dealReal()} placeholder={countHint} className="flex-1 rounded-lg bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
            </div>
            {dbl && (
              <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs text-slate-400">Board 2</span>
                <input value={textB} onChange={(e) => setTextB(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && dealReal()} placeholder={countHint} className="flex-1 rounded-lg bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
              </div>
            )}
          </div>
          <button onClick={dealReal} className="mt-2 rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm px-4 py-2">Deal {streetUpper}</button>
        </>
      ) : !(hasAllin || frozen || noFurtherBetting) && complete && next ? (
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400">Deal the {streetUpper}{dbl ? ' (both boards)' : ''} – board stays hidden unless there's an all-in.</div>
          <button onClick={dealHidden} className="rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm px-4 py-2">Deal {streetUpper}</button>
        </div>
      ) : (
        <div className="text-xs text-slate-500">{isRiver ? 'River is out – enter hole cards to settle the showdown.' : `Complete the ${hand.street} round before dealing the ${next}.`}</div>
      )}
      {error && <div className="text-xs text-rose-400 mt-2">{error}</div>}
    </div>
  );
}

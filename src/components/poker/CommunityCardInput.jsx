import React, { useState, useEffect } from 'react';
import { parseCards, variantRanks, bettingFrozen, SUIT_SYMBOL, SUIT_RED } from '@/lib/poker';

const SUIT_INFO = {
  s: { symbol: '♠', color: 'text-slate-200', bg: 'bg-slate-800 border-slate-600' },
  h: { symbol: '♥', color: 'text-rose-500', bg: 'bg-rose-950/80 border-rose-700/80' },
  d: { symbol: '♦', color: 'text-blue-400', bg: 'bg-blue-950/80 border-blue-700/80' },
  c: { symbol: '♣', color: 'text-emerald-400', bg: 'bg-emerald-950/80 border-emerald-700/80' },
};

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

export default function CommunityCardInput({ hand, onDeal, onDealHidden, onFillBoard, holeCards = {}, onRunIt, onDealBoard, onEndHand }) {
  const [textA, setTextA] = useState('');
  const [textB, setTextB] = useState('');
  const [textC, setTextC] = useState('');
  const [multiText, setMultiText] = useState('');
  const [activeTarget, setActiveTarget] = useState('A'); // 'A' | 'B' | 'C' | 'multi'
  const [selectedRank, setSelectedRank] = useState('A');
  const [error, setError] = useState('');

  const usedCardsSet = React.useMemo(() => {
    const set = new Set();
    // Board cards
    (hand.communityCards || []).forEach((c) => { if (c && !c.hidden) set.add(c.rank + c.suit); });
    (hand.boardB || []).forEach((c) => { if (c && !c.hidden) set.add(c.rank + c.suit); });
    (hand.boardC || []).forEach((c) => { if (c && !c.hidden) set.add(c.rank + c.suit); });
    // Player hole cards
    if (holeCards) {
      Object.values(holeCards).forEach((cards) => {
        if (Array.isArray(cards)) cards.forEach((c) => { if (c) set.add(c.rank + c.suit); });
      });
    }
    return set;
  }, [hand.communityCards, hand.boardB, hand.boardC, holeCards]);

  const handlePickBoardCard = (rank, suitKey) => {
    const cardStr = rank + suitKey;
    if (usedCardsSet.has(cardStr)) return;
    if (activeTarget === 'A') {
      setTextA((prev) => (prev ? prev.trim() + ' ' + cardStr : cardStr));
    } else if (activeTarget === 'B') {
      setTextB((prev) => (prev ? prev.trim() + ' ' + cardStr : cardStr));
    } else if (activeTarget === 'C') {
      setTextC((prev) => (prev ? prev.trim() + ' ' + cardStr : cardStr));
    } else if (activeTarget === 'multi') {
      setMultiText((prev) => (prev ? prev.trim() + ' ' + cardStr : cardStr));
    }
  };

  useEffect(() => {
    setError('');
  }, [hand?.street, hand?.handNumber, hand?.phase, hand?.runTimes]);

  const nonFolded = hand.players.filter((p) => p.status !== 'folded');
  const frozen = bettingFrozen(hand);
  const isAllInShowdown = frozen && nonFolded.length >= 2;
  const noFurtherBetting = isAllInShowdown || hand.currentPlayer === -1;
  const isCash = hand.mode === 'cash' || !hand.mode;
  const allInContestants = nonFolded.filter((p) => p.status === 'allin' || p.stack <= 0);
  const isMultiAllIn = (allInContestants.length >= 2) || (allInContestants.length >= 1 && nonFolded.length >= 2 && frozen);

  const dbl = !!hand.doubleBoard;
  const isTriple = (Number(hand.bombBoards) >= 3) || (hand.boardC && hand.boardC.length > 0) || (Number(hand.runTimes) >= 3);
  const hiddenA = (hand.communityCards || []).filter((c) => c && c.hidden).length;
  const hiddenB = dbl ? (hand.boardB || []).filter((c) => c && c.hidden).length : 0;
  const hiddenC = isTriple ? (hand.boardC || []).filter((c) => c && c.hidden).length : 0;
  const hiddenCount = hiddenA + hiddenB + hiddenC;
  const next = { preflop: 'flop', flop: 'turn', turn: 'river', ...(hand.variant === 'ocean' ? { river: 'ocean' } : {}) }[hand.street];
  const isOcean = hand.variant === 'ocean';
  const isRiver = hand.street === 'river';
  const isOceanStreet = hand.street === 'ocean';
  const complete = (hand.currentPlayer === -1 || noFurtherBetting || frozen || hand.phase === 'ended') && hand.phase !== 'awarded';

  const cardsALen = (hand.communityCards || []).filter((c) => c && !c.hidden).length;
  const cardsBLen = (hand.boardB || []).filter((c) => c && !c.hidden).length;
  const cardsCLen = (hand.boardC || []).filter((c) => c && !c.hidden).length;

  const targetBoardLen = (hand.variant === 'three_two_one' || hand.variant === 'ocean') ? 6 : 5;
  // Always offer run it 2x / 3x in cash games when 2+ players are all in and betting is complete
  const canRunIt = isCash && isMultiAllIn && noFurtherBetting && (!hand.runTimes || Number(hand.runTimes) <= 1) && !hand.runItSelected && cardsALen < targetBoardLen && hand.phase !== 'awarded';

  const isMultiRun = Number(hand.runTimes) >= 2;
  const isTripleRun = Number(hand.runTimes) >= 3;
  const isCommonHidden = isMultiRun && !dbl && !isTriple && !hand.bombPot && hiddenA > 0;

  const heldKeys = new Set();
  if (holeCards) {
    for (const pid of Object.keys(holeCards)) {
      const cards = holeCards[pid];
      if (Array.isArray(cards)) cards.forEach((c) => heldKeys.add(c.rank + c.suit));
    }
  }

  const boardKeys = new Set();
  (hand.communityCards || []).forEach((c) => { if (c && !c.hidden) boardKeys.add(c.rank + c.suit); });
  if (dbl) (hand.boardB || []).forEach((c) => { if (c && !c.hidden) boardKeys.add(c.rank + c.suit); });
  if (isTriple) (hand.boardC || []).forEach((c) => { if (c && !c.hidden) boardKeys.add(c.rank + c.suit); });

  const checkDuplicates = (cards, label) => {
    const seen = new Set();
    for (const c of cards) {
      const k = c.rank + c.suit;
      if (heldKeys.has(k)) return `${label}: ${c.rank}${c.suit} is in a player's hand`;
      if (boardKeys.has(k)) return `${label}: ${c.rank}${c.suit} is already on the board`;
      if (seen.has(k)) return `${label}: ${c.rank}${c.suit} entered twice`;
      seen.add(k);
    }
    return null;
  };

  const parseAllBoards = () => {
    const allowed = variantRanks(hand.variant);
    const a = parseCards(textA, allowed);
    if (a.error) return { error: `Board 1: ${a.error}` };
    let bCards = [];
    if (dbl) {
      const b = parseCards(textB, allowed);
      if (b.error) return { error: `Board 2: ${b.error}` };
      bCards = b.cards;
    }
    let cCards = [];
    if (isTriple) {
      const c = parseCards(textC, allowed);
      if (c.error) return { error: `Board 3: ${c.error}` };
      cCards = c.cards;
    }
    const eA = checkDuplicates(a.cards, 'Board 1');
    if (eA) return { error: eA };
    if (dbl) {
      const eB = checkDuplicates(bCards, 'Board 2');
      if (eB) return { error: eB };
    }
    if (isTriple) {
      const eC = checkDuplicates(cCards, 'Board 3');
      if (eC) return { error: eC };
    }
    return { aCards: a.cards, bCards, cCards };
  };

  const dealReal = () => {
    setError('');
    const expected = next === 'flop' ? 3 : (next === 'turn' && hand.variant === 'three_two_one') ? 2 : 1;
    const { aCards, bCards, cCards, error: perr } = parseAllBoards();
    if (perr) return setError(perr);
    if (aCards.length !== expected) return setError(`Board 1: enter ${expected} card(s) for the ${next.toUpperCase()}.`);
    if (dbl && bCards.length !== expected) return setError(`Board 2: enter ${expected} card(s) for the ${next.toUpperCase()}.`);
    if (isTriple && cCards.length !== expected) return setError(`Board 3: enter ${expected} card(s) for the ${next.toUpperCase()}.`);
    const all = isTriple ? [...aCards, ...bCards, ...cCards] : dbl ? [...aCards, ...bCards] : aCards;
    const res = onDeal(all);
    if (res && res.error) setError(res.error);
    else { setTextA(''); setTextB(''); setTextC(''); }
  };

  const handleDealNormalStreet = () => {
    if (!textA.trim() && (!dbl || !textB.trim()) && (!isTriple || !textC.trim())) {
      dealHidden();
    } else {
      dealReal();
    }
  };

  const fillHidden = () => {
    setError('');
    const allowed = variantRanks(hand.variant);
    if (isCommonHidden) {
      const a = parseCards(textA, allowed);
      if (a.error) return setError(a.error);
      if (a.cards.length !== hiddenA) {
        return setError(`Enter exactly ${hiddenA} card(s) for the ${hand.street === 'flop' ? 'flop' : 'flop & turn'}.`);
      }
      for (const c of a.cards) {
        const k = c.rank + c.suit;
        if (heldKeys.has(k)) return setError(`${c.rank}${c.suit} is in a player's hand`);
      }
      const res = onFillBoard(a.cards);
      if (res && res.error) setError(res.error);
      else { setTextA(''); setTextB(''); setTextC(''); }
      return;
    }

    const { aCards, bCards, cCards, error: perr } = parseAllBoards();
    if (perr) return setError(perr);
    if (aCards.length !== hiddenA) return setError(`Board 1: enter ${hiddenA} card(s).`);
    if (dbl && bCards.length !== hiddenB) return setError(`Board 2: enter ${hiddenB} card(s).`);
    if (isTriple && cCards.length !== hiddenC) return setError(`Board 3: enter ${hiddenC} card(s).`);
    const all = isTriple ? [...aCards, ...bCards, ...cCards] : dbl ? [...aCards, ...bCards] : aCards;
    const res = onFillBoard(all);
    if (res && res.error) setError(res.error);
    else { setTextA(''); setTextB(''); setTextC(''); }
  };

  const dealHidden = () => {
    setError('');
    const res = onDealHidden();
    if (res && res.error) setError(res.error);
  };

  // Determine active board when running multiple times (board-by-board deal flow)
  let activeMultiBoard = null;
  let activeMultiBoardName = '';
  let activeCardsNeeded = 0;
  if (isMultiRun && !isCommonHidden && !dbl && !isTriple && !hand.bombPot) {
    if (cardsALen < targetBoardLen) {
      activeMultiBoard = 1;
      activeMultiBoardName = 'Board 1';
      activeCardsNeeded = targetBoardLen - cardsALen;
    } else if (cardsBLen < targetBoardLen) {
      activeMultiBoard = 2;
      activeMultiBoardName = 'Board 2';
      activeCardsNeeded = targetBoardLen - cardsBLen;
    } else if (isTripleRun && cardsCLen < targetBoardLen) {
      activeMultiBoard = 3;
      activeMultiBoardName = 'Board 3';
      activeCardsNeeded = targetBoardLen - cardsCLen;
    }
  }

  const dealActiveMultiBoard = () => {
    if (!activeMultiBoard) return;
    setError('');
    const allowed = variantRanks(hand.variant);
    const parsed = parseCards(multiText, allowed);
    if (parsed.error) return setError(parsed.error);
    const cLen = parsed.cards.length;
    if (cLen === 0) return setError(`Enter cards for ${activeMultiBoardName}.`);
    if (cLen > activeCardsNeeded) return setError(`Enter up to ${activeCardsNeeded} card(s) to finish ${activeMultiBoardName}.`);
    // Validation: cannot be in player hand or already on any board
    const err = checkDuplicates(parsed.cards, activeMultiBoardName);
    if (err) return setError(err);

    if (onDealBoard) {
      const res = onDealBoard(activeMultiBoard, parsed.cards);
      if (res && res.error) setError(res.error);
      else setMultiText('');
    } else {
      const res = onDeal(parsed.cards);
      if (res && res.error) setError(res.error);
      else setMultiText('');
    }
  };

  const is321 = hand.variant === 'three_two_one';
  const isRedRiver = hand.variant === 'red_river';

  const hiddenLabelA = isOcean
    ? (cardsALen === 5 ? 'Ocean' : cardsALen === 4 ? 'River' : cardsALen === 3 ? 'Turn' : 'Flop')
    : is321
    ? (cardsALen === 5 ? 'River' : cardsALen === 3 ? 'Turn (2 cards)' : cardsALen < 3 ? 'Flop' : 'cards')
    : isRedRiver
    ? (cardsALen >= 5 ? `River ${cardsALen - 3}` : cardsALen === 4 ? 'River' : cardsALen === 3 ? 'Turn' : 'Flop')
    : cardsALen >= 4
    ? 'River'
    : cardsALen === 3
    ? 'Turn'
    : hiddenA >= 5
    ? 'flop, turn & river'
    : hiddenA >= 4
    ? 'flop & turn'
    : hiddenA === 3
    ? 'flop'
    : 'turn';
  const isFinalStreet = isOcean ? (isOceanStreet || cardsALen >= 6) : (isRiver || cardsALen >= (is321 ? 6 : 5));
  const showdown = (isFinalStreet && (hand.currentPlayer === -1 || noFurtherBetting)) || (noFurtherBetting && isAllInShowdown) || hand.phase === 'ended';
  const streetUpper = next ? next.toUpperCase() : '';
  const expectedCardsCount = next === 'flop' ? 3 : (next === 'turn' && is321) ? 2 : 1;
  const countHint = isOcean
    ? (cardsALen === 5 ? '1 card (Ocean)' : cardsALen === 4 ? '1 card (River)' : next === 'turn' ? '1 card (Turn)' : '3 cards (Flop)')
    : is321
    ? (cardsALen === 5 ? '1 card (River)' : next === 'turn' ? '2 cards (Turn)' : '3 cards (Flop)')
    : isRedRiver
    ? (cardsALen >= 5 ? `1 card for River ${cardsALen - 3}` : next === 'flop' ? '3 cards' : '1 card')
    : cardsALen >= 4
    ? '1 card (River)'
    : next === 'flop'
    ? '3 cards'
    : '1 card';
  const boardsLabel = isTriple ? ' (all 3 boards)' : dbl ? ' (both boards)' : '';

  const renderRunItButtons = () => {
    if (!canRunIt) return null;
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onRunIt && onRunIt(2)}
          className="rounded-lg bg-[#223326] hover:bg-[#2b4231] border border-emerald-600/70 text-emerald-300 text-xs font-bold px-3 py-2 cursor-pointer shadow-md transition-colors"
        >
          Run It 2x
        </button>
        <button
          type="button"
          onClick={() => onRunIt && onRunIt(3)}
          className="rounded-lg bg-[#2e233d] hover:bg-[#3d2f52] border border-purple-600/70 text-purple-300 text-xs font-bold px-3 py-2 cursor-pointer shadow-md transition-colors"
        >
          Run It 3x
        </button>
      </div>
    );
  };

  const renderBoardKeyboard = () => {
    const targetName = activeTarget === 'A' ? 'Board 1' : activeTarget === 'B' ? 'Board 2' : activeTarget === 'C' ? 'Board 3' : 'Run It Board';
    return (
      <div className="mt-3 rounded-lg bg-[#11151c] border border-slate-800 p-2.5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300 font-bold">
            Tap to add card to <span className="text-amber-300 font-extrabold">{targetName}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              if (activeTarget === 'A') setTextA('');
              else if (activeTarget === 'B') setTextB('');
              else if (activeTarget === 'C') setTextC('');
              else if (activeTarget === 'multi') setMultiText('');
            }}
            className="text-[10px] text-rose-400 hover:text-rose-300 bg-rose-950/60 border border-rose-800/80 px-2 py-0.5 rounded font-bold cursor-pointer"
          >
            Clear {targetName}
          </button>
        </div>

        {/* Rank Row */}
        <div className="grid grid-cols-13 gap-1">
          {RANKS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setSelectedRank(r)}
              className={`py-1 rounded-md font-black text-xs transition-all cursor-pointer ${
                selectedRank === r
                  ? 'bg-amber-500 text-black shadow ring-1 ring-amber-300 scale-105'
                  : 'bg-[#1d2430] hover:bg-[#283244] text-slate-200 border border-slate-700/60'
              }`}
            >
              {r === 'T' ? '10' : r}
            </button>
          ))}
        </div>

        {/* Suit Row */}
        <div className="grid grid-cols-4 gap-1.5 pt-0.5">
          {Object.entries(SUIT_INFO).map(([suitKey, info]) => {
            const cardKey = selectedRank + suitKey;
            const isUsed = usedCardsSet.has(cardKey);
            return (
              <button
                key={suitKey}
                type="button"
                disabled={isUsed}
                onClick={() => handlePickBoardCard(selectedRank, suitKey)}
                className={`py-1.5 px-2 rounded-md font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${info.bg} hover:brightness-125`}
              >
                <span className={`text-sm font-extrabold leading-none ${info.color}`}>{info.symbol}</span>
                <span className="text-white text-xs">{selectedRank === 'T' ? '10' : selectedRank}{info.symbol}</span>
                {isUsed && <span className="text-[9px] text-slate-500 line-through">used</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-[#2a2f37] bg-[#1e2227] p-4">
      {/* 1. Common Hidden Cards (e.g. flop or turn dealt hidden before all-in or run-it) */}
      {hiddenCount > 0 && showdown ? (
        <>
          <div className="text-xs text-slate-400 mb-2">
            {isCommonHidden
              ? `Enter the ${hand.street === 'flop' ? 'flop' : 'flop & turn'} (appears on all boards) (rank-suit, e.g. Td 8s 2c). Use T for ten.`
              : `Enter ${hiddenLabelA} already on board 1 (${cardsALen} card${cardsALen > 1 ? 's' : ''} on board)${dbl ? ', board 2' : ''}${isTriple ? ', and board 3' : ''} (rank-suit, e.g. Td 8s 2c). Use T for ten.`}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTarget('A')}
                className={`w-20 shrink-0 text-xs text-left font-bold rounded px-1.5 py-1 ${activeTarget === 'A' ? 'text-amber-300 bg-amber-950/60 border border-amber-600/60' : 'text-slate-400'}`}
              >
                {isCommonHidden ? 'Common' : 'Board 1'}
              </button>
              <input
                value={textA}
                onFocus={() => setActiveTarget('A')}
                onChange={(e) => setTextA(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fillHidden()}
                placeholder={
                  is321
                    ? (cardsALen === 5 ? '1 card for River' : cardsALen === 3 ? '2 cards for Turn' : `${hiddenA} cards`)
                    : isRedRiver
                    ? (cardsALen >= 5 ? `1 card for River ${cardsALen - 3}` : `${hiddenA} cards`)
                    : cardsALen >= 4
                    ? '1 card for River'
                    : `${hiddenA} cards${isCommonHidden ? ' (shared on all boards)' : ''}`
                }
                className="flex-1 rounded-lg bg-[#15181d] border border-[#2a2f37] focus:border-amber-500 px-3 py-2 text-white text-sm"
              />
            </div>
            {!isCommonHidden && dbl && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTarget('B')}
                  className={`w-20 shrink-0 text-xs text-left font-bold rounded px-1.5 py-1 ${activeTarget === 'B' ? 'text-amber-300 bg-amber-950/60 border border-amber-600/60' : 'text-slate-400'}`}
                >
                  Board 2
                </button>
                <input
                  value={textB}
                  onFocus={() => setActiveTarget('B')}
                  onChange={(e) => setTextB(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fillHidden()}
                  placeholder={`${hiddenB} cards`}
                  className="flex-1 rounded-lg bg-[#15181d] border border-[#2a2f37] focus:border-amber-500 px-3 py-2 text-white text-sm"
                />
              </div>
            )}
            {!isCommonHidden && isTriple && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTarget('C')}
                  className={`w-20 shrink-0 text-xs text-left font-bold rounded px-1.5 py-1 ${activeTarget === 'C' ? 'text-amber-300 bg-amber-950/60 border border-amber-600/60' : 'text-slate-400'}`}
                >
                  Board 3
                </button>
                <input
                  value={textC}
                  onFocus={() => setActiveTarget('C')}
                  onChange={(e) => setTextC(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fillHidden()}
                  placeholder={`${hiddenC} cards`}
                  className="flex-1 rounded-lg bg-[#15181d] border border-[#2a2f37] focus:border-amber-500 px-3 py-2 text-white text-sm"
                />
              </div>
            )}
          </div>
          {renderBoardKeyboard()}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button onClick={fillHidden} className="rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm px-4 py-2 cursor-pointer font-semibold">
              Confirm board
            </button>
            {renderRunItButtons()}
          </div>
        </>
      ) : isMultiRun && activeMultiBoard ? (
        /* 2. Board-by-Board Deal Flow when Running It Multiple Times */
        <>
          <div className="text-xs text-slate-300 mb-2 flex items-center justify-between">
            <div>
              <span className="font-bold text-amber-400 uppercase tracking-wide">
                Run It {hand.runTimes}x
              </span>
              <span className="text-slate-400 ml-1.5">
                – Deal <span className="text-white font-bold">{activeMultiBoardName}</span> first to completion ({activeCardsNeeded} card{activeCardsNeeded > 1 ? 's' : ''} remaining)
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              {activeMultiBoard === 1 ? `Board 1 of ${hand.runTimes}` : `Board ${activeMultiBoard} of ${hand.runTimes}`}
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs font-bold text-amber-300">
                {activeMultiBoardName}
              </span>
              <input
                value={multiText}
                onFocus={() => setActiveTarget('multi')}
                onChange={(e) => setMultiText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && dealActiveMultiBoard()}
                placeholder={
                  activeCardsNeeded === targetBoardLen
                    ? `${targetBoardLen} cards for full board (or 3 for flop)`
                    : activeCardsNeeded === 2
                    ? (isOcean ? '2 cards for river & ocean (or 1 for river)' : '2 cards for turn & river (or 1 for turn)')
                    : (isOcean ? '1 card for ocean (e.g. As)' : '1 card for river (e.g. As)')
                }
                className="flex-1 rounded-lg bg-[#15181d] border border-amber-600/50 focus:border-amber-400 px-3 py-2 text-white text-sm"
              />
            </div>
          </div>
          {renderBoardKeyboard()}
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={dealActiveMultiBoard}
              className="rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-sm px-4 py-2 cursor-pointer font-semibold shadow-md transition-colors"
            >
              Deal {activeMultiBoardName}
            </button>
          </div>
        </>
      ) : isAllInShowdown && complete && next ? (
        /* 3. Regular All-In Showdown (Street by Street) */
        <>
          <div className="text-xs text-slate-400 mb-2">
            All-in – enter the {streetUpper} for board 1{dbl ? ', board 2' : ''}{isTriple ? ', and board 3' : ''} (rank-suit, e.g. As Kd). Use T for ten.
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTarget('A')}
                className={`w-16 shrink-0 text-xs text-left font-bold rounded px-1.5 py-1 ${activeTarget === 'A' ? 'text-amber-300 bg-amber-950/60 border border-amber-600/60' : 'text-slate-400'}`}
              >
                Board 1
              </button>
              <input
                value={textA}
                onFocus={() => setActiveTarget('A')}
                onChange={(e) => setTextA(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && dealReal()}
                placeholder={countHint}
                className="flex-1 rounded-lg bg-[#15181d] border border-[#2a2f37] focus:border-amber-500 px-3 py-2 text-white text-sm"
              />
            </div>
            {dbl && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTarget('B')}
                  className={`w-16 shrink-0 text-xs text-left font-bold rounded px-1.5 py-1 ${activeTarget === 'B' ? 'text-amber-300 bg-amber-950/60 border border-amber-600/60' : 'text-slate-400'}`}
                >
                  Board 2
                </button>
                <input
                  value={textB}
                  onFocus={() => setActiveTarget('B')}
                  onChange={(e) => setTextB(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && dealReal()}
                  placeholder={countHint}
                  className="flex-1 rounded-lg bg-[#15181d] border border-[#2a2f37] focus:border-amber-500 px-3 py-2 text-white text-sm"
                />
              </div>
            )}
            {isTriple && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTarget('C')}
                  className={`w-16 shrink-0 text-xs text-left font-bold rounded px-1.5 py-1 ${activeTarget === 'C' ? 'text-amber-300 bg-amber-950/60 border border-amber-600/60' : 'text-slate-400'}`}
                >
                  Board 3
                </button>
                <input
                  value={textC}
                  onFocus={() => setActiveTarget('C')}
                  onChange={(e) => setTextC(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && dealReal()}
                  placeholder={countHint}
                  className="flex-1 rounded-lg bg-[#15181d] border border-[#2a2f37] focus:border-amber-500 px-3 py-2 text-white text-sm"
                />
              </div>
            )}
          </div>
          {renderBoardKeyboard()}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button onClick={dealReal} className="rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm px-4 py-2 cursor-pointer font-semibold">
              Deal {streetUpper}
            </button>
            {renderRunItButtons()}
          </div>
        </>
      ) : !isAllInShowdown && complete && next ? (
        /* 4. Normal street deal (optional cards or hidden) */
        <>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-xs text-slate-400">
              Deal the {streetUpper}{boardsLabel} – enter cards (optional) or deal hidden. Use T for ten.
            </div>
            {renderRunItButtons()}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTarget('A')}
                className={`w-16 shrink-0 text-xs text-left font-bold rounded px-1.5 py-1 ${activeTarget === 'A' ? 'text-amber-300 bg-amber-950/60 border border-amber-600/60' : 'text-slate-400'}`}
              >
                Board 1
              </button>
              <input
                value={textA}
                onFocus={() => setActiveTarget('A')}
                onChange={(e) => setTextA(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDealNormalStreet()}
                placeholder={`${countHint} (or deal hidden)`}
                className="flex-1 rounded-lg bg-[#15181d] border border-[#2a2f37] focus:border-amber-500 px-3 py-2 text-white text-sm"
              />
            </div>
            {dbl && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTarget('B')}
                  className={`w-16 shrink-0 text-xs text-left font-bold rounded px-1.5 py-1 ${activeTarget === 'B' ? 'text-amber-300 bg-amber-950/60 border border-amber-600/60' : 'text-slate-400'}`}
                >
                  Board 2
                </button>
                <input
                  value={textB}
                  onFocus={() => setActiveTarget('B')}
                  onChange={(e) => setTextB(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDealNormalStreet()}
                  placeholder={`${countHint} (or deal hidden)`}
                  className="flex-1 rounded-lg bg-[#15181d] border border-[#2a2f37] focus:border-amber-500 px-3 py-2 text-white text-sm"
                />
              </div>
            )}
            {isTriple && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTarget('C')}
                  className={`w-16 shrink-0 text-xs text-left font-bold rounded px-1.5 py-1 ${activeTarget === 'C' ? 'text-amber-300 bg-amber-950/60 border border-amber-600/60' : 'text-slate-400'}`}
                >
                  Board 3
                </button>
                <input
                  value={textC}
                  onFocus={() => setActiveTarget('C')}
                  onChange={(e) => setTextC(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDealNormalStreet()}
                  placeholder={`${countHint} (or deal hidden)`}
                  className="flex-1 rounded-lg bg-[#15181d] border border-[#2a2f37] focus:border-amber-500 px-3 py-2 text-white text-sm"
                />
              </div>
            )}
          </div>
          {renderBoardKeyboard()}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button
              onClick={handleDealNormalStreet}
              className="rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm px-4 py-2 cursor-pointer font-semibold shadow transition-colors"
            >
              Deal {streetUpper}
            </button>
            <button
              onClick={dealHidden}
              className="rounded-lg bg-[#242930] hover:bg-[#303742] text-slate-300 hover:text-white border border-slate-700 text-sm px-4 py-2 cursor-pointer font-medium transition-colors"
            >
              Deal {streetUpper} (Hidden)
            </button>
            {renderRunItButtons()}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {hand.variant === 'red_river' && (isRiver || cardsALen >= 5) ? (
              (() => {
                const realCards = (hand.communityCards || []).filter((c) => c && !c.hidden);
                const last = realCards[realCards.length - 1];
                const isRed = last && (last.suit === 'd' || last.suit === 'h' || last.suit === '♦' || last.suit === '♥');
                if (isRed) return `Red River card is RED (${last.rank}${last.suit === 'd' ? '♦' : '♥'}) — action continues, deal next river card.`;
                if (last) return `Red River card is BLACK (${last.rank}${last.suit === 's' ? '♠' : '♣'}) — showdown reached.`;
                return 'Select / deal the river card.';
              })()
            ) : isFinalStreet || hand.phase === 'ended' ? (
              'Showdown reached – hole cards & board entry are optional.'
            ) : (
              `Complete the ${hand.street} round before dealing the ${next}.`
            )}
          </div>
          {hand.variant === 'red_river' && (isRiver || cardsALen >= 5) ? (
            (() => {
              const realCards = (hand.communityCards || []).filter((c) => c && !c.hidden);
              const last = realCards[realCards.length - 1];
              const isRed = last && (last.suit === 'd' || last.suit === 'h' || last.suit === '♦' || last.suit === '♥');
              if (isRed) {
                return (
                  <button
                    onClick={dealHidden}
                    className="rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-sm px-4 py-2 cursor-pointer font-semibold shadow transition-colors"
                  >
                    Deal Next River
                  </button>
                );
              }
              return (
                <button
                  onClick={() => (onEndHand ? onEndHand() : (onRunIt && onRunIt()))}
                  className="rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm px-4 py-2 cursor-pointer font-semibold shadow transition-colors"
                >
                  Award Pots / Select Winner
                </button>
              );
            })()
          ) : (hand.phase === 'ended' || isFinalStreet) ? (
            <button
              onClick={() => (onEndHand ? onEndHand() : (onRunIt && onRunIt()))}
              className="rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm px-4 py-2 cursor-pointer font-semibold shadow transition-colors"
            >
              Award Pots / Select Winner
            </button>
          ) : null}
        </div>
      )}
      {error && <div className="text-xs text-rose-400 mt-2">{error}</div>}
    </div>
  );
}

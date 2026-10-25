import React, { useState, useEffect } from 'react';
import { money, parseAmount, bettingFrozen } from '@/lib/poker';

export default function ActionRecorder({ hand, onAction }) {
  const [amount, setAmount] = useState('');
  const [muckArmed, setMuckArmed] = useState(false);
  const cp = hand.currentPlayer >= 0 ? hand.players[hand.currentPlayer] : null;
  const cur = hand.currency;
  const gt = hand.gameType || 'nl';
  const isPL = gt === 'pl';
  const isFL = gt === 'fl';

  useEffect(() => { setAmount(''); setMuckArmed(false); }, [hand.currentPlayer, hand.street]);

  const ootForCurrent = cp && Array.isArray(hand.ootActions)
    ? hand.ootActions.find((o) => o.playerId === cp.id && o.street === hand.street)
    : null;
  const passiveBoundThisStreet = cp && hand.passiveBound && hand.passiveBound[cp.id] === hand.street;
  const ootPassiveBound = !!(ootForCurrent && ootForCurrent.kind === 'passive') || passiveBoundThisStreet;

  const handleFold = () => {
    if (canCheck) {
      if (!muckArmed) { setMuckArmed(true); return; }
      setMuckArmed(false);
    }
    onAction('fold');
  };

  if (!cp || bettingFrozen(hand)) {
    return (
      <div className="rounded-xl border border-[#2a2f37] bg-[#1e2227] p-4">
        <div className="text-sm text-slate-400">
          {hand.blindsPosted === false
            ? 'Break in progress – resume play to post blinds and start the hand.'
            : hand.phase === 'ended'
            ? 'Hand complete – award the pots to finish.'
            : (hand.message || 'Betting complete.')}
        </div>
      </div>
    );
  }

  const toCall = Math.max(0, hand.currentBet - cp.currentBet);
  const canCheck = toCall === 0;
  const callAmt = Math.min(toCall, cp.stack);
  const maxTotalCommitment = cp.currentBet + cp.stack;
  const otherNonFolded = hand.players.filter((p) => p.id !== cp.id && p.status !== 'folded');
  const othersHaveChips = otherNonFolded.some((p) => (p.stack || 0) > 0);
  const canReopenRaise = !hand.shortAllinOpen || !cp.hasActed || cp.currentBet < hand.currentBet;
  const canRaise = cp.stack > toCall && canReopenRaise && othersHaveChips;
  const mustAllinToCall = !canCheck && cp.stack < toCall;
  const effectiveLiveBlind = (hand.street === 'preflop')
    ? (hand.anteType === 'four_blinds'
        ? (Number(hand.fourthBlind) || (hand.bigBlind * 4))
        : hand.anteType === 'three_blinds'
        ? (Number(hand.thirdBlind) || (hand.bigBlind * 2))
        : hand.bigBlind)
    : hand.bigBlind;
  const minRaise = hand.currentBet === 0
    ? hand.bigBlind
    : (hand.street === 'preflop' && (!hand.raiseLevel || hand.raiseLevel <= 1))
    ? Math.max(hand.currentBet * 2, hand.currentBet + (hand.lastRaiseAmount || effectiveLiveBlind))
    : (hand.currentBet + Math.max(hand.lastRaiseAmount || 0, hand.bigBlind || 1));
  const isBet = hand.currentBet === 0;

  const potNow = hand.players.reduce((s, p) => s + p.totalBet, 0);
  const facingBet = hand.currentBet;
  const potRaiseTo = isBet ? potNow : (potNow - facingBet) + 3 * facingBet;
  const potChips = potRaiseTo - cp.currentBet;
  const canCoverPot = potChips > 0 && potChips <= cp.stack && othersHaveChips;
  const potAction = !othersHaveChips
    ? () => onAction('call')
    : canCoverPot
    ? () => onAction(isBet ? 'bet' : 'raise', potRaiseTo)
    : () => onAction('allin');
  const potLabel = !othersHaveChips ? `Call ${money(callAmt, cur)}` : canCoverPot ? `Pot ${money(potRaiseTo, cur)}` : `All-in ${money(maxTotalCommitment, cur)}`;
  const overLimit = isPL && amount !== '' && (parseAmount(amount) ?? 0) > potRaiseTo;

  const flSize = (hand.street === 'preflop' || hand.street === 'flop') ? (hand.smallBet || hand.bigBlind) : (hand.bigBet || hand.bigBlind * 2);
  const flRaiseTo = hand.currentBet + flSize;
  const flCap = (hand.raiseLevel || 0) >= ((hand.flMaxRaises || 4) + 1);
  const flRaiseChips = isBet ? flSize : (flRaiseTo - cp.currentBet);
  const flCanRaise = !flCap && cp.stack > toCall && cp.stack >= flRaiseChips && othersHaveChips;
  const flLabel = `Raise ${money(flRaiseTo, cur)}`;
  const callLabel = cp.stack < toCall ? `All-in ${money(cp.currentBet + callAmt, cur)}` : `Call ${money(callAmt, cur)}`;
  const canStraddle = !isFL && !isPL && hand.street === 'preflop' && hand.straddleOpen
    && (hand.straddleLevel || 0) < (hand.maxStraddles || 0) && !cp.hasActed && cp.status === 'active';
  const defaultBaseStraddle = hand.straddleAmount || (hand.bigBlind * 2);
  const straddleAmt = (hand.straddleLevel || 0) === 0
    ? defaultBaseStraddle
    : (defaultBaseStraddle * Math.pow(2, hand.straddleLevel || 0));
  const straddlePutsAllIn = cp.stack <= (straddleAmt - cp.currentBet);
  const straddleLabel = straddlePutsAllIn
    ? `All-in ${money(cp.currentBet + cp.stack, cur)}`
    : `Straddle ${money(straddleAmt, cur)}`;

  const submitRaise = () => {
    if (!othersHaveChips) {
      onAction('call');
      return;
    }
    const v = parseAmount(amount);
    if (v == null) return;
    const isAllinAmount = v === maxTotalCommitment;
    if (v < minRaise && !isAllinAmount) return;
    if (v > maxTotalCommitment) return;
    if (isPL && v > potRaiseTo) return;
    if (isAllinAmount) {
      onAction('allin');
    } else {
      onAction(isBet ? 'bet' : 'raise', v);
    }
  };
  const submitAllin = () => {
    if (!othersHaveChips && toCall > 0) {
      onAction('call');
      return;
    }
    onAction('allin');
  };
  const minRaiseVal = Math.min(minRaise, maxTotalCommitment);
  const minRaiseClamped = isPL ? Math.min(minRaiseVal, potRaiseTo) : minRaiseVal;
  const canMinRaise = canRaise && minRaiseClamped > cp.currentBet;
  const submitMinRaise = () => {
    if (!othersHaveChips) {
      onAction('call');
      return;
    }
    if (!canMinRaise) return;
    onAction(isBet ? 'bet' : 'raise', minRaiseClamped);
  };
  const minRaiseLabel = `${isBet ? 'Min bet' : 'Min raise'} ${money(minRaiseClamped, cur)}`;

  return (
    <div className="rounded-xl border border-[#2a2f37] bg-[#1e2227] p-4">
      <div className="text-xs text-slate-400 mb-1">Player to act</div>
      <div className="text-base font-semibold text-white mb-2">
        {cp.name} {hand.players.findIndex((p) => p.id === cp.id) === hand.players.findIndex((p) => p.seat === hand.buttonSeat) ? ' – BTN' : ''}
      </div>
      <div className="text-xs text-slate-400 mb-3">
        {canCheck ? 'No bet to call. Check is available.' : mustAllinToCall
          ? `Call is ${money(callAmt, cur)} – that's your whole stack. All-in or fold.`
          : `Call ${money(callAmt, cur)} to stay in.`}
      </div>
      {ootPassiveBound && (
        <div className="text-[11px] text-amber-300/90 mb-3">
          {passiveBoundThisStreet && !(ootForCurrent && ootForCurrent.kind === 'passive')
            ? `${cp.name} acted out of turn (check/call) earlier this street – only passive moves are allowed${mustAllinToCall ? ' (all-in to call permitted)' : ''}.`
            : `${cp.name} acted out of turn (check/call) – action is binding, so only a passive move is allowed${mustAllinToCall ? ' (all-in to call permitted)' : ''}.`}
        </div>
      )}
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={handleFold}
          className={`rounded-lg text-white text-sm px-3 py-2 transition-colors ${
            canCheck && muckArmed
              ? 'bg-[#c94c4c] hover:bg-[#d95959]'
              : canCheck
              ? 'bg-[#2a2f37] hover:bg-[#363c45] opacity-40'
              : 'bg-[#2a2f37] hover:bg-[#363c45]'
          }`}
        >
          {canCheck && muckArmed ? 'Confirm muck?' : 'Fold'}
        </button>
        <button
          onClick={() => onAction('check')}
          disabled={!canCheck}
          className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-white text-sm px-3 py-2 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Check
        </button>
        <button
          onClick={() => onAction('call')}
          disabled={canCheck || mustAllinToCall}
          className="rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-white text-sm px-3 py-2 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {callLabel}
        </button>
        {isFL ? (
          <button
            onClick={() => onAction(isBet ? 'bet' : 'raise', flRaiseTo)}
            disabled={!flCanRaise || mustAllinToCall || ootPassiveBound}
            className="rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm px-3 py-2 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {flLabel}{flCap ? ' (capped)' : ''}
          </button>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Chips"
                  disabled={!canRaise || mustAllinToCall || ootPassiveBound}
                  className="w-28 rounded-lg bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm disabled:opacity-30"
                />
                <button
                  onClick={submitRaise}
                  disabled={!canRaise || overLimit || mustAllinToCall || ootPassiveBound}
                  className="rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm px-3 py-2 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {isBet ? 'Bet' : 'Raise'}
                </button>
              </div>
              {isPL && overLimit && (
                <div className="text-[10px] text-rose-400">
                  {`Over pot limit – max ${money(potRaiseTo, cur)}`}
                </div>
              )}
            </div>
            <button
              onClick={submitMinRaise}
              disabled={!canMinRaise || mustAllinToCall || ootPassiveBound}
              className="rounded-lg bg-[#3a4a3a] hover:bg-[#4a5a4a] text-white text-sm px-3 py-2 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {minRaiseLabel}
            </button>
            {canStraddle && !mustAllinToCall && !ootPassiveBound && (
              <button
                onClick={() => onAction(straddlePutsAllIn ? 'allin' : 'straddle', straddleAmt)}
                className={`rounded-lg text-white text-sm px-3 py-2 cursor-pointer transition-colors ${
                  straddlePutsAllIn ? 'bg-[#c94c4c] hover:bg-[#d95959] font-bold' : 'bg-[#6b4a2a] hover:bg-[#7d5934]'
                }`}
              >
                {straddleLabel}
              </button>
            )}
            {isPL ? (
              <button
                onClick={potAction}
                disabled={!mustAllinToCall && ootPassiveBound}
                className="rounded-lg bg-[#c94c4c] hover:bg-[#d95959] text-white text-sm px-3 py-2 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {mustAllinToCall ? `All-in ${money(maxTotalCommitment, cur)}` : potLabel}
              </button>
            ) : (
              <button
                onClick={submitAllin}
                disabled={!mustAllinToCall && ootPassiveBound}
                className="rounded-lg bg-[#c94c4c] hover:bg-[#d95959] text-white text-sm px-3 py-2 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                All-in {money(maxTotalCommitment, cur)}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

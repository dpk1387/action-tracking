import React, { useState, useMemo } from 'react';
import {
  Zap,
  Clock,
  Calendar,
  AlertTriangle,
  Trash2,
  X,
  CheckCircle2,
  Layers,
  Flame,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { VARIANTS } from '@/lib/poker';
import {
  checkScheduleOverlap,
  getMatchingHandsForPlan,
  getGamePlanTitle,
} from '@/lib/tempGameScheduler';

const POPULAR_VARIANTS = [
  { id: 'nlh', label: 'Texas Hold\'em' },
  { id: 'plo', label: 'Omaha 4' },
  { id: 'plo5', label: 'Omaha 5' },
  { id: 'plo6', label: 'Omaha 6' },
  { id: 'crazy_pineapple', label: 'Crazy Pineapple' },
  { id: 'short_deck', label: 'Short Deck (6+)' },
  { id: 'pineapple', label: 'Pineapple' },
  { id: 'super_holdem', label: 'Super Hold\'em' },
  { id: 'dramaha', label: 'Dramaha' },
  { id: 'plo8', label: 'Omaha Hi/Lo (8 or Better)' },
  { id: 'seven_stud', label: '7-Card Stud' },
  { id: 'razz', label: 'Razz' },
];

export default function TemporaryGameModal({
  isOpen,
  onClose,
  currentHandNumber = 1,
  currentHand,
  existingPlans = [],
  onSavePlan,
  onDeletePlan,
  onRevertToBaseGame,
}) {
  const [tab, setTab] = useState('new'); // 'new' | 'list'

  const defaultSB = currentHand?.smallBlind ?? 1;
  const defaultBB = currentHand?.bigBlind ?? 2;
  const defaultBombAnte = currentHand?.bombAmount || (defaultBB * 5);

  // Form state
  const [variant, setVariant] = useState('plo6');
  const [gameType, setGameType] = useState('pot_limit'); // 'no_limit' | 'pot_limit' | 'fixed_limit'
  const [isBombPot, setIsBombPot] = useState(false);
  const [bombBoards, setBombBoards] = useState(2);
  const [doubleBoard, setDoubleBoard] = useState(false);
  const [smallBlind, setSmallBlind] = useState(defaultSB);
  const [bigBlind, setBigBlind] = useState(defaultBB);
  const [bombAnte, setBombAnte] = useState(defaultBombAnte);
  const [shortDeckAnte, setShortDeckAnte] = useState(currentHand?.anteAmount || (currentHand?.mode === 'cash' ? 1 : defaultBB));

  // Timing state
  const [scheduleType, setScheduleType] = useState('next_hand'); // 'this_hand' | 'next_hand' | 'interval' | 'specific_hands'
  const [durationHands, setDurationHands] = useState(1);
  const [interval, setInterval] = useState(5);
  const [startHand, setStartHand] = useState(currentHandNumber + 1);
  const [endHand, setEndHand] = useState('');
  const [specificHandsInput, setSpecificHandsInput] = useState('');

  // Draft plan
  const draftPlan = useMemo(() => {
    let specificHands = [];
    if (scheduleType === 'specific_hands') {
      specificHands = specificHandsInput
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0);
    }

    const normalizedGameType = gameType === 'pot_limit' ? 'pl' : gameType === 'fixed_limit' ? 'fl' : 'nl';
    const isSD = variant === 'short_deck';

    const plan = {
      id: `tg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      variant,
      gameType: normalizedGameType,
      isBombPot,
      bombBoards: isBombPot ? Number(bombBoards) : 1,
      doubleBoard: !isBombPot && doubleBoard,
      smallBlind: isBombPot || isSD ? 0 : (Number(smallBlind) || defaultSB),
      bigBlind: isBombPot ? 0 : isSD ? (Number(shortDeckAnte) || 1) : (Number(bigBlind) || defaultBB),
      anteAmount: isSD && !isBombPot ? (Number(shortDeckAnte) || 1) : undefined,
      bombAmount: isBombPot ? (Number(bombAnte) || defaultBombAnte) : undefined,
      scheduleType,
      handNumber: currentHandNumber,
      startHand: scheduleType === 'next_hand' ? currentHandNumber + 1 : Number(startHand) || (currentHandNumber + 1),
      durationHands: Math.max(1, Number(durationHands) || 1),
      interval: Math.max(1, Number(interval) || 5),
      endHand: endHand ? Number(endHand) : null,
      specificHands,
      createdAt: Date.now(),
    };
    plan.title = getGamePlanTitle(plan);
    return plan;
  }, [
    variant,
    gameType,
    isBombPot,
    bombBoards,
    doubleBoard,
    smallBlind,
    bigBlind,
    bombAnte,
    shortDeckAnte,
    defaultSB,
    defaultBB,
    defaultBombAnte,
    scheduleType,
    currentHandNumber,
    durationHands,
    interval,
    startHand,
    endHand,
    specificHandsInput,
  ]);

  // Compute targeted hands preview
  const previewHands = useMemo(() => {
    return getMatchingHandsForPlan(draftPlan, currentHandNumber, 100);
  }, [draftPlan, currentHandNumber]);

  // Overlap verification
  const overlapCheck = useMemo(() => {
    return checkScheduleOverlap(draftPlan, existingPlans, currentHandNumber);
  }, [draftPlan, existingPlans, currentHandNumber]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (overlapCheck.hasOverlap) return;
    onSavePlan(draftPlan);
    onClose();
  };

  // Partition plans into active/upcoming vs completed
  const { activePlans, completedPlans } = useMemo(() => {
    const active = [];
    const completed = [];
    (existingPlans || []).forEach((plan) => {
      const hands = getMatchingHandsForPlan(plan, currentHandNumber, 500);
      const maxHand = hands.length > 0 ? Math.max(...hands) : 0;
      const isFinished = plan.scheduleType === 'this_hand'
        ? currentHandNumber > (plan.handNumber || 1)
        : (plan.scheduleType === 'next_hand' || plan.scheduleType === 'specific_hands')
        ? (maxHand > 0 && maxHand < currentHandNumber)
        : (plan.endHand && Number(plan.endHand) < currentHandNumber);

      if (isFinished) {
        completed.push({ ...plan, hands, maxHand });
      } else {
        active.push({ ...plan, hands, maxHand });
      }
    });
    return { activePlans: active, completedPlans: completed };
  }, [existingPlans, currentHandNumber]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#12161f] border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/80 bg-[#161c28]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Zap size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Temporary Game Change</h2>
              <p className="text-xs text-slate-400">
                Run a temporary variant without manually switching back and forth
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 bg-[#10141c] px-4 pt-2">
          <button
            type="button"
            onClick={() => setTab('new')}
            className={`py-2 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              tab === 'new'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Schedule Temporary Game
          </button>
          <button
            type="button"
            onClick={() => setTab('list')}
            className={`py-2 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              tab === 'list'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Planned Games</span>
            {activePlans.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {activePlans.length}
              </span>
            )}
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {tab === 'new' ? (
            <>
              {/* Active Temporary Indicator Banner */}
              {isCurrentHandTemporary && (
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-600/50 flex items-center justify-between text-xs text-amber-200">
                  <div className="flex items-center gap-2">
                    <Flame size={16} className="text-amber-400 animate-pulse" />
                    <span>
                      Current Hand #{currentHandNumber} is running a temporary game ({currentHand?.temporaryGameTitle || currentHand?.variant?.toUpperCase()}).
                    </span>
                  </div>
                  {onRevertToBaseGame && (
                    <button
                      type="button"
                      onClick={() => {
                        onRevertToBaseGame();
                        onClose();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RotateCcw size={12} />
                      <span>Revert Now</span>
                    </button>
                  )}
                </div>
              )}

              {/* 1. Select Game Variant */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Select Game
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                  {POPULAR_VARIANTS.map((v) => {
                    const isSelected = variant === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setVariant(v.id);
                          // Default PLO/PLO5/PLO6 to pot limit
                          if (v.id.startsWith('plo')) setGameType('pot_limit');
                        }}
                        className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                            : 'bg-[#151922] border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div>{v.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Modifiers: Bomb Pot, Double Board, Betting Structure */}
              <div className="space-y-2 pt-1 border-t border-slate-800">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Game Modifiers
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Bomb Pot toggle */}
                  <div
                    onClick={() => setIsBombPot((v) => !v)}
                    className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                      isBombPot
                        ? 'bg-rose-950/40 border-rose-600 text-rose-200'
                        : 'bg-[#151922] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Flame size={16} className={isBombPot ? 'text-rose-400' : 'text-slate-500'} />
                      <span className="text-xs font-bold text-slate-200">Bomb Pot</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      {isBombPot ? 'Enabled' : 'Off'}
                    </span>
                  </div>

                  {/* Double Board toggle */}
                  <div
                    onClick={() => {
                      if (isBombPot) return;
                      setDoubleBoard((v) => !v);
                    }}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                      isBombPot
                        ? 'opacity-40 cursor-not-allowed bg-[#151922] border-slate-800'
                        : doubleBoard
                        ? 'bg-purple-950/40 border-purple-600 text-purple-200 cursor-pointer'
                        : 'bg-[#151922] border-slate-800 text-slate-400 hover:border-slate-700 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Layers size={16} className={doubleBoard ? 'text-purple-400' : 'text-slate-500'} />
                      <span className="text-xs font-bold text-slate-200">Double Board</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      {doubleBoard || (isBombPot && bombBoards >= 2) ? 'Enabled' : 'Off'}
                    </span>
                  </div>
                </div>

                {/* If Bomb Pot: boards selector */}
                {isBombPot && (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-slate-800 text-xs">
                    <span className="text-slate-300 font-bold">Bomb Pot Boards:</span>
                    <div className="flex gap-1.5">
                      {[1, 2, 3].map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setBombBoards(b)}
                          className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer ${
                            bombBoards === b
                              ? 'bg-rose-600 text-white'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {b} {b === 1 ? 'Board' : 'Boards'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* If Bomb Pot: ante for every player */}
                {isBombPot && (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-200 font-bold block">Ante for every player:</span>
                      <span className="text-[10px] text-slate-400">Posted by all active players preflop</span>
                    </div>
                    <input
                      type="number"
                      min="1"
                      value={bombAnte}
                      onChange={(e) => setBombAnte(Math.max(1, Number(e.target.value) || 1))}
                      className="w-24 rounded-lg bg-[#1a202c] border border-slate-700 px-2.5 py-1 text-right text-white font-mono font-bold text-xs"
                    />
                  </div>
                )}

                {/* Betting Structure */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#151922] border border-slate-800 text-xs">
                  <span className="text-slate-300 font-bold">Betting Limit:</span>
                  <div className="flex gap-1">
                    {[
                      { id: 'no_limit', label: 'No Limit' },
                      { id: 'pot_limit', label: 'Pot Limit' },
                      { id: 'fixed_limit', label: 'Fixed Limit' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setGameType(m.id)}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                          gameType === m.id
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Configure Blind / Ante Amounts */}
                {!isBombPot && (
                  variant === 'short_deck' ? (
                    <div className="p-2.5 rounded-xl bg-[#151922] border border-slate-800 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300 font-bold">Short Deck Ante:</span>
                        <span className="text-[10px] text-slate-500">Everyone pays ante, BTN pays 2x</span>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Ante Amount</label>
                        <input
                          type="number"
                          min="1"
                          value={shortDeckAnte}
                          onChange={(e) => setShortDeckAnte(Math.max(1, Number(e.target.value) || 1))}
                          className="w-full rounded-lg bg-[#1a202c] border border-slate-700 px-2.5 py-1 text-white font-mono font-bold text-xs"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-[#151922] border border-slate-800 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300 font-bold">Blind Amounts:</span>
                        <span className="text-[10px] text-slate-500">Defaults to current blinds</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Small Blind</label>
                          <input
                            type="number"
                            min="0"
                            value={smallBlind}
                            onChange={(e) => setSmallBlind(Math.max(0, Number(e.target.value) || 0))}
                            className="w-full rounded-lg bg-[#1a202c] border border-slate-700 px-2.5 py-1 text-white font-mono font-bold text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Big Blind</label>
                          <input
                            type="number"
                            min="1"
                            value={bigBlind}
                            onChange={(e) => setBigBlind(Math.max(1, Number(e.target.value) || 1))}
                            className="w-full rounded-lg bg-[#1a202c] border border-slate-700 px-2.5 py-1 text-white font-mono font-bold text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* 3. When to Run */}
              <div className="space-y-2 pt-1 border-t border-slate-800">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  When to Run Temporary Game
                </label>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setScheduleType('this_hand')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                      scheduleType === 'this_hand'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                        : 'bg-[#151922] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold">This Hand Only</div>
                    <div className="text-[11px] text-slate-400">Hand #{currentHandNumber} immediately</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScheduleType('next_hand')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                      scheduleType === 'next_hand'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                        : 'bg-[#151922] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold">Next Hand</div>
                    <div className="text-[11px] text-slate-400">Starting Hand #{currentHandNumber + 1}</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScheduleType('interval')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                      scheduleType === 'interval'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                        : 'bg-[#151922] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold">Every N Hands</div>
                    <div className="text-[11px] text-slate-400">e.g. Every 5 hands</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScheduleType('specific_hands')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                      scheduleType === 'specific_hands'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                        : 'bg-[#151922] border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold">Specific Hands</div>
                    <div className="text-[11px] text-slate-400">Exact hand numbers</div>
                  </button>
                </div>

                {/* Optional parameters depending on choice */}
                {scheduleType === 'next_hand' && (
                  <div className="p-3 rounded-xl bg-black/40 border border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-bold">Duration (hands):</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={durationHands}
                        onChange={(e) => setDurationHands(e.target.value)}
                        className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-center"
                      />
                      <span className="text-slate-400">hand(s)</span>
                    </div>
                  </div>
                )}

                {scheduleType === 'interval' && (
                  <div className="p-3 rounded-xl bg-black/40 border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 font-bold">Run Every:</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="2"
                          max="100"
                          value={interval}
                          onChange={(e) => setInterval(e.target.value)}
                          className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-center"
                        />
                        <span className="text-slate-400">hands</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Start Hand # (optional):</span>
                        <input
                          type="number"
                          min="1"
                          value={startHand}
                          onChange={(e) => setStartHand(e.target.value)}
                          className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-center"
                        />
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">End Hand # (optional):</span>
                        <input
                          type="number"
                          min="1"
                          placeholder="No end"
                          value={endHand}
                          onChange={(e) => setEndHand(e.target.value)}
                          className="w-24 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-center"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {scheduleType === 'specific_hands' && (
                  <div className="p-3 rounded-xl bg-black/40 border border-slate-800 space-y-1 text-xs">
                    <span className="text-slate-300 font-bold block">Enter Hand Numbers (comma separated):</span>
                    <input
                      type="text"
                      placeholder="e.g. 5, 10, 15, 20"
                      value={specificHandsInput}
                      onChange={(e) => setSpecificHandsInput(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold"
                    />
                  </div>
                )}
              </div>

              {/* Overlap & Conflict Validation Banner */}
              {overlapCheck.hasOverlap && (
                <div className="p-3.5 rounded-xl bg-rose-950/80 border-2 border-rose-600 text-rose-200 flex items-start gap-2.5 animate-shake">
                  <AlertTriangle size={18} className="text-rose-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <div className="font-bold text-sm text-rose-100">Schedule Conflict Detected</div>
                    <div>
                      Hand #{overlapCheck.conflictingHand} already has a scheduled game:
                      <span className="font-extrabold text-white ml-1">
                        "{overlapCheck.conflictingPlan?.title || 'Another Game'}"
                      </span>
                    </div>
                    <div className="text-[11px] text-rose-300/80 mt-1">
                      No two games can be scheduled for the same hand. Please adjust the timing or remove the existing game first.
                    </div>
                  </div>
                </div>
              )}

              {/* Preview Matching Hands */}
              {!overlapCheck.hasOverlap && previewHands.length > 0 && (
                <div className="p-2.5 rounded-xl bg-[#141a24] border border-slate-800 text-xs">
                  <span className="text-slate-400 block text-[11px] mb-1">
                    This temporary game will run on hand(s):
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                    {previewHands.slice(0, 15).map((h) => (
                      <span
                        key={h}
                        className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                          h === currentHandNumber
                            ? 'bg-amber-500 text-black'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        #{h}
                      </span>
                    ))}
                    {previewHands.length > 15 && (
                      <span className="text-slate-500 self-center text-[10px]">
                        +{previewHands.length - 15} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* TAB: List of Scheduled Games */
            <div className="space-y-4">
              {activePlans.length === 0 && completedPlans.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                  <Calendar size={28} className="text-slate-600" />
                  <div className="font-bold text-slate-300">No Temporary Games Scheduled</div>
                  <div>Use the "Schedule Temporary Game" tab to plan special games.</div>
                </div>
              ) : (
                <>
                  {/* Active & Upcoming Plans */}
                  {activePlans.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center justify-between">
                        <span>Active & Upcoming Plans ({activePlans.length})</span>
                      </div>
                      <div className="space-y-2">
                        {activePlans.map((plan) => {
                          const hands = plan.hands;
                          const isCurrentActive = hands.includes(currentHandNumber);

                          return (
                            <div
                              key={plan.id}
                              className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                                isCurrentActive
                                  ? 'bg-amber-950/30 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                                  : 'bg-[#151922] border-slate-800'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-white">{plan.title}</span>
                                  {isCurrentActive && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase bg-amber-500 text-black">
                                      Active Now
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-400">
                                  Scheduled for hand(s):{' '}
                                  <span className="font-mono text-slate-200">
                                    {hands.slice(0, 6).map((h) => `#${h}`).join(', ')}
                                    {hands.length > 6 ? ` (+${hands.length - 6} more)` : ''}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => onDeletePlan(plan.id)}
                                className="p-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 cursor-pointer transition-colors"
                                title="Delete this scheduled game"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Completed Games */}
                  {completedPlans.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                        <span>Completed Games ({completedPlans.length})</span>
                        <span className="text-[10px] text-slate-500 lowercase">Finished games</span>
                      </div>
                      <div className="space-y-2">
                        {completedPlans.map((plan) => (
                          <div
                            key={plan.id}
                            className="p-3 rounded-xl border border-slate-800/60 bg-[#12161f]/70 opacity-70 flex items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-300 line-through decoration-slate-600">{plan.title}</span>
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-400 border border-slate-700">
                                  Completed
                                </span>
                              </div>
                              <div className="text-xs text-slate-500">
                                Ran on hand(s):{' '}
                                <span className="font-mono text-slate-400">
                                  {plan.hands.slice(0, 6).map((h) => `#${h}`).join(', ')}
                                  {plan.hands.length > 6 ? ` (+${plan.hands.length - 6} more)` : ''}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => onDeletePlan(plan.id)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 border border-slate-700 cursor-pointer transition-colors"
                              title="Remove from history"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-800/80 bg-[#141822] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-bold text-xs cursor-pointer"
          >
            Cancel
          </button>

          {tab === 'new' && (
            <button
              type="button"
              disabled={overlapCheck.hasOverlap}
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs shadow-lg flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            >
              <span>Apply Temporary Game</span>
              <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

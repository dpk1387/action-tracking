import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, FolderOpen, Clock, Trash2, Award } from 'lucide-react';
import BlindScheduleEditor from '@/components/poker/BlindScheduleEditor';
import ChipDenominationPicker from '@/components/poker/ChipDenominationPicker';
import HelpHover from '@/components/HelpHover';
import SavedStructuresDialog from '@/components/poker/SavedStructuresDialog';
import { defaultScheduleFor, defaultDenomsFor, firstBreakLevelNum } from '@/lib/tournamentStructures';
import { suggestAnte, parseAmount } from '@/lib/poker';

const CASH_DEFAULT = { smallBlind: 1, bigBlind: 2, anteType: 'none', anteAmount: 0 };

function ToggleRow({ label, checked, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className="flex items-center justify-between w-full text-left py-1 disabled:opacity-40 cursor-pointer"
    >
      <span className="text-sm text-slate-300">{label}</span>
      <span className={`w-9 h-5 rounded-full p-0.5 transition-colors ${checked ? 'bg-[#4a5a4a]' : 'bg-[#2a2f37]'}`}>
        <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  );
}

export default function SetupDialog({ initial, onSave, onClose }) {
  const [mode, setMode] = useState(initial?.mode || 'tournament');
  const [variant, setVariant] = useState(!initial?.variant || initial.variant === 'holdem' ? 'nlh' : initial.variant);
  const [currency, setCurrency] = useState(initial?.currency || '$');
  const [seatCount, setSeatCount] = useState(initial?.tableSize || initial?.players?.length || 6);
  const [players, setPlayers] = useState(() => {
    const size = initial?.tableSize || initial?.players?.length || 6;
    const arr = Array.from({ length: size }, (_, i) => ({ name: '', seat: i + 1, stack: '', occupied: true }));
    if (initial?.players?.length) {
      initial.players.forEach((p) => {
        const idx = arr.findIndex((a) => a.seat === p.seat);
        if (idx >= 0) arr[idx] = { ...p, occupied: true };
      });
    }
    return arr;
  });
  const [tournamentFormat, setTournamentFormat] = useState(initial?.tournamentFormat || 'freezeout');
  const [maxReEntries, setMaxReEntries] = useState(initial?.maxReEntries ?? 1);
  const [lateRegEnabled, setLateRegEnabled] = useState(initial?.lateRegEnabled ?? true);
  const [lateRegLevel, setLateRegLevel] = useState(() => {
    if (initial?.lateRegLevel != null) return initial.lateRegLevel;
    const sched = initial?.blindSchedule?.length
      ? initial.blindSchedule
      : defaultScheduleFor(initial?.chipDenominations?.length ? Math.min(...initial.chipDenominations) : 25);
    return firstBreakLevelNum(sched);
  });
  const [rebuyPrice, setRebuyPrice] = useState(initial?.rebuyPrice ?? '');
  const [rebuyChips, setRebuyChips] = useState(initial?.rebuyChips ?? '');
  const [allowAddOn, setAllowAddOn] = useState(initial?.allowAddOn || false);
  const [addOnPrice, setAddOnPrice] = useState(initial?.addOnPrice ?? '');
  const [addOnChips, setAddOnChips] = useState(initial?.addOnChips ?? '');
  const [bulkStack, setBulkStack] = useState('');
  const [chipDenoms, setChipDenoms] = useState(() => {
    if (initial?.chipDenominations?.length) return initial.chipDenominations;
    return defaultDenomsFor(25);
  });
  const [stackInBB, setStackInBB] = useState(initial?.stackInBB || false);
  const [smallBlind, setSmallBlind] = useState(initial?.smallBlind ?? 25);
  const [bigBlind, setBigBlind] = useState(initial?.bigBlind ?? 50);
  const initBB = Number(initial?.bigBlind) || (initial?.mode === 'cash' ? 2 : 50);
  const [thirdBlind, setThirdBlind] = useState(initial?.thirdBlind ?? (initBB * 2));
  const [fourthBlind, setFourthBlind] = useState(initial?.fourthBlind ?? (initBB * 4));
  const [thirdBlindCustomized, setThirdBlindCustomized] = useState(initial?.thirdBlind != null);
  const [fourthBlindCustomized, setFourthBlindCustomized] = useState(initial?.fourthBlind != null);
  const [anteType, setAnteType] = useState(initial?.anteType || 'bba');
  const [anteAmount, setAnteAmount] = useState(initial?.anteAmount ?? 50);
  const [sbHalfAnteShortHanded, setSbHalfAnteShortHanded] = useState(initial?.sbHalfAnteShortHanded ?? true);
  const [shortHandedThreshold, setShortHandedThreshold] = useState(initial?.shortHandedThreshold ?? 5);
  const [cashBlindsTouched, setCashBlindsTouched] = useState(false);
  const [allowStraddle, setAllowStraddle] = useState(initial ? !!initial.allowStraddle : false);
  const [straddleAmount, setStraddleAmount] = useState(initial?.straddleAmount ?? '');
  const [allowMultiStraddle, setAllowMultiStraddle] = useState(initial?.allowMultiStraddle || false);
  const [mandatoryStraddle, setMandatoryStraddle] = useState(initial?.mandatoryStraddle || false);
  const [mandatoryStraddleAmount, setMandatoryStraddleAmount] = useState(initial?.mandatoryStraddleAmount ?? '');
  const [mandatoryDoubleStraddle, setMandatoryDoubleStraddle] = useState(initial?.mandatoryDoubleStraddle || false);
  const [mandatoryDoubleStraddleAmount, setMandatoryDoubleStraddleAmount] = useState(initial?.mandatoryDoubleStraddleAmount ?? '');
  const [bombPot, setBombPot] = useState(initial?.bombPot || false);
  const [bombAmount, setBombAmount] = useState(initial?.bombAmount ?? (initial?.bigBlind ? initial.bigBlind * 5 : 10));
  const [doubleBoard, setDoubleBoard] = useState(initial?.doubleBoard || false);
  const [schedule, setSchedule] = useState(() => {
    if (initial?.blindSchedule?.length) return initial.blindSchedule;
    const denoms = initial?.chipDenominations || chipDenoms;
    const lowest = [...denoms].sort((a, b) => a - b)[0];
    return defaultScheduleFor(lowest);
  });
  const [gameType, setGameType] = useState(initial?.gameType || 'nl');
  const [gameTypeTouched, setGameTypeTouched] = useState(false);
  const omahaVariants = ['plo', 'plo5', 'plo6', 'plo8'];
  const handleVariantChange = (v) => {
    setVariant(v);
    if (!gameTypeTouched) setGameType(omahaVariants.includes(v) ? 'pl' : 'nl');
  };
  const handleGameTypeChange = (gt) => { setGameType(gt); setGameTypeTouched(true); };
  const [smallBet, setSmallBet] = useState(initial?.smallBet ?? 10);
  const [bigBet, setBigBet] = useState(initial?.bigBet ?? 20);
  const [flMaxRaises, setFlMaxRaises] = useState(initial?.flMaxRaises ?? 4);
  const [error, setError] = useState('');
  const [showStructures, setShowStructures] = useState(false);

  // Tournament Bounties (tournament mode only)
  const [tournamentBounty, setTournamentBounty] = useState(initial?.bountyConfig?.bounty ?? initial?.sideGames?.bounty ?? false);
  const [bountyAmount, setBountyAmount] = useState(initial?.bountyConfig?.bountyAmount ?? initial?.sideGames?.bountyAmount ?? 50);
  const [mysteryBounty, setMysteryBounty] = useState(initial?.bountyConfig?.mysteryBounty ?? initial?.sideGames?.mysteryBounty ?? false);

  // Clock system configuration
  const [clockSystem, setClockSystem] = useState(initial?.clockConfig?.clockSystem || 'call_clock');
  const [callClockSeconds, setCallClockSeconds] = useState(initial?.clockConfig?.callClockSeconds ?? 60);
  const [timeBankMode, setTimeBankMode] = useState(initial?.clockConfig?.timeBankMode || 'split'); // 'single' | 'split'
  const [singleSeconds, setSingleSeconds] = useState(initial?.clockConfig?.singleSeconds ?? 30);
  const [preflopSeconds, setPreflopSeconds] = useState(initial?.clockConfig?.preflopSeconds ?? 20);
  const [postflopSplitStreet, setPostflopSplitStreet] = useState(initial?.clockConfig?.postflopSplitStreet || false);
  const [postflopSeconds, setPostflopSeconds] = useState(initial?.clockConfig?.postflopSeconds ?? 40);
  const [flopSeconds, setFlopSeconds] = useState(initial?.clockConfig?.flopSeconds ?? 40);
  const [turnSeconds, setTurnSeconds] = useState(initial?.clockConfig?.turnSeconds ?? 40);
  const [riverSeconds, setRiverSeconds] = useState(initial?.clockConfig?.riverSeconds ?? 40);
  const [initialTimeBanks, setInitialTimeBanks] = useState(initial?.clockConfig?.initialTimeBanks ?? 3);
  const [timeBankAddSeconds, setTimeBankAddSeconds] = useState(initial?.clockConfig?.timeBankAddSeconds ?? 30);
  const [addOnRules, setAddOnRules] = useState(() => {
    if (Array.isArray(initial?.clockConfig?.addOnRules)) return initial.clockConfig.addOnRules;
    return [];
  });
  const [levelMethod, setLevelMethod] = useState(initial?.levelConfig?.method || 'minutes');
  const [levelValue, setLevelValue] = useState(initial?.levelConfig?.value ?? 15);
  const LEVEL_PRESETS = { minutes: 15, hands: 15, orbits: 2 };
  const handleLevelMethodChange = (m) => {
    setLevelMethod(m);
    setLevelValue(LEVEL_PRESETS[m]);
  };

  const buildStructureData = () => ({
    mode, variant, gameType, currency, stackInBB, seatCount,
    smallBlind, bigBlind, thirdBlind, fourthBlind, anteType, anteAmount,
    sbHalfAnteShortHanded, shortHandedThreshold,
    smallBet, bigBet, flMaxRaises,
    doubleBoard, allowStraddle, allowMultiStraddle, mandatoryStraddle,
    bombPot, bombAmount,
    levelMethod, levelValue,
    chipDenoms,
    tournamentFormat, maxReEntries, lateRegEnabled, lateRegLevel,
    rebuyPrice, rebuyChips, allowAddOn, addOnPrice, addOnChips,
    schedule,
    bountyConfig: {
      bounty: !isCash && tournamentBounty,
      bountyAmount: !isCash && tournamentBounty ? (Number(bountyAmount) || 0) : 0,
      mysteryBounty: !isCash && mysteryBounty,
    },
    sideGames: {
      ...(initial?.sideGames || {}),
      bounty: !isCash && tournamentBounty,
      bountyAmount: !isCash && tournamentBounty ? (Number(bountyAmount) || 0) : 0,
      mysteryBounty: !isCash && mysteryBounty,
    },
    clockConfig: {
      clockSystem,
      callClockSeconds: Number(callClockSeconds) || 60,
      timeBankMode,
      singleSeconds: Number(singleSeconds) || 30,
      preflopSeconds: Number(preflopSeconds) || 20,
      postflopSplitStreet: !!postflopSplitStreet,
      postflopSeconds: Number(postflopSeconds) || 40,
      flopSeconds: Number(flopSeconds) || 40,
      turnSeconds: Number(turnSeconds) || 40,
      riverSeconds: Number(riverSeconds) || 40,
      initialTimeBanks: Math.max(0, Number(initialTimeBanks) || 0),
      timeBankAddSeconds: Number(timeBankAddSeconds) || 30,
      addOnRules,
    },
  });

  const applyStructure = (d) => {
    if (!d) return;
    if (d.mode) setMode(d.mode);
    if (d.variant) setVariant(d.variant);
    if (d.gameType) { setGameType(d.gameType); setGameTypeTouched(true); }
    if (d.currency != null) setCurrency(d.currency);
    if (d.stackInBB != null) setStackInBB(d.stackInBB);
    if (d.seatCount != null) {
      const count = Math.min(10, Math.max(2, Number(d.seatCount) || 6));
      setSeatCount(count);
      setPlayers((prev) => {
        const arr = [...prev];
        while (arr.length < count) arr.push({ name: '', seat: arr.length + 1, stack: '', occupied: true });
        arr.length = count;
        return arr.map((p, i) => ({ ...p, seat: i + 1 }));
      });
    }
    if (d.smallBlind != null) setSmallBlind(d.smallBlind);
    if (d.bigBlind != null) { setBigBlind(d.bigBlind); setCashBlindsTouched(true); }
    if (d.thirdBlind != null) setThirdBlind(d.thirdBlind);
    if (d.fourthBlind != null) setFourthBlind(d.fourthBlind);
    if (d.anteType != null) setAnteType(d.anteType);
    if (d.anteAmount != null) setAnteAmount(d.anteAmount);
    if (d.sbHalfAnteShortHanded != null) setSbHalfAnteShortHanded(d.sbHalfAnteShortHanded);
    if (d.shortHandedThreshold != null) setShortHandedThreshold(d.shortHandedThreshold);
    if (d.smallBet != null) setSmallBet(d.smallBet);
    if (d.bigBet != null) setBigBet(d.bigBet);
    if (d.flMaxRaises != null) setFlMaxRaises(d.flMaxRaises);
    if (d.doubleBoard != null) setDoubleBoard(d.doubleBoard);
    if (d.allowStraddle != null) setAllowStraddle(d.allowStraddle);
    if (d.straddleAmount != null) setStraddleAmount(d.straddleAmount);
    if (d.allowMultiStraddle != null) setAllowMultiStraddle(d.allowMultiStraddle);
    if (d.mandatoryStraddle != null) setMandatoryStraddle(d.mandatoryStraddle);
    if (d.mandatoryStraddleAmount != null) setMandatoryStraddleAmount(d.mandatoryStraddleAmount);
    if (d.mandatoryDoubleStraddle != null) setMandatoryDoubleStraddle(d.mandatoryDoubleStraddle);
    if (d.mandatoryDoubleStraddleAmount != null) setMandatoryDoubleStraddleAmount(d.mandatoryDoubleStraddleAmount);
    if (d.bombPot != null) setBombPot(d.bombPot);
    if (d.bombAmount != null) setBombAmount(d.bombAmount);
    if (d.levelMethod != null) setLevelMethod(d.levelMethod);
    if (d.levelValue != null) setLevelValue(d.levelValue);
    if (Array.isArray(d.chipDenoms)) setChipDenoms(d.chipDenoms);
    if (d.tournamentFormat != null) setTournamentFormat(d.tournamentFormat);
    if (d.maxReEntries != null) setMaxReEntries(d.maxReEntries);
    if (d.lateRegEnabled != null) setLateRegEnabled(d.lateRegEnabled);
    if (d.lateRegLevel != null) setLateRegLevel(d.lateRegLevel);
    if (d.rebuyPrice != null) setRebuyPrice(d.rebuyPrice);
    if (d.rebuyChips != null) setRebuyChips(d.rebuyChips);
    if (d.allowAddOn != null) setAllowAddOn(d.allowAddOn);
    if (d.addOnPrice != null) setAddOnPrice(d.addOnPrice);
    if (d.addOnChips != null) setAddOnChips(d.addOnChips);
    if (Array.isArray(d.schedule)) setSchedule(d.schedule);
    if (d.bountyConfig) {
      if (d.bountyConfig.bounty != null) setTournamentBounty(d.bountyConfig.bounty);
      if (d.bountyConfig.bountyAmount != null) setBountyAmount(d.bountyConfig.bountyAmount);
      if (d.bountyConfig.mysteryBounty != null) setMysteryBounty(d.bountyConfig.mysteryBounty);
    } else if (d.sideGames) {
      if (d.sideGames.bounty != null) setTournamentBounty(d.sideGames.bounty);
      if (d.sideGames.bountyAmount != null) setBountyAmount(d.sideGames.bountyAmount);
      if (d.sideGames.mysteryBounty != null) setMysteryBounty(d.sideGames.mysteryBounty);
    }
    if (d.clockConfig) {
      if (d.clockConfig.clockSystem) setClockSystem(d.clockConfig.clockSystem);
      if (d.clockConfig.callClockSeconds != null) setCallClockSeconds(d.clockConfig.callClockSeconds);
      if (d.clockConfig.timeBankMode) setTimeBankMode(d.clockConfig.timeBankMode);
      if (d.clockConfig.singleSeconds != null) setSingleSeconds(d.clockConfig.singleSeconds);
      if (d.clockConfig.preflopSeconds != null) setPreflopSeconds(d.clockConfig.preflopSeconds);
      if (d.clockConfig.postflopSplitStreet != null) setPostflopSplitStreet(d.clockConfig.postflopSplitStreet);
      if (d.clockConfig.postflopSeconds != null) setPostflopSeconds(d.clockConfig.postflopSeconds);
      if (d.clockConfig.flopSeconds != null) setFlopSeconds(d.clockConfig.flopSeconds);
      if (d.clockConfig.turnSeconds != null) setTurnSeconds(d.clockConfig.turnSeconds);
      if (d.clockConfig.riverSeconds != null) setRiverSeconds(d.clockConfig.riverSeconds);
      if (d.clockConfig.initialTimeBanks != null) setInitialTimeBanks(d.clockConfig.initialTimeBanks);
      if (d.clockConfig.timeBankAddSeconds != null) setTimeBankAddSeconds(d.clockConfig.timeBankAddSeconds);
      if (Array.isArray(d.clockConfig.addOnRules)) setAddOnRules(d.clockConfig.addOnRules);
    }
    setError('');
  };

  const isCash = mode === 'cash';
  const isBBA = anteType === 'bba';
  const isBtnAnte = anteType === 'btn_ante';
  const isSBHalfAnte = anteType === 'sb_half_ante';
  const isThreeBlinds = isCash && anteType === 'three_blinds';
  const sym = isCash ? currency || '$' : '';
  const stackUnit = !isCash && stackInBB ? 'bb' : sym;
  const isLow = variant === 'ace_to_five' || variant === 'deuce_to_seven';
  const effBB = isCash ? Number(bigBlind || 0) : Number(schedule[0]?.bigBlind || bigBlind || 0);
  const bb = effBB || (isCash ? 2 : 50);
  const smallestChip = !isCash && chipDenoms.length ? Math.min(...chipDenoms.map(Number).filter((d) => d > 0)) : effBB;

  useEffect(() => {
    if (isBBA || isBtnAnte) setAnteAmount(Number(bigBlind));
    else if (isSBHalfAnte) setAnteAmount(Math.max(1, Math.round(Number(bigBlind) * 0.5)));
  }, [isBBA, isBtnAnte, isSBHalfAnte, bigBlind]);

  const handleModeChange = (newMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    if (newMode === 'cash') {
      if (!cashBlindsTouched) {
        setSmallBlind(CASH_DEFAULT.smallBlind);
        setBigBlind(CASH_DEFAULT.bigBlind);
        setThirdBlind(CASH_DEFAULT.bigBlind * 2);
        setFourthBlind(CASH_DEFAULT.bigBlind * 4);
        setAnteType(CASH_DEFAULT.anteType);
        setAnteAmount(CASH_DEFAULT.anteAmount);
      }
      setAllowStraddle(true);
    } else {
      setAnteType('bba');
      setAnteAmount(Number(schedule[0]?.bigBlind) || 50);
    }
  };

  const applyBulk = () => {
    const v = parseAmount(bulkStack);
    if (!v || v <= 0) return;
    setPlayers((prev) => prev.map((p) => ({ ...p, stack: bulkStack })));
  };

  const adjustSeats = (delta) => {
    const next = Math.min(10, Math.max(2, seatCount + delta));
    setSeatCount(next);
    setPlayers((prev) => {
      const arr = [...prev];
      while (arr.length < next) arr.push({ name: '', seat: arr.length + 1, stack: '', occupied: true });
      arr.length = next;
      return arr.map((p, i) => ({ ...p, seat: i + 1 }));
    });
  };

  const removePlayer = (i) => {
    if (players.length <= 2) return;
    setPlayers((prev) => {
      const next = prev.filter((_, idx) => idx !== i).map((p, idx) => ({ ...p, seat: idx + 1 }));
      setSeatCount(next.length);
      return next;
    });
  };

  const toggleSeatOccupied = (i) => {
    setPlayers((prev) => prev.map((p, idx) => idx === i ? { ...p, occupied: !p.occupied } : p));
  };

  const updatePlayer = (i, field, value) => setPlayers((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));

  const save = () => {
    const isFL = gameType === 'fl';
    const useScheduleBlinds = !isCash && !isFL;
    const schedFirst = schedule[0] || { smallBlind: 25, bigBlind: 50, ante: 0 };
    if (isFL) {
      if ((parseAmount(smallBet) ?? Number(smallBet)) <= 0) return setError('Small bet must be positive.');
      if ((parseAmount(bigBet) ?? Number(bigBet)) <= 0) return setError('Big bet must be positive.');
      if (Number(flMaxRaises) < 1) return setError('Max raises must be at least 1.');
    } else {
      if (useScheduleBlinds) {
        if ((parseAmount(schedFirst.bigBlind) ?? Number(schedFirst.bigBlind)) <= 0 || (parseAmount(schedFirst.smallBlind) ?? Number(schedFirst.smallBlind)) <= 0) return setError('Level 1 blinds must be positive.');
      } else {
        if ((parseAmount(bigBlind) ?? Number(bigBlind)) <= 0 || (parseAmount(smallBlind) ?? Number(smallBlind)) <= 0) return setError('Blinds must be positive.');
      }
    }
    if (anteType === 'three_blinds' || anteType === 'four_blinds') {
      const tbVal = parseAmount(thirdBlind) ?? Number(thirdBlind);
      if (tbVal <= 0) return setError('Third blind must be positive.');
    }
    if (anteType === 'four_blinds') {
      const fbVal = parseAmount(fourthBlind) ?? Number(fourthBlind);
      if (fbVal <= 0) return setError('Fourth blind must be positive.');
    }
    if (isCash && anteType === 'traditional' && anteAmount !== '' && (parseAmount(anteAmount) ?? Number(anteAmount)) < 0) return setError('Ante cannot be negative.');
    if (!isCash) {
      for (const l of schedule) {
        if (l.type !== 'break' && ((parseAmount(l.smallBlind) ?? Number(l.smallBlind)) <= 0 || (parseAmount(l.bigBlind) ?? Number(l.bigBlind)) <= 0)) return setError('Every blind level must be positive.');
      }
    }
    const occupiedPlayers = isCash
      ? players.map((p, idx) => ({ ...p, seat: idx + 1, occupied: true }))
      : players.filter((p) => p.occupied);
    if (occupiedPlayers.length < 2) return setError('At least 2 active players are required.');
    const sb = isFL ? Math.max(1, Math.round((parseAmount(smallBet) ?? Number(smallBet)) / 2)) : useScheduleBlinds ? (parseAmount(schedFirst.smallBlind) ?? Number(schedFirst.smallBlind)) : (parseAmount(smallBlind) ?? Number(smallBlind));
    const bb = isFL ? (parseAmount(smallBet) ?? Number(smallBet)) : useScheduleBlinds ? (parseAmount(schedFirst.bigBlind) ?? Number(schedFirst.bigBlind)) : (parseAmount(bigBlind) ?? Number(bigBlind));
    const toChips = (val) => {
      let s = parseAmount(val);
      if (s == null) s = Number(val);
      const blank = s == null || isNaN(s) || s <= 0;
      if (!isCash && stackInBB) return (blank ? 100 : s) * bb;
      return blank ? 100 * bb : s;
    };
    const startingStack = toChips(occupiedPlayers[0].stack);
    onSave({
      mode,
      variant,
      gameType,
      currency: sym,
      stackInBB: !isCash && stackInBB,
      tableSize: isCash ? occupiedPlayers.length : seatCount,
      players: occupiedPlayers.map((p) => ({ ...p, name: (p.name || '').trim() || `Player ${p.seat}`, stack: toChips(p.stack) })),
      smallBlind: sb,
      bigBlind: bb,
      thirdBlind: (anteType === 'three_blinds' || anteType === 'four_blinds') ? (parseAmount(thirdBlind) ?? Number(thirdBlind) ?? (bb * 2)) : undefined,
      fourthBlind: anteType === 'four_blinds' ? (parseAmount(fourthBlind) ?? Number(fourthBlind) ?? (bb * 4)) : undefined,
      smallBet: isFL ? (parseAmount(smallBet) ?? Number(smallBet)) : undefined,
      bigBet: isFL ? (parseAmount(bigBet) ?? Number(bigBet)) : undefined,
      flMaxRaises: isFL ? Number(flMaxRaises) : undefined,
      anteType,
      sbHalfAnteShortHanded: anteType === 'bba' ? sbHalfAnteShortHanded : false,
      shortHandedThreshold: Number(shortHandedThreshold) || 5,
      anteAmount: (anteType === 'bba' || anteType === 'btn_ante')
        ? bb
        : anteType === 'sb_half_ante'
        ? Math.max(1, Math.round(bb * 0.5))
        : isCash
        ? (anteType === 'traditional' ? (parseAmount(anteAmount) ?? Number(anteAmount)) : 0)
        : anteType === 'traditional'
        ? (parseAmount(schedFirst.ante) ?? Number(schedFirst.ante))
        : 0,
      doubleBoard: !isLow && doubleBoard,
      allowStraddle: isCash && !isFL && allowStraddle,
      straddleAmount: isCash && !isFL && allowStraddle && straddleAmount ? Number(straddleAmount) : (bb * 2),
      allowMultiStraddle: isCash && !isFL && allowMultiStraddle,
      mandatoryStraddle: false,
      mandatoryStraddleAmount: undefined,
      mandatoryDoubleStraddle: false,
      mandatoryDoubleStraddleAmount: undefined,
      bombPot: isCash && bombPot,
      bombAmount: isCash ? (parseAmount(bombAmount) ?? Number(bombAmount)) || (bb * 5) : 0,
      levelConfig: isCash ? null : { method: levelMethod, value: Number(levelValue) > 0 ? Number(levelValue) : LEVEL_PRESETS[levelMethod] },
      chipDenominations: isCash ? null : chipDenoms.filter((d) => Number(d) > 0).map((d) => Number(d)).sort((a, b) => a - b),
      tournamentFormat: isCash ? undefined : tournamentFormat,
      maxReEntries: isCash ? undefined : (tournamentFormat === 'reentry' ? Number(maxReEntries) : 0),
      lateRegEnabled: isCash ? undefined : lateRegEnabled,
      lateRegLevel: isCash ? undefined : Number(lateRegLevel),
      startingStack: isCash ? undefined : startingStack,
      rebuyPrice: isCash || tournamentFormat !== 'rebuy' ? undefined : (rebuyPrice ? (parseAmount(rebuyPrice) ?? Number(rebuyPrice)) : undefined),
      rebuyChips: isCash || tournamentFormat !== 'rebuy' ? undefined : (rebuyChips ? (parseAmount(rebuyChips) ?? Number(rebuyChips)) : startingStack),
      allowAddOn: isCash || tournamentFormat !== 'rebuy' ? undefined : allowAddOn,
      addOnPrice: isCash || tournamentFormat !== 'rebuy' || !allowAddOn ? undefined : (addOnPrice ? (parseAmount(addOnPrice) ?? Number(addOnPrice)) : undefined),
      addOnChips: isCash || tournamentFormat !== 'rebuy' || !allowAddOn ? undefined : (addOnChips ? (parseAmount(addOnChips) ?? Number(addOnChips)) : Math.round(startingStack * 1.5)),
      blindSchedule: isCash ? [] : schedule.map((l) => {
        if (l.type === 'break') {
          return {
            type: 'break',
            minutes: Number(l.minutes) > 0 ? Number(l.minutes) : 10,
            race: l.race && (parseAmount(l.race.retired) ?? Number(l.race.retired)) > 0 && (parseAmount(l.race.replacement) ?? Number(l.race.replacement)) > 0
              ? { retired: parseAmount(l.race.retired) ?? Number(l.race.retired), replacement: parseAmount(l.race.replacement) ?? Number(l.race.replacement) }
              : null,
          };
        }
        return {
          type: 'level',
          smallBlind: parseAmount(l.smallBlind) ?? Number(l.smallBlind),
          bigBlind: parseAmount(l.bigBlind) ?? Number(l.bigBlind),
          ante: isBBA ? (parseAmount(l.bigBlind) ?? Number(l.bigBlind)) : anteType === 'none' ? 0 : anteType === 'traditional' ? (l.ante != null && l.ante !== '' ? (parseAmount(l.ante) ?? Number(l.ante)) : suggestAnte(l.bigBlind)) : (parseAmount(l.ante) ?? Number(l.ante || 0)),
          minutes: l.minutes === '' || l.minutes == null ? '' : (Number(l.minutes) > 0 ? Number(l.minutes) : ''),
        };
      }),
      bountyConfig: {
        bounty: !isCash && tournamentBounty,
        bountyAmount: !isCash && tournamentBounty ? (Number(bountyAmount) || 0) : 0,
        mysteryBounty: !isCash && mysteryBounty,
      },
      sideGames: {
        ...(initial?.sideGames || {}),
        bounty: !isCash && tournamentBounty,
        bountyAmount: !isCash && tournamentBounty ? (Number(bountyAmount) || 0) : 0,
        mysteryBounty: !isCash && mysteryBounty,
      },
      clockConfig: {
        clockSystem,
        callClockSeconds: Number(callClockSeconds) || 60,
        timeBankMode,
        singleSeconds: Number(singleSeconds) || 30,
        preflopSeconds: Number(preflopSeconds) || 20,
        postflopSplitStreet: !!postflopSplitStreet,
        postflopSeconds: Number(postflopSeconds) || 40,
        flopSeconds: Number(flopSeconds) || 40,
        turnSeconds: Number(turnSeconds) || 40,
        riverSeconds: Number(riverSeconds) || 40,
        initialTimeBanks: Math.max(0, Number(initialTimeBanks) || 0),
        timeBankAddSeconds: Number(timeBankAddSeconds) || 30,
        addOnRules: addOnRules.map((r) => ({
          id: r.id || String(Math.random()),
          triggerType: r.triggerType || 'level',
          triggerValue: Number(r.triggerValue) || 1,
          chips: Number(r.chips) || 1,
        })),
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#2a2f37] bg-[#1e2227] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-white">Structure setup</h2>
            <HelpHover sections={[
              { title: 'Tournament vs Cash', body: 'Tournament: blinds rise on a schedule (set below), players are eliminated when they bust, and one player ends up with all the chips. Cash: blinds stay fixed, players can rebuy or cash out any time.' },
              { title: 'Game type', body: 'No Limit – bet or raise any amount up to your stack. Pot Limit – max raise is the size of the pot. Fixed Limit – bets are fixed sizes (small bet before the river, big bet after); set max raises per street.' },
              { title: 'Players & stacks', body: 'Add 2–10 players. "Set all stacks" applies one starting amount to everyone. Tournament stacks default to 200 × the smallest chip; cash defaults to 100 × the big blind.' },
              { title: 'Chip denominations', body: 'Tournament only. Bets and raises must be makeable with these chips. The blind schedule auto-generates from the lowest chip.' },
              { title: 'Blind schedule', body: 'Each level has its own blinds and optional ante. Add timed breaks between levels. A break can include a chip race.' },
              { title: 'Ante', body: 'No ante – no forced bet beyond the blinds. Traditional – every player posts a set ante each hand. Big blind ante (BBA) – the big blind posts an extra bet equal to the BB for the whole table.' },
              { title: 'Level timing', body: 'Minutes – levels and breaks advance on a countdown. Hands – a level lasts N completed hands. Orbits – a level lasts N button orbits.' },
            ]} />
          </div>
          <button onClick={() => setShowStructures(true)} className="flex items-center gap-1.5 rounded-md bg-[#2a2f37] hover:bg-[#363c45] text-slate-300 text-sm px-3 py-1.5 cursor-pointer">
            <FolderOpen size={15} /> Saved structures
          </button>
          {onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X size={20} /></button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 mb-5">
          <div className="flex rounded-lg border border-[#2a2f37] overflow-hidden">
            <button onClick={() => handleModeChange('tournament')} className={`px-4 py-2 text-sm cursor-pointer ${mode === 'tournament' ? 'bg-[#4a5a4a] text-white' : 'bg-[#15181d] text-slate-300'}`}>Tournament</button>
            <button onClick={() => handleModeChange('cash')} className={`px-4 py-2 text-sm cursor-pointer ${mode === 'cash' ? 'bg-[#4a5a4a] text-white' : 'bg-[#15181d] text-slate-300'}`}>Cash</button>
          </div>
          <select value={gameType} onChange={(e) => handleGameTypeChange(e.target.value)} className="rounded-lg border border-[#2a2f37] bg-[#15181d] px-3 py-2 text-sm text-white">
            <option value="nl">No Limit</option>
            <option value="pl">Pot Limit</option>
            <option value="fl">Fixed Limit</option>
          </select>
          <select value={variant} onChange={(e) => handleVariantChange(e.target.value)} className="rounded-lg border border-[#2a2f37] bg-[#15181d] px-3 py-2 text-sm text-white">
            <option value="nlh">Hold'em</option>
            <option value="plo">Omaha</option>
            <option value="short_deck">Short Deck</option>
            <option value="pineapple">Pineapple</option>
            <option value="lazy_pineapple">Lazy Pineapple</option>
            <option value="crazy_pineapple">Crazy Pineapple</option>
            <option value="super_holdem">Super Hold'em</option>
            <option value="plo5">Omaha 5</option>
            <option value="plo6">Omaha 6</option>
            <option value="plo8">Omaha Hi/Lo</option>
            <option value="ace_to_five">A-5 Lowball</option>
            <option value="deuce_to_seven">2-7 Lowball</option>
          </select>
          {isCash && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Currency</span>
              <input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="$" className="w-16 rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
            </div>
          )}
          {!isLow && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={doubleBoard} onChange={(e) => setDoubleBoard(e.target.checked)} className="w-4 h-4 accent-[#4a5a4a]" />
              <span className="text-sm text-slate-300">Double board</span>
            </label>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">{isCash ? 'Players' : 'Seats'}</span>
            <button onClick={() => adjustSeats(-1)} className="rounded-md bg-[#2a2f37] p-1.5 text-white hover:bg-[#363c45] cursor-pointer"><Minus size={16} /></button>
            <span className="w-8 text-center text-white font-medium">{seatCount}</span>
            <button onClick={() => adjustSeats(1)} className="rounded-md bg-[#2a2f37] p-1.5 text-white hover:bg-[#363c45] cursor-pointer"><Plus size={16} /></button>
            <span className="text-[11px] text-slate-500">{isCash ? 'active players at table' : 'table size – empty seats stay open'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Set all stacks</span>
            {stackUnit && <span className="text-xs text-slate-400">{stackUnit}</span>}
            <input type="text" inputMode="decimal" value={bulkStack} onChange={(e) => setBulkStack(e.target.value)} placeholder={!isCash && stackInBB ? '100' : String(isCash ? 200 : 200 * smallestChip)} className="w-28 rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm text-left" />
            <button onClick={applyBulk} className="rounded-md bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm px-3 py-2 cursor-pointer">Apply to all</button>
          </div>
          {!isCash && (
            <div className="ml-auto">
              <ToggleRow label="Enter stacks in BB" checked={stackInBB} onChange={setStackInBB} />
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {players.map((p, i) => (
            <div key={i} className={`rounded-lg border p-3 ${isCash || p.occupied ? 'border-[#2a2f37] bg-[#15181d]' : 'border-dashed border-[#2a2f37] bg-[#121417] opacity-50'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-slate-400 font-medium">{isCash ? `Player ${i + 1}` : `Seat ${p.seat}`}</div>
                {!isCash ? (
                  <button type="button" onClick={() => toggleSeatOccupied(i)} className={`text-[10px] px-2 py-0.5 rounded cursor-pointer ${p.occupied ? 'bg-[#4a5a4a] text-white' : 'bg-[#2a2f37] text-slate-400'}`}>
                    {p.occupied ? 'Occupied' : 'Empty'}
                  </button>
                ) : (
                  players.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removePlayer(i)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded cursor-pointer transition-colors"
                      title="Remove player"
                    >
                      <Trash2 size={13} />
                    </button>
                  )
                )}
              </div>
              {(isCash || p.occupied) && (
                <>
                  <input
                    value={p.name}
                    onChange={(e) => updatePlayer(i, 'name', e.target.value)}
                    placeholder={`Player ${p.seat || (i + 1)}`}
                    className="w-full rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm mb-2 focus:outline-none focus:border-[#4a5a4a] placeholder:text-slate-500"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Stack</span>
                    {stackUnit && <span className="text-xs text-slate-400">{stackUnit}</span>}
                    <input
                      type="text"
                      inputMode="decimal"
                      value={p.stack}
                      onChange={(e) => updatePlayer(i, 'stack', e.target.value)}
                      placeholder={String(!isCash && stackInBB ? 100 : (isCash ? 100 * effBB : 200 * smallestChip))}
                      className="flex-1 rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm focus:outline-none focus:border-[#4a5a4a] placeholder:text-slate-500"
                    />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        {isCash && players.length < 10 && (
          <div className="mb-5">
            <button
              type="button"
              onClick={() => adjustSeats(1)}
              className="px-3.5 py-2 rounded-lg border border-dashed border-[#2a2f37] hover:border-emerald-500/50 bg-[#15181d] hover:bg-[#1a2027] text-xs font-semibold text-emerald-400 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Plus size={14} /> Add Player ({players.length + 1} of 10)
            </button>
          </div>
        )}
        {!isCash && gameType !== 'fl' && (
          <div className="text-xs text-slate-500 mb-3">Blinds come from level 1 of the schedule below.</div>
        )}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          {(isCash || gameType === 'fl') && (
            <>
              <div className="flex-1 min-w-[120px]">
                <label className="text-xs text-slate-400 block mb-1">{gameType === 'fl' ? 'Small bet' : 'Small blind'}</label>
                <input type="text" inputMode="decimal" value={gameType === 'fl' ? smallBet : smallBlind} onChange={(e) => { if (gameType === 'fl') setSmallBet(e.target.value); else { setSmallBlind(e.target.value); setCashBlindsTouched(true); } }} className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="text-xs text-slate-400 block mb-1">{gameType === 'fl' ? 'Big bet' : 'Big blind'}</label>
                <input type="text" inputMode="decimal" value={gameType === 'fl' ? bigBet : bigBlind} onChange={(e) => {
                  const v = e.target.value;
                  if (gameType === 'fl') {
                    setBigBet(v);
                  } else {
                    setBigBlind(v);
                    setCashBlindsTouched(true);
                    const parsedBB = parseAmount(v) ?? Number(v);
                    if (parsedBB && parsedBB > 0) {
                      if (!thirdBlindCustomized) setThirdBlind(parsedBB * 2);
                      if (!fourthBlindCustomized) setFourthBlind(parsedBB * 4);
                    }
                    if (anteType === 'traditional') setAnteAmount(suggestAnte(v));
                  }
                }} className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
              </div>
              {(anteType === 'three_blinds' || anteType === 'four_blinds') && (
                <div className="flex-1 min-w-[120px]">
                  <label className="text-xs text-amber-300 font-semibold block mb-1">Third blind</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={thirdBlind}
                    onChange={(e) => {
                      setThirdBlind(e.target.value);
                      setThirdBlindCustomized(true);
                    }}
                    placeholder={String((parseAmount(bigBlind) ?? Number(bigBlind) ?? 2) * 2)}
                    className="w-full rounded-md bg-[#15181d] border border-amber-500/40 px-3 py-2 text-white text-sm focus:border-amber-400"
                  />
                </div>
              )}
              {anteType === 'four_blinds' && (
                <div className="flex-1 min-w-[120px]">
                  <label className="text-xs text-amber-300 font-semibold block mb-1">Fourth blind</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={fourthBlind}
                    onChange={(e) => {
                      setFourthBlind(e.target.value);
                      setFourthBlindCustomized(true);
                    }}
                    placeholder={String((parseAmount(bigBlind) ?? Number(bigBlind) ?? 2) * 4)}
                    className="w-full rounded-md bg-[#15181d] border border-amber-500/40 px-3 py-2 text-white text-sm focus:border-amber-400"
                  />
                </div>
              )}
            </>
          )}
          <div className="min-w-[160px] flex-1">
            <label className="text-xs text-slate-400 block mb-1">Ante / Blind Structure</label>
            <select
              value={anteType}
              onChange={(e) => {
                const t = e.target.value;
                setAnteType(t);
                const bbVal = parseAmount(bigBlind) ?? Number(bigBlind) ?? 2;
                if (t === 'three_blinds') {
                  if (!thirdBlindCustomized || Number(thirdBlind) === 5 || Number(thirdBlind) === 0) {
                    setThirdBlind(bbVal * 2);
                  }
                } else if (t === 'four_blinds') {
                  if (!thirdBlindCustomized || Number(thirdBlind) === 5 || Number(thirdBlind) === 0) {
                    setThirdBlind(bbVal * 2);
                  }
                  if (!fourthBlindCustomized || Number(fourthBlind) === 10 || Number(fourthBlind) === 0) {
                    setFourthBlind(bbVal * 4);
                  }
                }
                if (t === 'traditional') setAnteAmount(suggestAnte(bigBlind));
                else if (t === 'bba' || t === 'btn_ante') setAnteAmount(Number(bigBlind));
                else if (t === 'sb_half_ante') setAnteAmount(Math.max(1, Math.round(Number(bigBlind) * 0.5)));
                else setAnteAmount(0);
              }}
              className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm"
            >
              <option value="none">No ante</option>
              <option value="traditional">Traditional ante</option>
              <option value="bba">Big blind ante (BBA)</option>
              <option value="sb_half_ante">Small blind half ante (SB 0.5 BB)</option>
              <option value="btn_ante">Button ante (BTN 1 BB)</option>
              <option value="three_blinds">3 blinds</option>
              <option value="four_blinds">4 blinds</option>
            </select>
          </div>
          {isCash && anteType !== 'three_blinds' && anteType !== 'four_blinds' && (
            <div className="flex-1 min-w-[120px]">
              <label className="text-xs text-slate-400 block mb-1">Ante amount</label>
              <input
                type="text"
                inputMode="decimal"
                value={anteAmount}
                disabled={anteType === 'none' || isBBA || isBtnAnte || isSBHalfAnte}
                onChange={(e) => setAnteAmount(e.target.value)}
                className="w-full rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm disabled:opacity-40"
              />
              {isBBA && <div className="text-[10px] text-slate-500 mt-1">= 1 BB ({effBB}) for table</div>}
              {isBtnAnte && <div className="text-[10px] text-emerald-400/80 mt-1">= 1 BB ({effBB}) paid by BTN</div>}
              {isSBHalfAnte && <div className="text-[10px] text-amber-400/80 mt-1">= 0.5 BB ({Math.max(1, Math.round(effBB * 0.5))}) paid by SB</div>}
            </div>
          )}
        </div>
        {anteType === 'bba' && (
          <div className="rounded-lg border border-[#2a2f37] bg-[#12161c] p-3 mb-4 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-200">
              <input
                type="checkbox"
                checked={sbHalfAnteShortHanded}
                onChange={(e) => setSbHalfAnteShortHanded(e.target.checked)}
                className="w-4 h-4 rounded border-[#2a2f37] bg-[#1e2227] accent-emerald-500 cursor-pointer"
              />
              <span>Small blind half ante when table gets short (SB pays 0.5 BB ante for whole table)</span>
            </label>
            {sbHalfAnteShortHanded && (
              <div className="flex flex-wrap items-center gap-2 pl-6 pt-1 text-xs text-slate-400">
                <span>When remaining players are fewer than:</span>
                <input
                  type="number"
                  min="2"
                  max="10"
                  value={shortHandedThreshold}
                  onChange={(e) => setShortHandedThreshold(Math.max(2, Math.min(10, Number(e.target.value) || 5)))}
                  className="w-16 rounded bg-[#1e2227] border border-[#2a2f37] px-2 py-1 text-white font-semibold text-center text-xs"
                />
                <span className="text-[11px] text-slate-500">
                  (Default: 5 — if less than {shortHandedThreshold} players remain, SB half ante is used instead of BBA)
                </span>
              </div>
            )}
          </div>
        )}
        {gameType === 'fl' && (
          <div className="flex items-center gap-3 mb-4">
            <label className="text-xs text-slate-400 whitespace-nowrap">Max raises / street</label>
            <input type="number" min="1" value={flMaxRaises} onChange={(e) => setFlMaxRaises(e.target.value)} className="w-20 rounded-md bg-[#15181d] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
            <span className="text-[11px] text-slate-500">e.g. 3 – 4-bet is the cap</span>
          </div>
        )}
        {isCash && (
          <div className="rounded-lg border border-[#2a2f37] bg-[#15181d] p-3 mb-4 space-y-2.5">
            <div className="text-xs font-semibold text-slate-300">Straddle Settings</div>
            <ToggleRow label="Allow straddle (UTG)" checked={allowStraddle} onChange={setAllowStraddle} />
            {allowStraddle && (
              <div className="flex items-center gap-2 pl-4 py-1">
                <label className="text-xs text-slate-400">Straddle amount:</label>
                <input
                  type="number"
                  value={straddleAmount}
                  onChange={(e) => setStraddleAmount(e.target.value)}
                  placeholder="Amount"
                  className="w-24 rounded bg-[#1e2227] border border-[#2a2f37] px-2.5 py-1 text-white text-xs"
                />
              </div>
            )}
            <ToggleRow label="Allow re-straddle" checked={allowMultiStraddle} onChange={setAllowMultiStraddle} disabled={!allowStraddle} />
          </div>
        )}
        {!isCash && (
          <div className="rounded-lg border border-[#2a2f37] bg-[#15181d] p-3 mb-4">
            <div className="text-xs text-slate-400 mb-2">Tournament format</div>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <select value={tournamentFormat} onChange={(e) => setTournamentFormat(e.target.value)} className="rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm">
                <option value="freezeout">Freezeout</option>
                <option value="reentry">Re-entry</option>
                <option value="rebuy">Re-buy</option>
                <option value="bounty">Bounty</option>
                <option value="mystery bounty">Mystery Bounty</option>
                <option value="shootout">Shootout</option>
              </select>
              {tournamentFormat === 'reentry' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400">Max re-entries</label>
                  <input type="number" min="0" value={maxReEntries} onChange={(e) => setMaxReEntries(e.target.value)} className="w-20 rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
                  <span className="text-[11px] text-slate-500">0 = unlimited</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <ToggleRow label="Late registration" checked={lateRegEnabled} onChange={setLateRegEnabled} />
              {lateRegEnabled && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400">Until level</label>
                  <input type="number" min="1" value={lateRegLevel} onChange={(e) => setLateRegLevel(e.target.value)} className="w-20 rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
                </div>
              )}
            </div>
            {tournamentFormat === 'rebuy' && (
              <div className="border-t border-[#2a2f37] pt-3 mt-2">
                <div className="text-xs text-slate-400 mb-2">Re-buy</div>
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400">Price</label>
                    <input type="number" value={rebuyPrice} onChange={(e) => setRebuyPrice(e.target.value)} placeholder="= buy-in" className="w-24 rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400">New chips</label>
                    <input type="number" value={rebuyChips} onChange={(e) => setRebuyChips(e.target.value)} placeholder="= starting stack" className="w-28 rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
                  </div>
                </div>
                <ToggleRow label="Allow add-on" checked={allowAddOn} onChange={setAllowAddOn} />
                {allowAddOn && (
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-400">Add-on price</label>
                      <input type="number" value={addOnPrice} onChange={(e) => setAddOnPrice(e.target.value)} placeholder="= buy-in" className="w-24 rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-400">Add-on chips</label>
                      <input type="number" value={addOnChips} onChange={(e) => setAddOnChips(e.target.value)} placeholder="1.5× starting stack" className="w-28 rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Tournament Bounties */}
            <div className="border-t border-[#2a2f37] pt-3 mt-3">
              <div className="flex items-center gap-1.5 text-xs text-amber-300 font-medium mb-2">
                <Award size={14} className="text-amber-400" />
                <span>Tournament Bounties</span>
              </div>
              <div className="space-y-2">
                <div>
                  <ToggleRow label="Standard Knockout Bounty" checked={tournamentBounty} onChange={setTournamentBounty} />
                  {tournamentBounty && (
                    <div className="flex items-center gap-2 mt-2 ml-1">
                      <label className="text-xs text-slate-400">Bounty amount:</label>
                      <input
                        type="number"
                        min="1"
                        value={bountyAmount}
                        onChange={(e) => setBountyAmount(e.target.value)}
                        placeholder="50"
                        className="w-24 rounded-md bg-[#1e2227] border border-[#2a2f37] px-2.5 py-1.5 text-white text-sm"
                      />
                      <span className="text-[11px] text-slate-500">Fixed bounty awarded to the covering eliminator</span>
                    </div>
                  )}
                </div>
                <div className="pt-1">
                  <ToggleRow label="Mystery Bounty" checked={mysteryBounty} onChange={setMysteryBounty} />
                  {mysteryBounty && (
                    <div className="text-[11px] text-slate-400 mt-1 ml-1">
                      Eliminating a player prompts host to enter the drawn envelope amount after the hand.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {!isCash && (
          <div className="mb-4">
            <div className="rounded-lg border border-[#2a2f37] bg-[#15181d] p-3 mb-3">
              <ChipDenominationPicker
                selected={chipDenoms}
                onChange={(denoms) => {
                  setChipDenoms(denoms);
                  if (denoms.length) {
                    const lowest = [...denoms].sort((a, b) => a - b)[0];
                    const newSched = defaultScheduleFor(lowest);
                    setSchedule(newSched);
                    setLateRegLevel(firstBreakLevelNum(newSched));
                  }
                }}
              />
              <div className="text-[11px] text-slate-500 mt-2">Bets and raises must be makeable with these chips. The blind schedule updates to match the lowest denomination.</div>
            </div>
            <BlindScheduleEditor schedule={schedule} onChange={setSchedule} anteType={anteType} chipDenominations={chipDenoms} />
          </div>
        )}
        {!isCash && (
          <div className="rounded-lg border border-[#2a2f37] bg-[#15181d] p-3 mb-4">
            <div className="text-xs text-slate-400 mb-2">Level timing</div>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <div className="min-w-[130px]">
                <label className="text-xs text-slate-400 block mb-1">Each level lasts</label>
                <select value={levelMethod} onChange={(e) => handleLevelMethodChange(e.target.value)} className="w-full rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm">
                  <option value="minutes">Minutes</option>
                  <option value="hands">Hands</option>
                  <option value="orbits">Orbits</option>
                </select>
              </div>
              <div className="w-28">
                <label className="text-xs text-slate-400 block mb-1">{levelMethod === 'minutes' ? 'Minutes' : levelMethod === 'hands' ? 'Hands' : 'Orbits'}</label>
                <input type="number" min="1" value={levelValue} onChange={(e) => setLevelValue(e.target.value)} className="w-full rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm" />
              </div>
              <div className="text-[11px] text-slate-500 max-w-[200px]">
                {levelMethod === 'minutes' ? 'Levels and breaks advance automatically on the clock.' : levelMethod === 'hands' ? 'One completed hand counts toward the level.' : 'One dealer-button orbit counts toward the level.'}
              </div>
            </div>
          </div>
        )}
        {/* Action Clock System Setup */}
        {!isCash && (
          <div className="rounded-lg border border-[#2a2f37] bg-[#15181d] p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-emerald-400" />
              <span className="text-sm font-semibold text-white">Action Clock System</span>
            </div>
            <span className="text-[11px] text-slate-400">
              {clockSystem === 'call_clock' ? 'Passive Clock' : 'Shot Clock with Time Banks'}
            </span>
          </div>

          <div className="mb-3">
            <label className="text-xs text-slate-400 block mb-1">Clock Mode</label>
            <select
              value={clockSystem}
              onChange={(e) => setClockSystem(e.target.value)}
              className="w-full rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm"
            >
              <option value="call_clock">Call the clock (default)</option>
              <option value="time_banks">Time banks (Shot clock)</option>
            </select>
          </div>

          {clockSystem === 'call_clock' ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-48">
                <label className="text-xs text-slate-400 block mb-1">Time given when clock is called</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="5"
                    max="300"
                    value={callClockSeconds}
                    onChange={(e) => setCallClockSeconds(e.target.value)}
                    className="w-24 rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm"
                  />
                  <span className="text-xs text-slate-400">seconds (default 60s)</span>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 max-w-sm mt-1">
                A "Clock" button appears in the control menu. When pressed, the active player gets {callClockSeconds || 60}s to act before auto fold/check.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Timing mode selector */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">Base Action Timing</label>
                <select
                  value={timeBankMode}
                  onChange={(e) => setTimeBankMode(e.target.value)}
                  className="w-full rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm"
                >
                  <option value="single">1. One base time for all actions</option>
                  <option value="split">2. Separate preflop and postflop times</option>
                </select>
              </div>

              {timeBankMode === 'single' ? (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Base time for all actions</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="5"
                      max="180"
                      value={singleSeconds}
                      onChange={(e) => setSingleSeconds(e.target.value)}
                      className="w-24 rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm"
                    />
                    <span className="text-xs text-slate-400">seconds (default 30s)</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 bg-[#181c22] p-2.5 rounded-lg border border-[#252a33]">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Preflop time</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="5"
                        max="180"
                        value={preflopSeconds}
                        onChange={(e) => setPreflopSeconds(e.target.value)}
                        className="w-24 rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm"
                      />
                      <span className="text-xs text-slate-400">seconds (default 20s)</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Postflop configuration</label>
                    <div className="flex flex-wrap items-center gap-4 mb-2">
                      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                        <input
                          type="radio"
                          name="postflopSplit"
                          checked={!postflopSplitStreet}
                          onChange={() => setPostflopSplitStreet(false)}
                          className="accent-[#4a5a4a]"
                        />
                        One time for all postflop streets (default 40s)
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                        <input
                          type="radio"
                          name="postflopSplit"
                          checked={postflopSplitStreet}
                          onChange={() => setPostflopSplitStreet(true)}
                          className="accent-[#4a5a4a]"
                        />
                        Split postflop by street
                      </label>
                    </div>

                    {!postflopSplitStreet ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="5"
                          max="180"
                          value={postflopSeconds}
                          onChange={(e) => setPostflopSeconds(e.target.value)}
                          className="w-24 rounded-md bg-[#1e2227] border border-[#2a2f37] px-3 py-2 text-white text-sm"
                        />
                        <span className="text-xs text-slate-400">seconds for flop, turn, and river</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Flop time (s)</label>
                          <input
                            type="number"
                            min="5"
                            max="180"
                            value={flopSeconds}
                            onChange={(e) => setFlopSeconds(e.target.value)}
                            className="w-full rounded-md bg-[#1e2227] border border-[#2a2f37] px-2 py-1.5 text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">Turn time (s)</label>
                          <input
                            type="number"
                            min="5"
                            max="180"
                            value={turnSeconds}
                            onChange={(e) => setTurnSeconds(e.target.value)}
                            className="w-full rounded-md bg-[#1e2227] border border-[#2a2f37] px-2 py-1.5 text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 block mb-1">River time (s)</label>
                          <input
                            type="number"
                            min="5"
                            max="180"
                            value={riverSeconds}
                            onChange={(e) => setRiverSeconds(e.target.value)}
                            className="w-full rounded-md bg-[#1e2227] border border-[#2a2f37] px-2 py-1.5 text-white text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Time Banks */}
              <div className="pt-2 border-t border-[#252a33]">
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs text-slate-400">Initial time bank chips per player:</label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={initialTimeBanks}
                    onChange={(e) => setInitialTimeBanks(e.target.value)}
                    className="w-16 rounded-md bg-[#1e2227] border border-[#2a2f37] px-2 py-1 text-white text-sm text-center"
                  />
                  <span className="text-xs text-slate-500">(default 3 chips)</span>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs text-slate-400">Time added per bank chip:</label>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    value={timeBankAddSeconds}
                    onChange={(e) => setTimeBankAddSeconds(e.target.value)}
                    className="w-16 rounded-md bg-[#1e2227] border border-[#2a2f37] px-2 py-1 text-white text-sm text-center"
                  />
                  <span className="text-xs text-slate-500">seconds (default 30s)</span>
                </div>

                {/* Add-on rules schedule */}
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-slate-300 font-medium">Scheduled Time Bank Chip Add-ons</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAddOnRules((prev) => [
                          ...prev,
                          { id: Date.now().toString(), triggerType: 'level', triggerValue: 4, chips: 1 },
                        ])
                      }
                      className="flex items-center gap-1 rounded bg-[#2a2f37] hover:bg-[#363c45] text-emerald-400 text-xs px-2 py-1 cursor-pointer"
                    >
                      <Plus size={13} /> Add chip rule
                    </button>
                  </div>
                  {addOnRules.length === 0 ? (
                    <div className="text-[11px] text-slate-500 italic">
                      No chips will be added on later (default). You can schedule chips after certain levels or during breaks.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {addOnRules.map((rule, idx) => (
                        <div
                          key={rule.id || idx}
                          className="flex items-center gap-2 bg-[#1b2027] border border-[#2a2f37] rounded-md px-2.5 py-1.5 text-xs text-white"
                        >
                          <span className="text-slate-400">Add</span>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={rule.chips}
                            onChange={(e) =>
                              setAddOnRules((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, chips: Number(e.target.value) || 1 } : r))
                              )
                            }
                            className="w-12 rounded bg-[#15181d] border border-[#2a2f37] px-1.5 py-0.5 text-center text-white"
                          />
                          <span className="text-slate-400">chip{rule.chips > 1 ? 's' : ''}</span>
                          <select
                            value={rule.triggerType}
                            onChange={(e) =>
                              setAddOnRules((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, triggerType: e.target.value } : r))
                              )
                            }
                            className="rounded bg-[#15181d] border border-[#2a2f37] px-2 py-0.5 text-white"
                          >
                            <option value="level">After level</option>
                            <option value="break">During break</option>
                          </select>
                          <input
                            type="number"
                            min="1"
                            value={rule.triggerValue}
                            onChange={(e) =>
                              setAddOnRules((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, triggerValue: Number(e.target.value) || 1 } : r))
                              )
                            }
                            className="w-14 rounded bg-[#15181d] border border-[#2a2f37] px-1.5 py-0.5 text-center text-white"
                          />
                          <button
                            type="button"
                            onClick={() => setAddOnRules((prev) => prev.filter((_, i) => i !== idx))}
                            className="ml-auto text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {error && <div className="text-sm text-rose-400 mb-3">{error}</div>}
        <button onClick={save} className="w-full rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white font-medium py-2.5 transition-colors cursor-pointer">
          Start hand
        </button>
      </div>
      {showStructures && (
        <SavedStructuresDialog
          getCurrentData={buildStructureData}
          onLoad={applyStructure}
          onClose={() => setShowStructures(false)}
        />
      )}
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import {
  X,
  Trophy,
  Users,
  Clock,
  AlertCircle,
  CheckCircle,
  Plus,
  Trash2,
  HelpCircle,
  Layers,
  Sparkles,
  Settings,
  Target,
  Gift,
  FolderOpen,
} from 'lucide-react';
import {
  getDefaultPayoutConfig,
  calculateTournamentPayouts,
  getOrdinalSuffix,
  generatePayoutStructure,
  getConsolidatedPayoutLadder,
  parseRankSpec,
} from '@/lib/payoutEngine';
import { defaultScheduleFor, defaultDenomsFor, ALL_DENOMINATIONS, generateBlindSchedule } from '@/lib/tournamentStructures';
import ChipDenominationPicker from '@/components/poker/ChipDenominationPicker';
import BlindScheduleEditor from '@/components/poker/BlindScheduleEditor';
import SavedStructuresDialog from '@/components/poker/SavedStructuresDialog';

export function generateBalancedEnvelopes(targetBountyPool, targetEnvelopesCount = 15) {
  const count = Math.max(1, Number(targetEnvelopesCount) || 1);
  const pool = Math.max(0, Number(targetBountyPool) || 0);
  if (pool <= 0) {
    return [{ id: 'env_1', quantity: count, amount: 0 }];
  }
  if (count === 1) {
    return [{ id: 'env_1', quantity: 1, amount: pool }];
  }
  if (count === 2) {
    const top = Math.round(pool * 0.7);
    return [
      { id: 'env_1', quantity: 1, amount: top },
      { id: 'env_2', quantity: 1, amount: pool - top },
    ];
  }
  if (count <= 4) {
    const top = Math.round(pool * 0.5);
    const restQty = count - 1;
    const baseAmt = Math.floor((pool - top) / restQty);
    const rem = pool - (top + baseAmt * restQty);
    return [
      { id: 'env_1', quantity: 1, amount: top + rem },
      { id: 'env_2', quantity: restQty, amount: baseAmt },
    ];
  }

  // 4 tiers for count >= 5
  let q1 = 1;
  let q2 = Math.max(1, Math.round(count * 0.1));
  let q3 = Math.max(1, Math.round(count * 0.2));
  let q4 = count - q1 - q2 - q3;

  while (q4 < 1 && q3 > 1) {
    q3--;
    q4 = count - q1 - q2 - q3;
  }
  while (q4 < 1 && q2 > 1) {
    q2--;
    q4 = count - q1 - q2 - q3;
  }

  const grandAmt = Math.max(10, Math.round((pool * 0.35) / 10) * 10);
  const majorAmt = Math.max(5, Math.round((pool * 0.20 / q2) / 5) * 5);
  const midAmt = Math.max(5, Math.round((pool * 0.20 / q3) / 5) * 5);
  const allocatedSoFar = grandAmt * q1 + majorAmt * q2 + midAmt * q3;
  const remPool = pool - allocatedSoFar;
  const baseAmt = remPool > 0 ? Math.max(1, Math.floor(remPool / q4)) : 1;

  const totalAllocated = grandAmt * q1 + majorAmt * q2 + midAmt * q3 + baseAmt * q4;
  const diff = pool - totalAllocated;

  return [
    { id: 'env_1', quantity: q1, amount: grandAmt + diff },
    { id: 'env_2', quantity: q2, amount: majorAmt },
    { id: 'env_3', quantity: q3, amount: midAmt },
    { id: 'env_4', quantity: q4, amount: baseAmt },
  ];
}

export default function DirectorStructureDialog({
  isOpen,
  initialData = {},
  onSave,
  onClose,
}) {
  // Active Tab: 'general' | 'levels' | 'players' | 'payouts'
  const [activeTab, setActiveTab] = useState('general');
  const [showSavedStructures, setShowSavedStructures] = useState(false);

  // General Setup
  const [name, setName] = useState(initialData.name || 'Championship Tournament');
  const [nameEntryMode, setNameEntryMode] = useState(initialData.nameEntryMode || 'now');
  const [totalPlayers, setTotalPlayers] = useState(
    initialData.totalPlayers || initialData.players?.length || 10
  );
  const [tablesCount, setTablesCount] = useState(initialData.tablesCount || 1);
  const [startingStack, setStartingStack] = useState(initialData.startingStack || 5000);
  const [buyIn, setBuyIn] = useState(initialData.buyIn != null ? initialData.buyIn : 100);
  const [currency, setCurrency] = useState(initialData.currency || '$');
  const [levelDurationMinutes, setLevelDurationMinutes] = useState(
    initialData.clock?.levelDurationMinutes || 15
  );

  // Late Reg
  const [lateRegEnabled, setLateRegEnabled] = useState(
    initialData.lateRegEnabled != null ? initialData.lateRegEnabled : true
  );
  const [lateRegLevel, setLateRegLevel] = useState(initialData.lateRegLevel || 4);

  // Tournament Type: 'freezeout' | 'reentry' | 'rebuy' | 'bounty' | 'mystery bounty' | 'shootout'
  const [tournamentType, setTournamentType] = useState(initialData.tournamentType || 'freezeout');
  const [maxReEntries, setMaxReEntries] = useState(initialData.maxReEntries ?? 0);

  // Rebuy Settings
  const [rebuyCost, setRebuyCost] = useState(initialData.rebuyCost ?? (initialData.buyIn || 100));
  const [rebuyChips, setRebuyChips] = useState(
    initialData.rebuyChips ?? (initialData.startingStack || 10000)
  );
  const [rebuyTimeCapEnabled, setRebuyTimeCapEnabled] = useState(
    initialData.rebuyRules?.timeCapEnabled ?? true
  );
  const [rebuyTimeCapLevel, setRebuyTimeCapLevel] = useState(
    initialData.rebuyRules?.timeCapLevel ?? 4
  );
  const [rebuyMaxEnabled, setRebuyMaxEnabled] = useState(
    initialData.rebuyRules?.maxRebuysEnabled ?? false
  );
  const [rebuyMaxCount, setRebuyMaxCount] = useState(initialData.rebuyRules?.maxRebuys ?? 0);
  const [rebuyStackCapEnabled, setRebuyStackCapEnabled] = useState(
    initialData.rebuyRules?.stackCapEnabled ?? true
  );
  const [rebuyStackCapUnit, setRebuyStackCapUnit] = useState(
    initialData.rebuyRules?.stackCapUnit || 'chips'
  );
  const [rebuyStackCapValue, setRebuyStackCapValue] = useState(
    initialData.rebuyRules?.stackCapValue ?? (initialData.startingStack || 10000)
  );

  // Bounty & Mystery Bounty settings
  const defaultITMPlaces = (initialData.payoutConfig?.length) || (initialData.payouts?.length) || getDefaultPayoutConfig(initialData.tablesCount || 1).length || 2;
  const [bountyPercent, setBountyPercent] = useState(
    initialData.bountyPercent != null ? initialData.bountyPercent : 50
  );
  const [mysteryBountyPhase, setMysteryBountyPhase] = useState(() => {
    const p = initialData.mysteryBountyConfig?.startPhase;
    return p === 'field' ? 'field' : 'itm';
  });
  const [mysteryBountyField, setMysteryBountyField] = useState(
    initialData.mysteryBountyConfig?.startFieldSize || defaultITMPlaces
  );
  const [mysteryEnvelopes, setMysteryEnvelopes] = useState(() => {
    if (initialData.mysteryBountyConfig?.envelopes?.length) {
      return initialData.mysteryBountyConfig.envelopes;
    }
    const initPool = (Number(initialData.totalPlayers) || 0) * (Number(initialData.buyIn) || 100);
    const bPool = Math.round((initPool * (initialData.bountyPercent ?? 50)) / 100);
    const phase = initialData.mysteryBountyConfig?.startPhase === 'field' ? 'field' : 'itm';
    let targetLeft = defaultITMPlaces;
    if (phase === 'field') {
      targetLeft = Math.max(2, Number(initialData.mysteryBountyConfig?.startFieldSize) || defaultITMPlaces);
    } else {
      targetLeft = Math.max(2, defaultITMPlaces);
    }
    return generateBalancedEnvelopes(bPool, Math.max(1, targetLeft - 1));
  });

  // Level Setup: Denominations, Ante Choice, Schedule
  const [chipDenominations, setChipDenominations] = useState(() => {
    if (initialData.chipDenominations?.length) return initialData.chipDenominations;
    return defaultDenomsFor(25);
  });
  const [anteType, setAnteType] = useState(initialData.anteType || 'bba');
  const [schedule, setSchedule] = useState(() => {
    if (initialData.clock?.blindSchedule?.length) {
      return initialData.clock.blindSchedule;
    }
    const lowest = chipDenominations.length ? Math.min(...chipDenominations) : 25;
    return defaultScheduleFor(lowest);
  });
  const [breakDurationMinutes, setBreakDurationMinutes] = useState(
    initialData.breakDurationMinutes != null ? initialData.breakDurationMinutes : 10
  );
  const [breakEveryLevels, setBreakEveryLevels] = useState(
    initialData.breakEveryLevels != null ? initialData.breakEveryLevels : 4
  );
  const [desiredDurationMinutes, setDesiredDurationMinutes] = useState(
    initialData.desiredDurationMinutes != null
      ? initialData.desiredDurationMinutes
      : initialData.clock?.desiredDurationMinutes != null
      ? initialData.clock.desiredDurationMinutes
      : 180
  );
  const [colorUpBreaksOnly, setColorUpBreaksOnly] = useState(
    Boolean(initialData.colorUpBreaksOnly ?? initialData.clock?.colorUpBreaksOnly)
  );
  const [generatorSpeed, setGeneratorSpeed] = useState(initialData.generatorSpeed || 'balanced'); // 'balanced' | 'turbo'

  // Player Names (empty by default, do not preload with fillers)
  const [playerNamesInput, setPlayerNamesInput] = useState(() => {
    if (initialData.players && initialData.players.length > 0) {
      const real = initialData.players
        .map((p) => p.name)
        .filter((n) => n && !n.match(/^Player\s+\d+$/i));
      if (real.length > 0) return real.join('\n');
    }
    return '';
  });

  // Simultaneous eliminations toggle
  const [splitSimultaneousTies, setSplitSimultaneousTies] = useState(
    initialData.splitSimultaneousTies != null ? initialData.splitSimultaneousTies : true
  );

  // Flexible Payout configuration
  const [payoutConfig, setPayoutConfig] = useState(() => {
    if (initialData.payoutConfig && initialData.payoutConfig.length > 0) {
      return initialData.payoutConfig;
    }
    return getDefaultPayoutConfig(tablesCount);
  });
  const [itmInputMode, setItmInputMode] = useState('places'); // 'places' | 'percent'
  const [itmInputValue, setItmInputValue] = useState(() =>
    String(Math.max(1, Math.round((Number(initialData.totalPlayers || initialData.players?.length || 10)) * 0.15)))
  );
  const [itmTouched, setItmTouched] = useState(false);
  const [payoutSteepness, setPayoutSteepness] = useState(
    initialData.payoutSteepness != null ? initialData.payoutSteepness : 3
  );

  // Table sizing recommendation logic
  const tableRecommendation = useMemo(() => {
    const p = Math.max(0, Number(totalPlayers) || 0);
    const t = Math.max(1, Number(tablesCount) || 1);
    if (p === 0) {
      return {
        type: 'ok',
        text: 'Enter player names in the Players tab to populate the tournament roster.',
      };
    }
    const avgPerTable = (p / t).toFixed(1);

    if (p / t < 5) {
      return {
        type: 'warning',
        text: `With ${p} players across ${t} tables, tables will have ~${avgPerTable} players each. Tables may feel too short-handed. (Recommendation: consider ${Math.max(1, Math.ceil(p / 8))} tables instead).`,
      };
    }
    if (p / t > 10) {
      return {
        type: 'warning',
        text: `With ${p} players across ${t} tables, tables will have ~${avgPerTable} players each. Tables will be overcrowded. (Recommendation: consider ${Math.ceil(p / 9)} tables).`,
      };
    }
    return {
      type: 'ok',
      text: `Balanced field: ~${avgPerTable} players per table across ${t} tables.`,
    };
  }, [totalPlayers, tablesCount]);

  const handleScheduleChange = (newSched) => {
    setSchedule(newSched);
    if (newSched && newSched.length > 0) {
      const firstLevel = newSched.find((l) => l && l.type !== 'break') || newSched[0];
      const rawBB = firstLevel?.bigBlind;
      const lvl1BB = rawBB ? (parseFloat(String(rawBB).replace(/[^0-9.]/g, '')) || 0) : 0;
      if (lvl1BB > 0) {
        setStartingStack(lvl1BB * 100);
      }
    }
  };

  // Handle Denominations Change
  const handleDenomsChange = (newDenoms) => {
    setChipDenominations(newDenoms);
    if (newDenoms.length > 0) {
      const lowest = Math.min(...newDenoms);
      const newSched = defaultScheduleFor(lowest);
      handleScheduleChange(newSched);
    }
  };

  const buildStructureData = () => ({
    name,
    tournamentFormat: tournamentType,
    tournamentType,
    levelDurationMinutes: Number(levelDurationMinutes) || 15,
    breakDurationMinutes: Number(breakDurationMinutes) || 10,
    breakEveryLevels: Number(breakEveryLevels) || 4,
    desiredDurationMinutes: Number(desiredDurationMinutes) || 0,
    colorUpBreaksOnly: Boolean(colorUpBreaksOnly),
    generatorSpeed,
    startingStack: Number(startingStack) || 5000,
    buyIn: Number(buyIn) || 100,
    currency,
    chipDenominations,
    chipDenoms: chipDenominations,
    anteType,
    schedule,
    blindSchedule: schedule,
    totalPlayers: Number(totalPlayers) || 10,
    tablesCount: Number(tablesCount) || 1,
    payoutConfig,
    payoutSteepness,
    lateRegEnabled,
    lateRegLevel: Number(lateRegLevel) || 4,
    rebuyCost: Number(rebuyCost) || Number(buyIn) || 100,
    rebuyChips: Number(rebuyChips) || Number(startingStack) || 5000,
    maxReEntries: Number(maxReEntries) || 0,
    rebuyRules: {
      timeCapEnabled: rebuyTimeCapEnabled,
      timeCapLevel: Number(rebuyTimeCapLevel) || 4,
      maxRebuysEnabled: rebuyMaxEnabled,
      maxRebuys: Number(rebuyMaxCount) || 0,
      stackCapEnabled: rebuyStackCapEnabled,
      stackCapUnit: rebuyStackCapUnit,
      stackCapValue: Number(rebuyStackCapValue) || Number(startingStack) || 5000,
    },
    bountyPercent: isBounty ? effectiveBountyPercent : undefined,
  });

  const applyStructure = (d) => {
    if (!d) return;
    if (d.name) setName(d.name);
    if (d.tournamentFormat) setTournamentType(d.tournamentFormat);
    if (d.tournamentType) setTournamentType(d.tournamentType);
    if (d.levelDurationMinutes != null) setLevelDurationMinutes(d.levelDurationMinutes);
    if (d.breakDurationMinutes != null) setBreakDurationMinutes(d.breakDurationMinutes);
    if (d.breakEveryLevels != null) setBreakEveryLevels(d.breakEveryLevels);
    if (d.desiredDurationMinutes != null) setDesiredDurationMinutes(d.desiredDurationMinutes);
    if (d.colorUpBreaksOnly != null) setColorUpBreaksOnly(Boolean(d.colorUpBreaksOnly));
    if (d.generatorSpeed) setGeneratorSpeed(d.generatorSpeed);
    if (d.startingStack != null) setStartingStack(d.startingStack);
    if (d.buyIn != null) setBuyIn(d.buyIn);
    if (d.currency != null) setCurrency(d.currency);
    if (Array.isArray(d.chipDenominations)) setChipDenominations(d.chipDenominations);
    else if (Array.isArray(d.chipDenoms)) setChipDenominations(d.chipDenoms);
    if (d.anteType) setAnteType(d.anteType);
    if (Array.isArray(d.schedule)) setSchedule(d.schedule);
    else if (Array.isArray(d.blindSchedule)) setSchedule(d.blindSchedule);
    if (d.totalPlayers != null) setTotalPlayers(d.totalPlayers);
    if (d.tablesCount != null) setTablesCount(d.tablesCount);
    if (Array.isArray(d.payoutConfig)) setPayoutConfig(d.payoutConfig);
    if (d.payoutSteepness != null) setPayoutSteepness(d.payoutSteepness);
    if (d.lateRegEnabled != null) setLateRegEnabled(d.lateRegEnabled);
    if (d.lateRegLevel != null) setLateRegLevel(d.lateRegLevel);
    if (d.maxReEntries != null) setMaxReEntries(d.maxReEntries);
    if (d.rebuyCost != null) setRebuyCost(d.rebuyCost);
    if (d.rebuyChips != null) setRebuyChips(d.rebuyChips);
    if (d.rebuyRules) {
      if (d.rebuyRules.timeCapEnabled != null) setRebuyTimeCapEnabled(d.rebuyRules.timeCapEnabled);
      if (d.rebuyRules.timeLimitEnabled != null) setRebuyTimeCapEnabled(d.rebuyRules.timeLimitEnabled);
      if (d.rebuyRules.timeCapLevel != null) setRebuyTimeCapLevel(d.rebuyRules.timeCapLevel);
      if (d.rebuyRules.timeCutoffLevel != null) setRebuyTimeCapLevel(d.rebuyRules.timeCutoffLevel);
      if (d.rebuyRules.maxRebuysEnabled != null) setRebuyMaxEnabled(d.rebuyRules.maxRebuysEnabled);
      if (d.rebuyRules.cappedRebuysEnabled != null) setRebuyMaxEnabled(d.rebuyRules.cappedRebuysEnabled);
      if (d.rebuyRules.maxRebuys != null) setRebuyMaxCount(d.rebuyRules.maxRebuys);
      if (d.rebuyRules.stackCapEnabled != null) setRebuyStackCapEnabled(d.rebuyRules.stackCapEnabled);
      if (d.rebuyRules.stackCapValue != null) setRebuyStackCapValue(d.rebuyRules.stackCapValue);
      if (d.rebuyRules.stackCapAmount != null) setRebuyStackCapValue(d.rebuyRules.stackCapAmount);
      if (d.rebuyRules.stackCapUnit != null) setRebuyStackCapUnit(d.rebuyRules.stackCapUnit);
    }
  };

  const isBounty = tournamentType === 'bounty' || tournamentType === 'mystery bounty';
  const isMysteryBounty = tournamentType === 'mystery bounty';
  const effectiveBountyPercent = isBounty ? Math.min(99, Math.max(1, Number(bountyPercent) || 50)) : 0;
  const numPlayers = Number(totalPlayers) || 0;
  const buyInAmount = Number(buyIn) || 100;
  const baseTotalPool = numPlayers * buyInAmount;
  const bountyPoolAmount = isBounty ? Math.round((baseTotalPool * effectiveBountyPercent) / 100) : 0;
  const rankBasedPoolAmount = isBounty ? baseTotalPool - bountyPoolAmount : baseTotalPool;

  // Live calculated preview of payouts (rank-based pool is passed so percentages apply to rank pool!)
  const previewPayouts = useMemo(() => {
    return calculateTournamentPayouts({
      totalPlayers: numPlayers,
      buyIn: buyInAmount,
      totalPool: rankBasedPoolAmount,
      payoutConfig,
      tablesCount: Number(tablesCount) || 1,
      splitSimultaneousTies,
    });
  }, [numPlayers, buyInAmount, rankBasedPoolAmount, payoutConfig, tablesCount, splitSimultaneousTies]);

  // Consolidated ladder preview for clean range display
  const consolidatedPreview = useMemo(() => {
    return getConsolidatedPayoutLadder(previewPayouts);
  }, [previewPayouts]);

  // Total allocated in the rank prize ladder
  const ladderTotalAmount = useMemo(() => {
    return previewPayouts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [previewPayouts]);

  const hasFixedPayouts = useMemo(() => {
    return payoutConfig.some((row) => row.payout?.type === 'fixed');
  }, [payoutConfig]);

  // Adjust amount shown next to total pool depending on amounts entered:
  const adjustedDisplayTotalPool = useMemo(() => {
    if (isBounty) {
      return ladderTotalAmount + bountyPoolAmount;
    }
    if (hasFixedPayouts) {
      return ladderTotalAmount;
    }
    return ladderTotalAmount || baseTotalPool;
  }, [isBounty, ladderTotalAmount, bountyPoolAmount, hasFixedPayouts, baseTotalPool]);

  // Running total of mystery bounty envelopes
  const runningEnvelopeTotal = useMemo(() => {
    return mysteryEnvelopes.reduce(
      (sum, env) => sum + (Number(env.quantity) || 0) * (Number(env.amount) || 0),
      0
    );
  }, [mysteryEnvelopes]);

  const handleAddEnvelopeRow = () => {
    const nextAmount = Math.max(10, Math.round(bountyPoolAmount * 0.05) || 25);
    setMysteryEnvelopes((prev) => [
      ...prev,
      { id: `env_${Date.now()}`, quantity: 1, amount: nextAmount },
    ]);
  };

  const handleUpdateEnvelope = (index, field, value) => {
    setMysteryEnvelopes((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: Math.max(0, Number(value) || 0) };
      return copy;
    });
  };

  const handleDeleteEnvelope = (index) => {
    setMysteryEnvelopes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAutoBalanceEnvelopes = () => {
    const currentITM = previewPayouts.length || payoutConfig.length || defaultITMPlaces || 2;
    let targetLeft = currentITM;
    if (mysteryBountyPhase === 'field') {
      targetLeft = Math.max(2, Number(mysteryBountyField) || currentITM);
    } else {
      targetLeft = Math.max(2, currentITM);
    }
    const targetCount = Math.max(1, targetLeft - 1);
    setMysteryEnvelopes(generateBalancedEnvelopes(bountyPoolAmount, targetCount));
  };

  const handlePlayerNamesChange = (val) => {
    setPlayerNamesInput(val);
    const names = val
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (names.length > 0) {
      setTotalPlayers(names.length);
    }
  };

  // Computed Player Roster automatically counted from entered entries
  const parsedPlayerNames = useMemo(() => {
    const rawLines = playerNamesInput
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (rawLines.length > 0) {
      return rawLines;
    }
    const count = Math.max(2, Number(totalPlayers) || 10);
    const list = [];
    for (let i = 1; i <= count; i++) {
      list.push(`Player ${i}`);
    }
    return list;
  }, [playerNamesInput, totalPlayers]);

  const handleApplyDefaultPayouts = () => {
    setPayoutConfig(getDefaultPayoutConfig(tablesCount));
    setItmTouched(false);
    setItmInputMode('places');
    setItmInputValue(String(Math.max(1, Math.round((Number(totalPlayers) || 10) * 0.15))));
  };

  const resolvedItmTarget = useMemo(() => {
    const field = Math.max(1, Number(totalPlayers) || 10);
    const raw = String(itmInputValue ?? '').trim();
    if (!itmTouched && itmInputMode === 'places') {
      const places = Math.max(1, Math.min(field, Math.round(field * 0.15)));
      return { places, pct: Math.round((places / field) * 1000) / 10, isPercent: false };
    }
    if (itmInputMode === 'percent' || raw.endsWith('%')) {
      const pct = Math.max(0.1, Math.min(100, parseFloat(raw.replace('%', '')) || 15));
      const places = Math.max(1, Math.min(field, Math.round((pct / 100) * field)));
      return { places, pct, isPercent: true };
    }
    const places = Math.max(1, Math.min(field, Math.round(Number(raw) || Math.round(field * 0.15) || 1)));
    return { places, pct: Math.round((places / field) * 1000) / 10, isPercent: false };
  }, [itmInputValue, itmInputMode, itmTouched, totalPlayers]);

  const handleGeneratePayouts = (overrideSteepness) => {
    const s = overrideSteepness != null ? overrideSteepness : payoutSteepness;
    const field = Math.max(1, Number(totalPlayers) || 10);
    const generated = generatePayoutStructure({
      places: resolvedItmTarget.places,
      percent: resolvedItmTarget.isPercent ? resolvedItmTarget.pct : undefined,
      totalPlayers: field,
      totalPool: rankBasedPoolAmount,
      buyIn: buyInAmount,
      steepness: s,
    });
    setPayoutConfig(generated);
  };

  const handleGenerateBlindStructure = () => {
    const lowest = chipDenominations.length ? Math.min(...chipDenominations) : 25;
    const newSched = generateBlindSchedule({
      lowestChip: lowest,
      startingStack: Number(startingStack) || 10000,
      levelDurationMinutes: Number(levelDurationMinutes) || 15,
      breakDurationMinutes: Number(breakDurationMinutes) || 10,
      breakEveryLevels: Number(breakEveryLevels) || 4,
      desiredMinutes: Number(desiredDurationMinutes) || 0,
      colorUpBreaksOnly,
      chipDenominations,
      speed: generatorSpeed,
      anteType,
    });
    setSchedule(newSched);
  };

  const tournamentDurationInfo = useMemo(() => {
    let playMinutes = 0;
    let breakMinutes = 0;
    let playCount = 0;
    let breakCount = 0;

    (schedule || []).forEach((item) => {
      if (item.type === 'break') {
        const m = Number(item.minutes) || Number(breakDurationMinutes) || 10;
        breakMinutes += m;
        breakCount++;
      } else {
        const m = Number(item.minutes) || Number(levelDurationMinutes) || 15;
        playMinutes += m;
        playCount++;
      }
    });

    const totalMinutes = playMinutes + breakMinutes;
    const hours = Math.floor(totalMinutes / 60);
    const remMins = totalMinutes % 60;
    return {
      playMinutes,
      breakMinutes,
      totalMinutes,
      hours,
      remMins,
      playCount,
      breakCount,
      formattedDuration: `${hours}h ${remMins.toString().padStart(2, '0')}m`,
    };
  }, [schedule, breakDurationMinutes, levelDurationMinutes]);

  const handleAddPayoutRow = () => {
    let maxRank = 0;
    payoutConfig.forEach((row) => {
      const parsed = parseRankSpec(row.rank, numPlayers || 10, maxRank);
      if (parsed.end > maxRank) maxRank = parsed.end;
    });
    const nextPlace = maxRank + 1;
    setPayoutConfig((prev) => [
      ...prev,
      { rank: nextPlace, payout: { type: 'percent', value: 5 } },
    ]);
  };

  const handleUpdatePayoutRow = (idx, field, value) => {
    setPayoutConfig((prev) => {
      const copy = [...prev];
      if (field === 'rank') {
        copy[idx] = { ...copy[idx], rank: value };
      } else if (field === 'type') {
        const curVal = copy[idx].payout?.value ?? 10;
        copy[idx] = { ...copy[idx], payout: { type: value, value: curVal } };
      } else if (field === 'value') {
        const curType = copy[idx].payout?.type || 'percent';
        copy[idx] = { ...copy[idx], payout: { type: curType, value: parseFloat(value) || 0 } };
      }
      return copy;
    });
  };

  const handleDeletePayoutRow = (idx) => {
    setPayoutConfig((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    const hasTypedNames = playerNamesInput.trim().length > 0;
    const finalCount = nameEntryMode === 'now'
      ? (hasTypedNames ? parsedPlayerNames.length : Math.max(2, Number(totalPlayers) || 10))
      : Math.max(2, Number(totalPlayers) || 10);

    onSave({
      name,
      nameEntryMode,
      totalPlayers: finalCount,
      tablesCount: Number(tablesCount) || 1,
      startingStack: Number(startingStack) || 5000,
      buyIn: Number(buyIn) || 100,
      currency,
      levelDurationMinutes: Number(levelDurationMinutes) || 15,
      lateRegEnabled,
      lateRegLevel: Number(lateRegLevel) || 4,
      tournamentType,
      maxReEntries: Number(maxReEntries) || 0,
      rebuyCost: Number(rebuyCost) || Number(buyIn) || 100,
      rebuyChips: Number(rebuyChips) || Number(startingStack) || 5000,
      rebuyRules: {
        timeCapEnabled: rebuyTimeCapEnabled,
        timeCapLevel: Number(rebuyTimeCapLevel) || 4,
        maxRebuysEnabled: rebuyMaxEnabled,
        maxRebuys: Number(rebuyMaxCount) || 0,
        stackCapEnabled: rebuyStackCapEnabled,
        stackCapUnit: rebuyStackCapUnit,
        stackCapValue: Number(rebuyStackCapValue) || Number(startingStack) || 5000,
      },
      anteType,
      chipDenominations,
      blindSchedule: schedule,
      playerNames: nameEntryMode === 'now' && hasTypedNames ? parsedPlayerNames : [],
      splitSimultaneousTies,
      payoutConfig,
      bountyPercent: isBounty ? effectiveBountyPercent : undefined,
      bountyPool: isBounty ? bountyPoolAmount : undefined,
      rankPool: isBounty ? rankBasedPoolAmount : undefined,
      mysteryBountyConfig: isMysteryBounty ? {
        startPhase: mysteryBountyPhase,
        startLevel: Number(mysteryBountyLevel) || 8,
        startFieldSize: Number(mysteryBountyField) || defaultITMPlaces,
        envelopes: mysteryEnvelopes,
      } : undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#2a2f37] bg-[#1e2227] p-6 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Trophy className="text-emerald-400" size={22} />
            <h2 className="text-xl font-semibold text-white">Structure setup (Tournament Director)</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSavedStructures(true)}
              className="flex items-center gap-1.5 rounded-md bg-[#2a2f37] hover:bg-[#363c45] text-slate-300 text-sm px-3 py-1.5 cursor-pointer"
            >
              <FolderOpen size={15} /> Saved structures
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-white cursor-pointer p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation - Action Tracker Segmented Style */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#121417] p-1.5 rounded-xl border border-[#2a2f37] mb-5">
          {[
            { id: 'general', label: '1. General & Rules' },
            { id: 'levels', label: '2. Levels & Chips' },
            { id: 'players', label: '3. Players Roster' },
            { id: 'payouts', label: '4. Payout Structure' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex-1 text-center ${
                activeTab === tab.id
                  ? 'bg-[#4a5a4a] text-white shadow'
                  : 'text-slate-400 hover:text-white bg-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* TAB 1: GENERAL & TOURNAMENT RULES */}
          {activeTab === 'general' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Tournament Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg bg-[#15181d] border border-[#2a2f37] px-3.5 py-2 text-white text-sm focus:outline-none focus:border-[#4a5a4a]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Starting Stack (Chips)
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={startingStack}
                    onChange={(e) => setStartingStack(e.target.value)}
                    className="w-full rounded-lg bg-[#15181d] border border-[#2a2f37] px-3.5 py-2 text-white text-sm focus:outline-none focus:border-[#4a5a4a] font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Player Registration Method
                  </label>
                  <select
                    value={nameEntryMode}
                    onChange={(e) => setNameEntryMode(e.target.value)}
                    className="w-full rounded-lg bg-[#15181d] border border-[#2a2f37] px-3.5 py-2 text-white text-sm focus:outline-none focus:border-[#4a5a4a]"
                  >
                    <option value="now">Enter player names now (Default)</option>
                    <option value="itm">Enter when ITM / approaching money</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Total Starting Players
                    </label>
                    <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                      {nameEntryMode === 'now' ? 'Auto-counted from Roster' : 'Manual Field Count'}
                    </span>
                  </div>
                  {nameEntryMode === 'now' ? (
                    <div className="flex items-center justify-between w-full rounded-lg bg-[#15181d] border border-[#2a2f37] px-3.5 py-2 text-white text-sm font-mono">
                      <span className="text-white font-bold">{parsedPlayerNames.length} Players</span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('players')}
                        className="text-xs text-emerald-400 hover:text-emerald-300 underline font-sans cursor-pointer"
                      >
                        Edit Roster ({parsedPlayerNames.length}) →
                      </button>
                    </div>
                  ) : (
                    <input
                      type="number"
                      min="2"
                      max="5000"
                      value={totalPlayers}
                      onChange={(e) => setTotalPlayers(Math.max(2, parseInt(e.target.value) || 2))}
                      className="w-full rounded-lg bg-[#15181d] border border-[#2a2f37] px-3.5 py-2 text-white text-sm focus:outline-none focus:border-[#4a5a4a] font-mono"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Number of Tables
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={tablesCount}
                    onChange={(e) => setTablesCount(e.target.value)}
                    className="w-full rounded-lg bg-[#15181d] border border-[#2a2f37] px-3.5 py-2 text-white text-sm focus:outline-none focus:border-[#4a5a4a] font-mono"
                  />
                </div>
              </div>

              {/* Table Recommendation Alert */}
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                  tableRecommendation.type === 'warning'
                    ? 'bg-amber-950/30 border-amber-800/50 text-amber-200'
                    : 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200'
                }`}
              >
                {tableRecommendation.type === 'warning' ? (
                  <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div className="leading-relaxed">{tableRecommendation.text}</div>
              </div>

              {/* Buy-in & Currency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Buy-in Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2 text-slate-400 font-mono">{currency}</span>
                    <input
                      type="number"
                      min="0"
                      value={buyIn}
                      onChange={(e) => setBuyIn(e.target.value)}
                      className="w-full rounded-lg bg-[#15181d] border border-[#2a2f37] pl-8 pr-3.5 py-2 text-white text-sm focus:outline-none focus:border-[#4a5a4a] font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Currency Symbol
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full rounded-lg bg-[#15181d] border border-[#2a2f37] px-3.5 py-2 text-white text-sm focus:outline-none focus:border-[#4a5a4a] text-center font-mono"
                  />
                </div>
              </div>

              {/* Late Reg Toggle */}
              <div className="p-4 rounded-xl bg-[#15181d] border border-[#2a2f37] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">Late Registration</div>
                    <div className="text-xs text-slate-400">Allow players to enter during early levels</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLateRegEnabled(!lateRegEnabled)}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors relative cursor-pointer ${
                      lateRegEnabled ? 'bg-[#4a5a4a]' : 'bg-[#2a2f37]'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                        lateRegEnabled ? 'translate-x-4' : ''
                      }`}
                    />
                  </button>
                </div>

                {lateRegEnabled && (
                  <div className="flex items-center gap-3 pt-2 border-t border-[#2a2f37]">
                    <span className="text-xs text-slate-300">Open until end of level:</span>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={lateRegLevel}
                      onChange={(e) => setLateRegLevel(e.target.value)}
                      className="w-20 rounded-lg bg-[#1e2227] border border-[#2a2f37] px-2.5 py-1.5 text-white text-xs font-mono text-center focus:border-[#4a5a4a]"
                    />
                  </div>
                )}
              </div>

              {/* Tournament Type Dropdown (Right below late reg toggle) */}
              <div className="p-4 rounded-xl bg-[#15181d] border border-[#2a2f37] space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Tournament Type
                  </label>
                  <select
                    value={tournamentType}
                    onChange={(e) => setTournamentType(e.target.value)}
                    className="w-full rounded-lg bg-[#1e2227] border border-[#2a2f37] px-3.5 py-2 text-white text-sm focus:outline-none focus:border-[#4a5a4a]"
                  >
                    <option value="freezeout">Freezeout (No Re-Entries or Rebuys)</option>
                    <option value="reentry">Re-Entry (Eliminated Players Re-enter as New Field Entries)</option>
                    <option value="rebuy">Rebuy (Active Players Add Chips to Existing Stacks)</option>
                    <option value="bounty">Bounty (Standard Knockout)</option>
                    <option value="mystery bounty">Mystery Bounty</option>
                  </select>
                </div>

                {/* Re-Entry Settings */}
                {tournamentType === 'reentry' && (
                  <div className="p-3 bg-[#1e2227] border border-[#2a2f37] rounded-xl space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 font-medium">Max Re-Entries per Player:</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          value={maxReEntries}
                          onChange={(e) => setMaxReEntries(e.target.value)}
                          className="w-20 rounded-lg bg-[#15181d] border border-[#2a2f37] px-2.5 py-1 text-white text-xs font-mono text-center focus:border-[#4a5a4a]"
                        />
                        <span className="text-slate-400 text-[11px]">(0 = Unlimited)</span>
                      </div>
                    </div>
                    <div className="text-slate-400 text-[11px] leading-relaxed">
                      Rule: Re-entry stack = starting stack ({startingStack.toLocaleString()} chips), cost = buy-in ({currency}{buyIn}).
                    </div>
                  </div>
                )}

                {/* Rebuy Settings */}
                {tournamentType === 'rebuy' && (
                  <div className="p-3.5 bg-[#1e2227] border border-[#2a2f37] rounded-xl space-y-4 text-xs">
                    <div className="font-bold text-slate-200 text-xs uppercase tracking-wide">
                      Rebuy Customization & Eligibility Rules
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Rebuy Cost</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1.5 text-slate-400 font-mono">{currency}</span>
                          <input
                            type="number"
                            min="0"
                            value={rebuyCost}
                            onChange={(e) => setRebuyCost(e.target.value)}
                            className="w-full rounded-lg bg-[#15181d] border border-[#2a2f37] pl-7 pr-2 py-1.5 text-white font-mono focus:border-[#4a5a4a]"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Rebuy Chips Given</label>
                        <input
                          type="number"
                          min="100"
                          step="100"
                          value={rebuyChips}
                          onChange={(e) => setRebuyChips(e.target.value)}
                          className="w-full rounded-lg bg-[#15181d] border border-[#2a2f37] px-2.5 py-1.5 text-white font-mono focus:border-[#4a5a4a]"
                        />
                      </div>
                    </div>

                    {/* Enable / Disable Rebuy Rule Types */}
                    <div className="space-y-3 pt-2 border-t border-purple-900/40">
                      <div className="text-[11px] text-slate-300 font-semibold">
                        Rebuy Eligibility Types (if multiple are selected, all must apply):
                      </div>

                      {/* Rule 1: Time Cap */}
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rebuyTimeCapEnabled}
                            onChange={(e) => setRebuyTimeCapEnabled(e.target.checked)}
                            className="rounded accent-purple-600"
                          />
                          <span className="text-slate-300">Time Cap (Last level to rebuy)</span>
                        </label>
                        {rebuyTimeCapEnabled && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400 text-[11px]">Level:</span>
                            <input
                              type="number"
                              min="1"
                              max="20"
                              value={rebuyTimeCapLevel}
                              onChange={(e) => setRebuyTimeCapLevel(e.target.value)}
                              className="w-16 bg-[#141922] border border-slate-700 rounded px-2 py-1 text-white font-mono text-center"
                            />
                          </div>
                        )}
                      </div>

                      {/* Rule 2: Max Rebuys */}
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rebuyMaxEnabled}
                            onChange={(e) => setRebuyMaxEnabled(e.target.checked)}
                            className="rounded accent-purple-600"
                          />
                          <span className="text-slate-300">Max Rebuys Limit</span>
                        </label>
                        {rebuyMaxEnabled && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400 text-[11px]">Count (0 = unlim):</span>
                            <input
                              type="number"
                              min="0"
                              value={rebuyMaxCount}
                              onChange={(e) => setRebuyMaxCount(e.target.value)}
                              className="w-16 bg-[#141922] border border-slate-700 rounded px-2 py-1 text-white font-mono text-center"
                            />
                          </div>
                        )}
                      </div>

                      {/* Rule 3: Stack Size Cap */}
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rebuyStackCapEnabled}
                            onChange={(e) => setRebuyStackCapEnabled(e.target.checked)}
                            className="rounded accent-purple-600"
                          />
                          <span className="text-slate-300">Stack Size Cap (Rebuy only if stack ≤ baseline)</span>
                        </label>
                        {rebuyStackCapEnabled && (
                          <div className="flex items-center gap-2 pl-6">
                            <input
                              type="number"
                              value={rebuyStackCapValue}
                              onChange={(e) => setRebuyStackCapValue(e.target.value)}
                              className="w-28 bg-[#141922] border border-slate-700 rounded px-2 py-1 text-white font-mono"
                            />
                            <select
                              value={rebuyStackCapUnit}
                              onChange={(e) => setRebuyStackCapUnit(e.target.value)}
                              className="bg-[#141922] border border-slate-700 rounded px-2 py-1 text-slate-300 text-xs"
                            >
                              <option value="chips">Chips</option>
                              <option value="bb">Big Blinds (BB)</option>
                            </select>
                          </div>
                        )}
                      </div>

                      <div className="text-[11px] text-purple-300/80 italic pt-1">
                        * Note: When recording a rebuy, the TD verifies this via a quick pop-up checklist (actual stack size does not have to be typed in).
                      </div>
                    </div>
                  </div>
                )}

                {/* Freezeout Notice */}
                {tournamentType === 'freezeout' && (
                  <div className="p-3.5 bg-slate-800/40 border border-slate-700/60 rounded-xl text-xs space-y-1">
                    <div className="font-semibold text-slate-200">Freezeout Tournament</div>
                    <div className="text-slate-400 text-[11px] leading-relaxed">
                      Single entry format. Once eliminated, players cannot re-enter or rebuy. Re-entry controls are strictly disabled.
                    </div>
                  </div>
                )}

                {/* Bounty & Mystery Bounty Pool Allocation Box */}
                {isBounty && (
                  <div className="p-4 bg-amber-950/20 border border-amber-800/40 rounded-xl space-y-3.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                        <Target size={15} className="text-amber-400" />
                        <span>Bounty Prize Pool Allocation</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Total Buy-In Pool: <span className="font-mono text-white font-bold">{currency}{baseTotalPool.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="bg-[#141922] p-3 rounded-lg border border-slate-800 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-300 font-medium">Bounty Portion of Total Pool:</span>
                          <div className="relative flex items-center">
                            <input
                              type="number"
                              min="1"
                              max="99"
                              value={bountyPercent}
                              onChange={(e) => setBountyPercent(Math.min(99, Math.max(1, Number(e.target.value) || 0)))}
                              className="w-16 bg-[#1b202a] border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-mono text-right pr-6 focus:outline-none focus:border-amber-500"
                            />
                            <span className="absolute right-2 text-slate-400 text-xs pointer-events-none">%</span>
                          </div>
                        </div>

                        {/* Dollar amount next to that */}
                        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-lg">
                          <span className="text-slate-400 text-[11px]">Bounty Pool Amount:</span>
                          <span className="font-mono font-bold text-amber-400 text-sm">
                            {currency}{bountyPoolAmount.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
                        <span className="text-slate-400">
                          Rank-Based Prize Pool ({100 - effectiveBountyPercent}%):
                        </span>
                        <span className="font-mono text-emerald-400 font-bold">
                          {currency}{rankBasedPoolAmount.toLocaleString()}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 italic">
                        * Note: Rank-based payouts in the Payout tab calculate from the rank-based prize pool ({currency}{rankBasedPoolAmount.toLocaleString()}).
                      </div>
                    </div>

                    {tournamentType === 'bounty' && (
                      <div className="flex items-center justify-between p-2.5 bg-[#141922] rounded-lg border border-slate-800 text-[11px]">
                        <span className="text-slate-300">Standard Knockout Bounty:</span>
                        <span className="font-mono font-bold text-amber-300">
                          {currency}{Math.max(1, Math.round(bountyPoolAmount / Math.max(1, totalPlayers))).toLocaleString()} per elimination
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Mystery Bounty Specific Configuration */}
                {tournamentType === 'mystery bounty' && (
                  <div className="p-4 bg-purple-950/20 border border-purple-800/40 rounded-xl space-y-4 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-purple-300 uppercase tracking-wide flex items-center gap-1.5">
                        <Sparkles size={15} className="text-purple-400" />
                        <span>Mystery Bounty Phase & Envelopes</span>
                      </div>
                    </div>

                    {/* 1. Bounty Phase Start Choice */}
                    <div className="space-y-2">
                      <label className="block text-slate-300 font-semibold text-[11px] uppercase tracking-wider">
                        When Does Mystery Bounty Phase Start?
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          { id: 'itm', label: 'In the Money (ITM)', desc: 'Starts when the bubble bursts' },
                          { id: 'field', label: 'Field Size', desc: `Starts at ${mysteryBountyField} players remaining` },
                        ].map((phase) => (
                          <label
                            key={phase.id}
                            className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                              mysteryBountyPhase === phase.id
                                ? 'bg-purple-900/40 border-purple-500/60 text-white'
                                : 'bg-[#141922] border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            <input
                              type="radio"
                              name="mysteryBountyPhase"
                              value={phase.id}
                              checked={mysteryBountyPhase === phase.id}
                              onChange={() => {
                                setMysteryBountyPhase(phase.id);
                                if (phase.id === 'field') {
                                  const itmCount = previewPayouts.length || payoutConfig.length || defaultITMPlaces || 2;
                                  setMysteryBountyField((prev) => (Number(prev) === 18 || !prev ? itmCount : prev));
                                }
                              }}
                              className="mt-0.5 accent-purple-500"
                            />
                            <div className="flex-1">
                              <div className="font-bold text-xs text-slate-200">{phase.label}</div>
                              <div className="text-[10px] text-slate-400">{phase.desc}</div>
                            </div>
                          </label>
                        ))}
                      </div>

                      {/* Input for Field Size */}
                      {mysteryBountyPhase === 'field' && (
                        <div className="flex items-center gap-2 p-2.5 bg-[#141922] rounded-lg border border-slate-800 mt-2">
                          <span className="text-slate-300 text-xs">Field Size (Players Remaining):</span>
                          <input
                            type="number"
                            min="2"
                            value={mysteryBountyField}
                            onChange={(e) => setMysteryBountyField(Math.max(2, Number(e.target.value) || 2))}
                            className="w-20 bg-[#1b202a] border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs font-mono text-center"
                          />
                          <span className="text-slate-400 text-[11px]">(default = {previewPayouts.length || payoutConfig.length || defaultITMPlaces} ITM places)</span>
                        </div>
                      )}
                    </div>

                    {/* 2. Configure Envelopes Table */}
                    <div className="space-y-2 pt-2 border-t border-purple-900/40">
                      <div className="flex items-center justify-between">
                        <label className="text-slate-300 font-semibold text-[11px] uppercase tracking-wider">
                          Configure Bounty Envelopes
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleAutoBalanceEnvelopes}
                            className="text-[10px] px-2 py-1 rounded bg-purple-900/40 hover:bg-purple-900/70 text-purple-300 border border-purple-700/50 cursor-pointer"
                          >
                            Auto-Balance
                          </button>
                          <button
                            type="button"
                            onClick={handleAddEnvelopeRow}
                            className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={11} />
                            <span>Add Tier</span>
                          </button>
                        </div>
                      </div>

                      {/* Table */}
                      <div className="bg-[#141922] rounded-xl border border-slate-800 overflow-hidden">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-900/80 border-b border-slate-800 text-[11px] text-slate-400">
                              <th className="py-2 px-3 font-semibold w-24">Quantity</th>
                              <th className="py-2 px-3 font-semibold">Amount in Envelope</th>
                              <th className="py-2 px-3 font-semibold text-right">Subtotal</th>
                              <th className="py-2 px-2 text-center w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-mono">
                            {mysteryEnvelopes.map((env, idx) => {
                              const subtotal = (Number(env.quantity) || 0) * (Number(env.amount) || 0);
                              return (
                                <tr key={env.id || idx} className="hover:bg-slate-800/20">
                                  <td className="py-2 px-3">
                                    <input
                                      type="number"
                                      min="1"
                                      value={env.quantity}
                                      onChange={(e) => handleUpdateEnvelope(idx, 'quantity', e.target.value)}
                                      className="w-16 bg-[#1b202a] border border-slate-700 rounded px-2 py-1 text-white text-xs text-center"
                                    />
                                  </td>
                                  <td className="py-2 px-3">
                                    <div className="relative flex items-center">
                                      <span className="absolute left-2 text-slate-400 text-xs">{currency}</span>
                                      <input
                                        type="number"
                                        min="0"
                                        value={env.amount}
                                        onChange={(e) => handleUpdateEnvelope(idx, 'amount', e.target.value)}
                                        className="w-full bg-[#1b202a] border border-slate-700 rounded pl-6 pr-2 py-1 text-white text-xs"
                                      />
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-right text-purple-300 font-bold">
                                    {currency}{subtotal.toLocaleString()}
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteEnvelope(idx)}
                                      className="p-1 text-slate-500 hover:text-rose-400 rounded cursor-pointer"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                            {mysteryEnvelopes.length === 0 && (
                              <tr>
                                <td colSpan={4} className="py-3 text-center text-slate-500 text-xs">
                                  No envelopes configured. Click "Auto-Balance" or "Add Tier".
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Running Total of the Bounty Pool */}
                      <div className="p-3 bg-[#10141c] rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-slate-400 text-[11px]">Running Envelope Total: </span>
                          <span className="font-mono font-bold text-white text-xs">
                            {currency}{runningEnvelopeTotal.toLocaleString()}
                          </span>
                          <span className="text-slate-500 text-[11px] ml-1.5">
                            (Target Bounty Pool: {currency}{bountyPoolAmount.toLocaleString()})
                          </span>
                        </div>

                        {runningEnvelopeTotal === bountyPoolAmount ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle size={11} /> Balanced
                          </span>
                        ) : runningEnvelopeTotal < bountyPoolAmount ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                            <AlertCircle size={11} /> {currency}{(bountyPoolAmount - runningEnvelopeTotal).toLocaleString()} unallocated
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                            <AlertCircle size={11} /> {currency}{(runningEnvelopeTotal - bountyPoolAmount).toLocaleString()} over target
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: LEVEL SETUP & BLIND SCHEDULE */}
          {activeTab === 'levels' && (
            <div className="space-y-6">
              {/* Level Duration & Break Timing Generator */}
              <div className="p-4 rounded-xl bg-[#15181d] border border-[#2a2f37] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2a2f37] pb-3">
                  <div>
                    <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Clock size={15} className="text-emerald-400" />
                      Level Pacing & Blind Structure Generator
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Configure round pacing and generate an optimal blind progression for your starting stack.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateBlindStructure}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white flex items-center gap-1.5 cursor-pointer transition-colors shadow self-start sm:self-center"
                  >
                    <Sparkles size={14} /> Generate Blind Schedule
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Desired Length
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="24"
                          value={Math.floor((Number(desiredDurationMinutes) || 0) / 60)}
                          onChange={(e) => {
                            const h = Math.max(0, Math.min(24, parseInt(e.target.value, 10) || 0));
                            const m = (Number(desiredDurationMinutes) || 0) % 60;
                            setDesiredDurationMinutes(h * 60 + m);
                          }}
                          className="w-full rounded-lg bg-[#1e2227] border border-[#2a2f37] px-2 py-1.5 pr-6 text-white font-mono focus:outline-none focus:border-[#4a5a4a]"
                        />
                        <span className="absolute right-2 top-1.5 text-slate-400 text-[11px] pointer-events-none">hr</span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="59"
                          step="5"
                          value={(Number(desiredDurationMinutes) || 0) % 60}
                          onChange={(e) => {
                            const h = Math.floor((Number(desiredDurationMinutes) || 0) / 60);
                            const m = Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0));
                            setDesiredDurationMinutes(h * 60 + m);
                          }}
                          className="w-full rounded-lg bg-[#1e2227] border border-[#2a2f37] px-2 py-1.5 pr-6 text-white font-mono focus:outline-none focus:border-[#4a5a4a]"
                        />
                        <span className="absolute right-2 top-1.5 text-slate-400 text-[11px] pointer-events-none">m</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Level Duration
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={levelDurationMinutes}
                        onChange={(e) => setLevelDurationMinutes(e.target.value)}
                        className="w-full rounded-lg bg-[#1e2227] border border-[#2a2f37] px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-[#4a5a4a]"
                      />
                      <span className="absolute right-2.5 top-1.5 text-slate-400 text-xs pointer-events-none">min</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Break Duration
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={breakDurationMinutes}
                        onChange={(e) => setBreakDurationMinutes(e.target.value)}
                        className="w-full rounded-lg bg-[#1e2227] border border-[#2a2f37] px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-[#4a5a4a]"
                      />
                      <span className="absolute right-2.5 top-1.5 text-slate-400 text-xs pointer-events-none">min</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Break Schedule
                    </label>
                    <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#1e2227] p-0.5 border border-[#2a2f37]">
                      <button
                        type="button"
                        onClick={() => setColorUpBreaksOnly(false)}
                        className={`py-1 text-center rounded text-[11px] font-medium cursor-pointer transition-colors ${
                          !colorUpBreaksOnly
                            ? 'bg-[#4a5a4a] text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Interval
                      </button>
                      <button
                        type="button"
                        onClick={() => setColorUpBreaksOnly(true)}
                        className={`py-1 text-center rounded text-[11px] font-medium cursor-pointer transition-colors ${
                          colorUpBreaksOnly
                            ? 'bg-[#4a5a4a] text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Color-ups
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Break Every
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="12"
                        disabled={colorUpBreaksOnly}
                        value={breakEveryLevels}
                        onChange={(e) => setBreakEveryLevels(e.target.value)}
                        className="w-full rounded-lg bg-[#1e2227] border border-[#2a2f37] px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-[#4a5a4a] disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                      <span className="absolute right-2.5 top-1.5 text-slate-400 text-xs pointer-events-none">lvls</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Structure Speed
                    </label>
                    <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#1e2227] p-0.5 border border-[#2a2f37]">
                      <button
                        type="button"
                        onClick={() => setGeneratorSpeed('balanced')}
                        className={`py-1 text-center rounded text-xs font-medium cursor-pointer transition-colors ${
                          generatorSpeed === 'balanced'
                            ? 'bg-[#4a5a4a] text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Balanced
                      </button>
                      <button
                        type="button"
                        onClick={() => setGeneratorSpeed('turbo')}
                        className={`py-1 text-center rounded text-xs font-medium cursor-pointer transition-colors ${
                          generatorSpeed === 'turbo'
                            ? 'bg-[#4a5a4a] text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Turbo
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 bg-[#1e2227] p-2.5 rounded-lg border border-[#2a2f37]">
                  <span>
                    Lowest Chip: <span className="font-mono text-emerald-400 font-bold">{chipDenominations.length ? Math.min(...chipDenominations) : 25}</span> · Starting Stack: <span className="font-mono text-white font-bold">{Number(startingStack).toLocaleString()}</span> ({Math.round(Number(startingStack) / (2 * (chipDenominations.length ? Math.min(...chipDenominations) : 25)))} BBs at Level 1)
                  </span>
                  <span className="text-slate-400">
                    {Number(desiredDurationMinutes) > 0
                      ? `Target: ${Math.floor(desiredDurationMinutes / 60)}h ${String(desiredDurationMinutes % 60).padStart(2, '0')}m · `
                      : 'Standard full schedule · '}
                    {colorUpBreaksOnly
                      ? `Breaks during color-ups only (${breakDurationMinutes}m each)`
                      : `Breaks every ${breakEveryLevels} levels (${breakDurationMinutes}m each)`}
                  </span>
                </div>
              </div>

              {/* Ante Choice */}
              <div className="p-4 rounded-xl bg-[#15181d] border border-[#2a2f37] space-y-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Ante Structure
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'bba', label: 'Big Blind Ante (BBA)', desc: 'BB posts ante for the entire table' },
                    { id: 'traditional', label: 'Traditional Ante', desc: 'Every player posts an individual ante each hand' },
                    { id: 'none', label: 'No Ante', desc: 'Standard blinds only, no ante posted' },
                    { id: 'sb_half_ante', label: 'Big Blind Half Ante', desc: 'Big blind posts a half-size ante (0.5 BB) for table' },
                    { id: 'btn_ante', label: 'Button Ante', desc: 'Button posts the single ante for table' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAnteType(opt.id)}
                      className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        anteType === opt.id
                          ? 'bg-[#4a5a4a] text-white border-transparent shadow'
                          : 'bg-[#1e2227] border-[#2a2f37] text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="font-bold text-xs">{opt.label}</div>
                      <div className="text-[10px] text-slate-400 mt-1 leading-snug">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chip Denomination Picker */}
              <div className="p-4 rounded-xl bg-[#15181d] border border-[#2a2f37]">
                <ChipDenominationPicker
                  selected={chipDenominations}
                  onChange={handleDenomsChange}
                />
              </div>

              {/* Blind Schedule Editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white uppercase tracking-wider">
                    Blind Schedule & Break Intervals
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const lowest = chipDenominations.length ? Math.min(...chipDenominations) : 25;
                      handleScheduleChange(defaultScheduleFor(lowest));
                    }}
                    className="text-xs px-2.5 py-1 rounded-md bg-[#2a2f37] hover:bg-[#363c45] text-slate-300 border border-[#2a2f37] cursor-pointer"
                  >
                    Reset Standard Schedule
                  </button>
                </div>
                <div className="bg-[#15181d] p-3 rounded-xl border border-[#2a2f37] max-h-72 overflow-y-auto">
                  <BlindScheduleEditor
                    schedule={schedule}
                    onChange={handleScheduleChange}
                    anteType={anteType}
                    chipDenominations={chipDenominations}
                  />
                </div>
              </div>

              {/* Total Tournament Length Footer */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-[#17201c] via-[#15181d] to-[#17201c] border border-emerald-500/30 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <Clock size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Total Tournament Length
                    </div>
                    <div className="text-lg font-bold font-mono text-emerald-400 flex items-baseline gap-2">
                      <span>{tournamentDurationInfo.formattedDuration}</span>
                      <span className="text-xs text-slate-400 font-sans font-normal">
                        ({tournamentDurationInfo.totalMinutes} minutes total)
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-left sm:text-right text-xs font-mono text-slate-400 border-t sm:border-t-0 sm:border-l border-[#2a2f37] pt-2 sm:pt-0 sm:pl-4">
                  <div>
                    <span className="text-white font-bold">{tournamentDurationInfo.playCount}</span> Blind Levels ({levelDurationMinutes}m each)
                  </div>
                  <div>
                    <span className="text-white font-bold">{tournamentDurationInfo.breakCount}</span> Scheduled Breaks ({breakDurationMinutes}m each)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PLAYERS ROSTER */}
          {activeTab === 'players' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#15181d] border border-[#2a2f37] space-y-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Registration Method
                </label>
                <select
                  value={nameEntryMode}
                  onChange={(e) => setNameEntryMode(e.target.value)}
                  className="w-full rounded-lg bg-[#1e2227] border border-[#2a2f37] px-3.5 py-2 text-white text-sm focus:outline-none focus:border-[#4a5a4a]"
                >
                  <option value="now">Enter player names now (Default)</option>
                  <option value="itm">Enter when ITM / approaching money</option>
                </select>
                <div className="text-[11px] text-slate-400">
                  {nameEntryMode === 'now'
                    ? 'Enter or paste roster names now. The "Enter Names" button will be hidden during the tournament.'
                    : 'Field count only at start. Use "Field -" when players bust, then use "Enter Names" when approaching the money.'}
                </div>
              </div>

              {nameEntryMode === 'now' ? (
                <div className="p-4 rounded-xl bg-[#15181d] border border-[#2a2f37] space-y-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Player Names Roster
                  </label>
                  <div className="text-xs text-slate-400 mb-2">
                    Enter player names (one per line or separated by commas). The field player count will automatically update based on the number of names entered.
                  </div>
                  <textarea
                    rows={6}
                    value={playerNamesInput}
                    onChange={(e) => handlePlayerNamesChange(e.target.value)}
                    placeholder="e.g.&#10;Alice&#10;Bob&#10;Charlie&#10;Dave"
                    className="w-full rounded-lg bg-[#1e2227] border border-[#2a2f37] p-3 text-white text-xs font-mono focus:outline-none focus:border-[#4a5a4a]"
                  />
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#15181d] border border-[#2a2f37] space-y-3">
                  <div className="text-xs font-semibold text-white">
                    Approaching Money Mode Selected
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Total starting field is set to <span className="text-emerald-400 font-bold">{totalPlayers} players</span>. Placeholder slots (Player 1 to Player {totalPlayers}) are generated for now.
                  </p>
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-slate-300 font-medium">Starting Field Size:</label>
                    <input
                      type="number"
                      min="2"
                      max="5000"
                      value={totalPlayers}
                      onChange={(e) => setTotalPlayers(Math.max(2, parseInt(e.target.value) || 2))}
                      className="w-24 rounded-lg bg-[#1e2227] border border-[#2a2f37] px-2.5 py-1.5 text-white text-xs font-mono focus:border-[#4a5a4a]"
                    />
                  </div>
                  <p className="text-[11px] text-amber-300/80">
                    You can use the "Enter Names" button during the tournament when approaching the money to paste the active players.
                  </p>
                </div>
              )}

              {/* Live Roster Preview */}
              <div className="p-4 rounded-xl bg-[#15181d] border border-[#2a2f37] space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-300 font-semibold">
                  <span>Current Field Roster ({parsedPlayerNames.length} Players):</span>
                  <span className="text-emerald-400 text-[11px]">
                    {nameEntryMode === 'now' && playerNamesInput.split(/\n|,/).filter((s) => s.trim().length > 0).length > 0
                      ? `${parsedPlayerNames.length} named entries`
                      : `${parsedPlayerNames.length} player slots`}
                  </span>
                </div>
                {parsedPlayerNames.length > 10 ? (
                  <div className="py-4 text-center text-sm font-bold text-white bg-[#1e2227] rounded-xl border border-[#2a2f37]">
                    {parsedPlayerNames.length} Players Registered
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-44 overflow-y-auto pr-1">
                    {parsedPlayerNames.map((pName, i) => (
                      <div
                        key={i}
                        className="px-2.5 py-1.5 rounded-lg bg-[#1e2227] border border-[#2a2f37] text-xs font-mono truncate text-slate-300"
                      >
                        <span className="text-slate-500 mr-1.5">#{i + 1}</span>
                        {pName}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: PAYOUT STRUCTURE */}
          {activeTab === 'payouts' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Trophy size={16} className="text-amber-400" />
                    Payout Structure (Optional & Flexible)
                  </h3>
                  <div className="text-xs text-slate-400">
                    Ranks can be specific number (1), range (3-5), or bracket (next 2% of field)
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleApplyDefaultPayouts}
                    className="px-2.5 py-1 rounded-md text-xs bg-[#2a2f37] hover:bg-[#363c45] text-slate-300 border border-[#2a2f37] cursor-pointer"
                  >
                    Reset Defaults
                  </button>
                  <button
                    type="button"
                    onClick={handleAddPayoutRow}
                    className="px-2.5 py-1 rounded-md text-xs bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} /> Add Row
                  </button>
                </div>
              </div>

              {/* Auto-Generate ITM Payout Structure */}
              <div className="p-3.5 rounded-xl bg-[#15181d] border border-[#2a2f37] space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-white">Places in the Money Generator</div>
                    <div className="text-[11px] text-slate-400">
                      Generate condensed payout structure for {numPlayers || 10} players (default: 15% of field = {Math.max(1, Math.round((numPlayers || 10) * 0.15))} places). Creates single places for top spots and standard range brackets for deep fields with realistic exponential top payouts.
                    </div>
                  </div>
                  <div className="flex items-center rounded-lg border border-[#2a2f37] overflow-hidden shrink-0 self-start sm:self-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (itmInputMode !== 'places') {
                          setItmInputMode('places');
                          setItmInputValue(String(resolvedItmTarget.places));
                        }
                      }}
                      className={`px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors ${
                        itmInputMode === 'places'
                          ? 'bg-[#4a5a4a] text-white'
                          : 'bg-[#1e2227] text-slate-400 hover:text-white'
                      }`}
                    >
                      # Places
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (itmInputMode !== 'percent') {
                          setItmInputMode('percent');
                          setItmInputValue(itmTouched ? String(resolvedItmTarget.pct) : '15');
                        }
                      }}
                      className={`px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors ${
                        itmInputMode === 'percent'
                          ? 'bg-[#4a5a4a] text-white'
                          : 'bg-[#1e2227] text-slate-400 hover:text-white'
                      }`}
                    >
                      % of Field
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={!itmTouched && itmInputMode === 'places' ? String(resolvedItmTarget.places) : itmInputValue}
                      onChange={(e) => {
                        setItmTouched(true);
                        setItmInputValue(e.target.value);
                      }}
                      placeholder={itmInputMode === 'percent' ? '15' : String(Math.max(1, Math.round((numPlayers || 10) * 0.15)))}
                      className="w-24 bg-[#1e2227] border border-[#2a2f37] rounded-lg px-2.5 py-1.5 text-white text-xs font-mono text-right focus:outline-none focus:border-[#4a5a4a]"
                    />
                    <span className="text-xs text-slate-400">
                      {itmInputMode === 'percent' ? '% of field' : 'places'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    → Pays {resolvedItmTarget.places} of {numPlayers || 10} ({resolvedItmTarget.pct}%)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleGeneratePayouts(payoutSteepness)}
                    className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Sparkles size={13} /> Generate
                  </button>
                </div>

                {/* Steepness Slider */}
                <div className="pt-2 border-t border-[#2a2f37] space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                      Payout Steepness:
                      <span className="text-emerald-400 font-mono font-bold">
                        {payoutSteepness === 1 && '1 (Balanced · Deeper Min-Cashes)'}
                        {payoutSteepness === 2 && '2 (Semi-Balanced)'}
                        {payoutSteepness === 3 && '3 (Standard · WSOP Style)'}
                        {payoutSteepness === 4 && '4 (Top-Heavy)'}
                        {payoutSteepness === 5 && '5 (Winner-Heavy · Max 1st Place)'}
                      </span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Level {payoutSteepness}/5
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={payoutSteepness}
                    onChange={(e) => {
                      const newS = Number(e.target.value);
                      setPayoutSteepness(newS);
                      handleGeneratePayouts(newS);
                    }}
                    className="w-full h-1.5 bg-[#2a2f37] rounded-lg appearance-none cursor-pointer accent-[#4a5a4a]"
                  />
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-sans">
                    <span>Balanced (More $ to deeper spots)</span>
                    <span>Standard</span>
                    <span>Top-Heavy (More $ to 1st)</span>
                  </div>
                </div>
              </div>

              {/* Simultaneous Eliminations Rule */}
              <div className="p-3.5 rounded-xl bg-[#15181d] border border-[#2a2f37] flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">Simultaneous Eliminations Rule</div>
                  <div className="text-[11px] text-slate-400">
                    {splitSimultaneousTies
                      ? 'Split Mode: Splits pooled prize money of overlapping brackets evenly among tied players'
                      : 'Stack-Rank Mode: Ranks tied players linearly by chip stacks; larger stack gets higher payout'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSplitSimultaneousTies(!splitSimultaneousTies)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    splitSimultaneousTies
                      ? 'bg-[#4a5a4a] text-white'
                      : 'bg-[#2a2f37] text-slate-300'
                  }`}
                >
                  {splitSimultaneousTies ? 'Split Evenly' : 'Rank by Stack'}
                </button>
              </div>

              {/* Payout Rows */}
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {payoutConfig.map((row, idx) => {
                  const rankVal =
                    typeof row.rank === 'object' && row.rank !== null
                      ? row.rank.value ?? row.rank.start ?? '1'
                      : row.rank;
                  const payoutType = row.payout?.type || 'percent';
                  const payoutVal = row.payout?.value ?? 0;
                  const rankParsed = parseRankSpec(rankVal, numPlayers || 10, idx);
                  const isRange = rankParsed.count > 1;
                  const perPlayerPct = isRange && payoutType === 'percent' ? (payoutVal / rankParsed.count) : payoutVal;
                  const perPlayerFixed = isRange && payoutType === 'fixed' ? Math.round(payoutVal / rankParsed.count) : payoutVal;

                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-[#15181d] p-2.5 rounded-lg border border-[#2a2f37] text-xs font-mono"
                    >
                      <div className="w-28">
                        <input
                          type="text"
                          value={rankVal}
                          onChange={(e) => handleUpdatePayoutRow(idx, 'rank', e.target.value)}
                          placeholder="e.g. 1 or 10-12"
                          className="w-full bg-[#1e2227] border border-[#2a2f37] rounded-lg px-2 py-1.5 text-white text-xs focus:border-[#4a5a4a]"
                        />
                      </div>
                      <div className="flex items-center gap-1 flex-1">
                        <select
                          value={payoutType}
                          onChange={(e) => handleUpdatePayoutRow(idx, 'type', e.target.value)}
                          className="bg-[#1e2227] border border-[#2a2f37] rounded-lg px-2 py-1.5 text-slate-300 text-xs focus:border-[#4a5a4a]"
                        >
                          <option value="percent">% of Pool</option>
                          <option value="fixed">Fixed {currency}</option>
                        </select>
                        <input
                          type="number"
                          step="any"
                          value={payoutVal}
                          onChange={(e) => handleUpdatePayoutRow(idx, 'value', e.target.value)}
                          className="w-24 bg-[#1e2227] border border-[#2a2f37] rounded-lg px-2 py-1.5 text-white text-xs text-right focus:border-[#4a5a4a]"
                        />
                        <span className="text-slate-400">
                          {payoutType === 'percent' ? '%' : currency}
                        </span>
                        {isRange && (
                          <span className="text-[11px] text-slate-400 ml-1 font-sans">
                            ({payoutType === 'percent'
                              ? `${perPlayerPct % 1 === 0 ? perPlayerPct.toFixed(0) : perPlayerPct.toFixed(2).replace(/\.?0+$/, '')}% ea`
                              : `${currency}${perPlayerFixed.toLocaleString()} ea`} · {rankParsed.count} spots)
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeletePayoutRow(idx)}
                        className="p-1 text-slate-500 hover:text-rose-400 rounded cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Live Preview List */}
              <div className="bg-[#15181d] p-3.5 rounded-xl border border-[#2a2f37]">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Calculated Prize Ladder Preview (Total Pool: {currency}{adjustedDisplayTotalPool.toLocaleString()})
                  </span>
                  {isBounty && (
                    <span className="text-slate-400 font-normal text-[10px]">
                      Rank Pool: <span className="text-emerald-400 font-mono font-bold">{currency}{ladderTotalAmount.toLocaleString()}</span> · Bounty Pool: <span className="text-amber-400 font-mono font-bold">{currency}{bountyPoolAmount.toLocaleString()}</span>
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  {consolidatedPreview.map((p, i) => {
                    const pctVal = p.isBracket ? p.perPlayerPercent : p.percent;
                    const pctStr = pctVal % 1 === 0 ? pctVal.toFixed(0) : pctVal.toFixed(2).replace(/\.?0+$/, '');
                    const amtVal = p.isBracket ? p.perPlayerAmount : p.totalAmount;
                    const labelStr = p.isBracket ? `${p.bracketStart}-${p.bracketEnd}` : (p.label || `${p.place}`);
                    return (
                      <div
                        key={i}
                        className="p-1.5 bg-[#1e2227] rounded-lg border border-[#2a2f37] flex items-center justify-between gap-1 text-[11px]"
                      >
                        <span className="text-slate-400 truncate">{labelStr}:</span>
                        <span className="text-emerald-400 font-bold truncate">
                          {currency}{amtVal.toLocaleString()} ({pctStr}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-[#2a2f37] mt-6">
            <div className="text-xs text-slate-500">
              {tablesCount} Tables · {totalPlayers} Players · {currency}{buyIn} Buy-in
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-[#2a2f37] hover:bg-[#363c45] text-slate-300 text-sm font-medium cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-[#4a5a4a] hover:bg-[#5a6a5a] text-white text-sm font-semibold cursor-pointer transition-colors shadow"
              >
                Save & Apply Structure
              </button>
            </div>
          </div>
        </form>
      </div>

      {showSavedStructures && (
        <SavedStructuresDialog
          getCurrentData={buildStructureData}
          onLoad={applyStructure}
          onClose={() => setShowSavedStructures(false)}
        />
      )}
    </div>
  );
}

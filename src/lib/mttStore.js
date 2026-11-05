import { useSyncExternalStore } from 'react';
import { defaultScheduleFor, defaultDenomsFor } from './tournamentStructures';
import { calculateTournamentPayouts, getDefaultPayoutConfig, resolveSimultaneousEliminations } from './payoutEngine';
import { publishLive } from './liveSync';
import { parseAmount } from './poker';

function isBreak(lvl) {
  if (!lvl) return false;
  return (
    lvl.type === 'break' ||
    lvl.kind === 'break' ||
    lvl.isBreak === true ||
    String(lvl.name || '').toLowerCase().includes('break')
  );
}

function getLevelNum(sched, idx) {
  if (!sched || !Array.isArray(sched) || idx < 0) return 1;
  let c = 0;
  for (let i = 0; i <= idx && i < sched.length; i++) {
    if (!isBreak(sched[i])) c++;
  }
  return Math.max(1, c);
}

function parseVal(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  const p = parseAmount(v);
  if (p != null) return p;
  const clean = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return isNaN(clean) ? 0 : clean;
}

export const generateRoster = (playerNames = [], totalCount = 0) => {
  const count = Math.max(0, Number(totalCount) || 0);
  const roster = [];
  for (let i = 1; i <= count; i++) {
    const custom = playerNames[i - 1];
    roster.push({
      id: i,
      name: (custom && String(custom).trim()) || `Player ${i}`,
    });
  }
  return roster;
};

export const defaultMTT = () => {
  const tablesCount = 1;
  const totalPlayers = 10;
  const startingStack = 5000; // 100 BB in level 1 (50 BB)
  const buyIn = 100;
  const payoutConfig = getDefaultPayoutConfig(tablesCount);
  const payouts = calculateTournamentPayouts({
    totalPlayers,
    buyIn,
    totalPool: totalPlayers * buyIn,
    payoutConfig,
    tablesCount,
  });

  return {
    active: false,
    id: '',
    name: 'Championship Tournament',
    nameEntryMode: 'now', // 'now' | 'itm'
    buyIn,
    currency: '$',
    totalPlayers: 10,
    remainingPlayers: 10,
    reEntries: 0,
    totalRebuys: 0,
    startingStack,
    tablesCount: 1,
    totalChips: 10 * startingStack,
    totalPrizePool: 10 * buyIn,
    bountyPercent: 50,
    bountyPool: 0,
    rankPool: 10 * buyIn,
    mysteryBountyConfig: {
      startPhase: 'itm',
      startLevel: 8,
      startFieldSize: 18,
      envelopes: [],
    },
    isHandForHand: false,
    lateRegEnabled: true,
    lateRegLevel: 4,
    tournamentType: 'freezeout', // 'freezeout' | 'reentry' | 'rebuy' | 'bounty' | 'mystery bounty'
    maxReEntries: 0, // 0 for unlimited / freezeout
    rebuyCost: 100,
    rebuyChips: 5000,
    rebuyRules: {
      timeCapEnabled: true,
      timeCapLevel: 4,
      maxRebuysEnabled: false,
      maxRebuys: 0,
      stackCapEnabled: true,
      stackCapUnit: 'chips', // 'chips' | 'bb'
      stackCapValue: 5000,
    },
    anteType: 'bba', // 'none' | 'traditional' | 'bba'
    chipDenominations: defaultDenomsFor(25),
    players: generateRoster([], 10),
    splitSimultaneousTies: true, // boolean toggle for simultaneous eliminations
    payoutConfig,
    payouts,
    eliminations: [],
    clock: {
      level: 0,
      secondsLeft: 900,
      isRunning: false,
      levelDurationMinutes: 15,
      blindSchedule: defaultScheduleFor(25),
    },
  };
};

const STORAGE_KEY = 'mtt_tournament_state_v3';
const STORAGE_KEY_CATALOG = 'mtt_tournaments_catalog_v2';
const STORAGE_KEY_ACTIVE_ID = 'mtt_active_tournament_id_v2';

export function loadCatalog() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CATALOG);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const clean = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (v && v.id && v.active) {
            clean[k] = v;
          }
        }
        return clean;
      }
    }
  } catch (e) {
    console.warn('Failed to load MTT catalog', e);
  }
  return {};
}

export function saveCatalog(cat) {
  try {
    localStorage.setItem(STORAGE_KEY_CATALOG, JSON.stringify(cat));
  } catch (e) {
    console.warn('Failed to persist MTT catalog', e);
  }
}

function loadState() {
  try {
    const catalog = loadCatalog();
    const activeId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
    if (activeId && catalog[activeId] && catalog[activeId].active) {
      return catalog[activeId];
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.totalPlayers === 'number' && parsed.active) {
        const id = parsed.id || `mtt_${Date.now()}`;
        parsed.id = id;
        catalog[id] = parsed;
        saveCatalog(catalog);
        localStorage.setItem(STORAGE_KEY_ACTIVE_ID, id);
        return parsed;
      }
    }
    const existing = Object.values(catalog).filter((t) => t && t.active);
    if (existing.length > 0) {
      const sorted = existing.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      return sorted[0];
    }
  } catch (e) {
    console.warn('Failed to load MTT state', e);
  }
  return defaultMTT();
}

let state = loadState();
const listeners = new Set();

const emit = () => {
  if (state?.id && state.active) {
    state.updatedAt = Date.now();
    try {
      const catalog = loadCatalog();
      catalog[state.id] = state;
      saveCatalog(catalog);
      localStorage.setItem(STORAGE_KEY_ACTIVE_ID, state.id);
    } catch (e) {
      console.warn('Failed to save to MTT catalog', e);
    }
  }
  try {
    if (state?.active) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {
    console.warn('Failed to persist MTT state', e);
  }
  try {
    publishLive({ director: state });
  } catch (e) {}
  listeners.forEach((l) => l());
};

let clockTickerInterval = null;

function hasAnyRunningTimer() {
  if (state?.active && state?.clock?.isRunning) return true;
  const cat = loadCatalog();
  return Object.values(cat).some((t) => t && t.active && t.clock?.isRunning);
}

function syncTicker() {
  if (hasAnyRunningTimer()) {
    if (!clockTickerInterval) {
      clockTickerInterval = setInterval(() => {
        let changed = false;
        if (state?.active && state?.clock?.isRunning) {
          const cur = state.clock;
          if (cur.secondsLeft > 1) {
            state = {
              ...state,
              clock: {
                ...state.clock,
                secondsLeft: cur.secondsLeft - 1,
              },
            };
          } else {
            const sched = state.clock.blindSchedule || [];
            const curLevel = state.clock.level || 0;
            const nextIdx = curLevel + 1;
            const nextObj = sched[nextIdx];
            const duration = parseVal(nextObj?.durationMinutes || nextObj?.minutes) || state.clock.levelDurationMinutes || 15;
            state = {
              ...state,
              clock: {
                ...state.clock,
                level: nextIdx,
                secondsLeft: duration * 60,
              },
            };
          }
          changed = true;
        }

        // Also tick other running tournaments in background catalog
        try {
          const cat = loadCatalog();
          let catChanged = false;
          for (const [id, t] of Object.entries(cat)) {
            if (id !== state?.id && t && t.active && t.clock?.isRunning) {
              const cur = t.clock;
              if (cur && cur.secondsLeft > 1) {
                cur.secondsLeft -= 1;
              } else if (cur) {
                const sched = cur.blindSchedule || [];
                const curLevel = cur.level || 0;
                const nextIdx = curLevel + 1;
                const nextObj = sched[nextIdx];
                const duration = parseVal(nextObj?.durationMinutes || nextObj?.minutes) || cur.levelDurationMinutes || 15;
                cur.level = nextIdx;
                cur.secondsLeft = duration * 60;
              }
              catChanged = true;
            }
          }
          if (catChanged) {
            saveCatalog(cat);
            changed = true;
          }
        } catch (e) {}

        if (changed) {
          emit();
        }
      }, 1000);
    }
  } else {
    if (clockTickerInterval) {
      clearInterval(clockTickerInterval);
      clockTickerInterval = null;
    }
  }
}

export const mttStore = {
  get: () => state,
  subscribe: (l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  createDirectorTournament: (data = {}) => {
    const {
      name = 'Championship Tournament',
      totalPlayers = 0,
      startingStack = 10000,
      tablesCount = 1,
      buyIn = 100,
      currency = '$',
      levelDurationMinutes = 15,
      blindSchedule = null,
      lateRegEnabled = true,
      lateRegLevel = 4,
      tournamentType = 'freezeout',
      maxReEntries = 0,
      rebuyCost = null,
      rebuyChips = null,
      rebuyRules = null,
      anteType = 'bba',
      chipDenominations = null,
      playerNames = [],
      payoutConfig = null,
      splitSimultaneousTies = true,
      bountyPercent = 50,
      bountyPool = null,
      rankPool = null,
      mysteryBountyConfig = null,
    } = data;

    const lowestChip = chipDenominations && chipDenominations.length ? Math.min(...chipDenominations) : 25;
    const schedule = blindSchedule && blindSchedule.length ? blindSchedule : defaultScheduleFor(lowestChip);
    const lvl1BB = schedule[0]?.bigBlind ? parseVal(schedule[0].bigBlind) : 50;
    const default100BB = lvl1BB * 100;
    const sStack = startingStack != null ? Math.max(100, Number(startingStack) || default100BB) : default100BB;
    const numPlayers = Math.max(2, Number(totalPlayers) || (playerNames?.length || 10));
    const tCount = Math.max(1, Number(tablesCount) || 1);
    const bIn = Math.max(0, Number(buyIn) || 100);
    const levelMins = Math.max(1, Number(levelDurationMinutes) || 15);
    const cfg = payoutConfig && payoutConfig.length ? payoutConfig : getDefaultPayoutConfig(tCount);

    const roster = generateRoster(playerNames, numPlayers);
    const totalPrize = numPlayers * bIn;

    const isBounty = tournamentType === 'bounty' || tournamentType === 'mystery bounty';
    const bPercent = isBounty ? (bountyPercent != null ? Number(bountyPercent) : 50) : 0;
    const bPool = isBounty ? (bountyPool != null ? Number(bountyPool) : Math.round((totalPrize * bPercent) / 100)) : 0;
    const rPool = isBounty ? (rankPool != null ? Number(rankPool) : totalPrize - bPool) : totalPrize;

    const payouts = calculateTournamentPayouts({
      totalPlayers: numPlayers,
      buyIn: bIn,
      totalPool: rPool,
      payoutConfig: cfg,
      tablesCount: tCount,
      splitSimultaneousTies,
    });

    const tourneyId = (state?.id && !state.active) ? state.id : (data.id || `mtt_${Date.now()}`);

    state = {
      active: true,
      id: tourneyId,
      name,
      nameEntryMode: data.nameEntryMode || 'now',
      totalPlayers: numPlayers,
      remainingPlayers: numPlayers,
      startingStack: sStack,
      tablesCount: tCount,
      buyIn: bIn,
      currency,
      reEntries: 0,
      totalRebuys: 0,
      totalChips: numPlayers * sStack,
      totalPrizePool: totalPrize,
      bountyPercent: bPercent,
      bountyPool: bPool,
      rankPool: rPool,
      mysteryBountyConfig: mysteryBountyConfig || {
        startPhase: 'itm',
        startLevel: 8,
        startFieldSize: 18,
        envelopes: [],
      },
      isHandForHand: false,
      lateRegEnabled: !!lateRegEnabled,
      lateRegLevel: Number(lateRegLevel) || 4,
      tournamentType: tournamentType || 'freezeout',
      maxReEntries: Number(maxReEntries) || 0,
      rebuyCost: rebuyCost != null ? Number(rebuyCost) : bIn,
      rebuyChips: rebuyChips != null ? Number(rebuyChips) : sStack,
      rebuyRules: rebuyRules || {
        timeCapEnabled: true,
        timeCapLevel: 4,
        maxRebuysEnabled: false,
        maxRebuys: 0,
        stackCapEnabled: true,
        stackCapUnit: 'chips',
        stackCapValue: sStack,
      },
      anteType: anteType || 'bba',
      chipDenominations: chipDenominations || defaultDenomsFor(lowestChip),
      players: roster,
      splitSimultaneousTies: !!splitSimultaneousTies,
      payoutConfig: cfg,
      payouts,
      eliminations: [],
      clock: {
        level: 0,
        secondsLeft: levelMins * 60,
        levelDurationMinutes: levelMins,
        isRunning: false,
        blindSchedule: schedule,
      },
    };
    emit();
    syncTicker();
    return state;
  },

  // Clock Actions
  updateClock: (partial) => {
    state = {
      ...state,
      clock: { ...state.clock, ...partial },
    };
    emit();
  },

  toggleTimer: () => {
    state = {
      ...state,
      active: true,
      clock: { ...state.clock, isRunning: !state.clock.isRunning },
    };
    emit();
    syncTicker();
  },

  pauseTimer: () => {
    state = {
      ...state,
      clock: { ...state.clock, isRunning: false },
    };
    emit();
    syncTicker();
  },

  resumeTimer: () => {
    state = {
      ...state,
      active: true,
      clock: { ...state.clock, isRunning: true },
    };
    emit();
    syncTicker();
  },

  adjustSeconds: (deltaSeconds) => {
    const cur = state.clock.secondsLeft || 0;
    const newSeconds = Math.max(0, cur + deltaSeconds);
    state = {
      ...state,
      clock: { ...state.clock, secondsLeft: newSeconds },
    };
    emit();
  },

  setLevel: (levelIndex) => {
    const sched = state.clock.blindSchedule || [];
    const maxIdx = Math.max(0, sched.length - 1);
    const targetIdx = Math.max(0, Math.min(maxIdx, Number(levelIndex) || 0));
    const targetObj = sched[targetIdx];
    const duration = parseVal(targetObj?.durationMinutes || targetObj?.minutes) || state.clock.levelDurationMinutes || 15;

    state = {
      ...state,
      clock: {
        ...state.clock,
        level: targetIdx,
        secondsLeft: duration * 60,
      },
    };
    emit();
  },

  nextLevel: () => {
    const sched = state.clock.blindSchedule || [];
    const curLevel = state.clock.level || 0;
    const nextIdx = curLevel + 1;

    if (nextIdx < sched.length) {
      const nextObj = sched[nextIdx];
      const duration = parseVal(nextObj?.durationMinutes || nextObj?.minutes) || state.clock.levelDurationMinutes || 15;
      state = {
        ...state,
        clock: {
          ...state.clock,
          level: nextIdx,
          secondsLeft: duration * 60,
        },
      };
      emit();
    } else {
      state = {
        ...state,
        clock: {
          ...state.clock,
          level: nextIdx,
          secondsLeft: (state.clock.levelDurationMinutes || 15) * 60,
        },
      };
      emit();
    }
  },

  preplanLevel: (newLevel) => {
    const sched = [...(state.clock.blindSchedule || [])];
    const newEntry = {
      type: newLevel.isBreak ? 'break' : 'level',
      level: sched.length + 1,
      smallBlind: Number(newLevel.smallBlind) || 1000,
      bigBlind: Number(newLevel.bigBlind) || 2000,
      ante: Number(newLevel.ante) || 0,
      durationMinutes: Number(newLevel.durationMinutes) || state.clock.levelDurationMinutes || 15,
      minutes: Number(newLevel.durationMinutes) || state.clock.levelDurationMinutes || 15,
      isBreak: !!newLevel.isBreak,
      name: newLevel.name || (newLevel.isBreak ? 'Break' : `Level ${sched.length + 1}`),
    };
    sched.push(newEntry);
    state = {
      ...state,
      clock: {
        ...state.clock,
        blindSchedule: sched,
      },
    };
    emit();
  },

  // Hand For Hand
  setHandForHand: (enabled) => {
    state = {
      ...state,
      isHandForHand: !!enabled,
    };
    emit();
  },

  toggleHandForHand: () => {
    state = {
      ...state,
      isHandForHand: !state.isHandForHand,
    };
    emit();
  },

  toggleLateReg: () => {
    state = {
      ...state,
      lateRegEnabled: !state.lateRegEnabled,
    };
    emit();
  },

  // Field Adjustments
  manualAdjustRemainingPlayers: (delta) => {
    const totalEntries = state.totalPlayers + (state.reEntries || 0);
    const cur = state.remainingPlayers ?? totalEntries;
    if (delta < 0 && cur <= 2) {
      return; // Cannot reduce below 2 manually (heads-up); bust must be recorded
    }
    const updated = Math.max(1, Math.min(totalEntries, cur + delta));
    const isEnded = updated === 1;

    let updatedPlayers = state.players || [];
    if (delta < 0) {
      // If active players list has uneliminated generic/placeholder players, mark the last one eliminated
      const activeIdx = updatedPlayers.map((p, idx) => (!p.eliminated && p.status !== 'eliminated' ? idx : -1)).filter((idx) => idx >= 0);
      if (activeIdx.length > 0 && activeIdx.length > updated) {
        const lastActiveIdx = activeIdx[activeIdx.length - 1];
        updatedPlayers = updatedPlayers.map((p, idx) => (idx === lastActiveIdx ? { ...p, status: 'eliminated', eliminated: true } : p));
      }
    }

    state = {
      ...state,
      players: updatedPlayers,
      remainingPlayers: updated,
      isEnded: isEnded || state.isEnded,
      clock: isEnded ? { ...state.clock, isRunning: false } : state.clock,
    };
    emit();
  },

  updateRosterNames: (names = []) => {
    const cleanNames = names.map((n) => String(n || '').trim()).filter(Boolean);
    if (cleanNames.length === 0) return;
    const curRemaining = cleanNames.length;
    const elimPlayers = (state.players || []).filter(
      (p) => p.status === 'eliminated' || p.eliminated
    );
    const updatedActive = cleanNames.map((name, i) => ({
      id: `active_p_${Date.now()}_${i + 1}`,
      name,
      status: 'active',
      eliminated: false,
      stack: state.startingStack || 5000,
    }));
    state = {
      ...state,
      remainingPlayers: curRemaining,
      players: [...updatedActive, ...elimPlayers],
    };
    emit();
  },

  recordBust: ({ players = [], bustCount = 1, stackRankedOrder = [] }) => {
    const currentRemaining = state.remainingPlayers;
    const count = players.length > 0 ? players.length : Math.max(1, Number(bustCount) || 1);
    const newRemaining = Math.max(1, currentRemaining - count);
    const startPlace = newRemaining + 1;
    const isEnded = newRemaining === 1;

    const listToProcess =
      players.length > 0
        ? stackRankedOrder.length > 0
          ? stackRankedOrder
          : players
        : Array.from({ length: count }, (_, i) => ({
            id: `player_bust_${Date.now()}_${i}`,
            name: `Player (Place ${startPlace + (count - 1 - i)})`,
          }));

    const resolved = resolveSimultaneousEliminations({
      eliminatedPlayers: listToProcess,
      finishPlacesStart: startPlace,
      payouts: state.payouts || [],
      splitTies: state.splitSimultaneousTies,
    });

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newElims = resolved.map((p) => ({
      id: p.id || `bust_${Date.now()}`,
      name: p.name || 'Player',
      place: p.place,
      placeLabel: p.placeLabel,
      payout: p.payout || 0,
      time: timestamp,
      tied: !!p.tied,
    }));

    const bustedIds = new Set(listToProcess.map((p) => String(p.id)));
    const bustedNames = new Set(listToProcess.map((p) => String(p.name || '').trim().toLowerCase()).filter(Boolean));

    const updatedPlayers = (state.players || []).map((p) => {
      const matchId = bustedIds.has(String(p.id));
      const matchName = p.name && bustedNames.has(String(p.name).trim().toLowerCase());
      if (matchId || matchName) {
        return { ...p, status: 'eliminated', eliminated: true };
      }
      return p;
    });

    state = {
      ...state,
      players: updatedPlayers,
      remainingPlayers: newRemaining,
      eliminations: [...newElims, ...(state.eliminations || [])],
      isEnded: isEnded || state.isEnded,
      clock: isEnded ? { ...state.clock, isRunning: false } : state.clock,
    };
    emit();
  },

  endTournament: () => {
    state = {
      ...state,
      isEnded: true,
      clock: { ...state.clock, isRunning: false },
    };
    emit();
  },

  /**
   * Late Reg Player
   */
  lateRegPlayer: ({ name = '' } = {}) => {
    const sched = state.clock?.blindSchedule || [];
    const curIdx = state.clock?.level || 0;
    const curLvlNum = getLevelNum(sched, curIdx);
    const cutoff = state.lateRegLevel || 4;
    if (!state.lateRegEnabled || curLvlNum > cutoff) {
      console.warn('Late registration is closed');
      return { success: false, reason: 'Late registration is closed' };
    }

    const newTotalPlayers = state.totalPlayers + 1;
    const newRemaining = (state.remainingPlayers || state.totalPlayers) + 1;
    const newTotalEntries = newTotalPlayers + (state.reEntries || 0);
    const newPrizePool = (state.totalPrizePool || state.totalPlayers * state.buyIn) + state.buyIn;
    const newChips = state.totalChips + state.startingStack;

    const cleanName = (name && String(name).trim()) || `Player ${newTotalPlayers}`;
    const newPlayer = { id: newTotalPlayers, name: cleanName, isLateReg: true };

    const newPayouts = calculateTournamentPayouts({
      totalPlayers: newTotalEntries,
      buyIn: state.buyIn,
      totalPool: newPrizePool,
      payoutConfig: state.payoutConfig,
      tablesCount: state.tablesCount,
      splitSimultaneousTies: state.splitSimultaneousTies,
    });

    state = {
      ...state,
      totalPlayers: newTotalPlayers,
      remainingPlayers: newRemaining,
      totalChips: newChips,
      totalPrizePool: newPrizePool,
      players: [...(state.players || []), newPlayer],
      payouts: newPayouts,
    };
    emit();
    return { success: true, player: newPlayer };
  },

  /**
   * Re-Entry Player:
   * "add 1 to field remaining and entry count, adjust prize pool"
   */
  reEntryPlayer: ({ name = '' } = {}) => {
    if (state.tournamentType === 'freezeout') {
      return { success: false, error: 'Re-entry is not permitted in a freezeout tournament.' };
    }

    const newReEntries = (state.reEntries || 0) + 1;
    const newRemaining = (state.remainingPlayers || state.totalPlayers) + 1;
    const newTotalEntries = state.totalPlayers + newReEntries;
    const newPrizePool = (state.totalPrizePool || state.totalPlayers * state.buyIn) + state.buyIn;
    const newChips = state.totalChips + state.startingStack;

    const isBounty = state.tournamentType === 'bounty' || state.tournamentType === 'mystery bounty';
    const bPct = isBounty ? (state.bountyPercent != null ? Number(state.bountyPercent) : 50) : 0;
    const bPool = isBounty ? Math.round((newPrizePool * bPct) / 100) : 0;
    const rPool = isBounty ? newPrizePool - bPool : newPrizePool;

    const newPayouts = calculateTournamentPayouts({
      totalPlayers: newTotalEntries,
      buyIn: state.buyIn,
      totalPool: rPool,
      payoutConfig: state.payoutConfig,
      tablesCount: state.tablesCount,
      splitSimultaneousTies: state.splitSimultaneousTies,
    });

    state = {
      ...state,
      reEntries: newReEntries,
      remainingPlayers: newRemaining,
      totalChips: newChips,
      totalPrizePool: newPrizePool,
      bountyPool: bPool,
      rankPool: rPool,
      payouts: newPayouts,
    };
    emit();
    return { success: true };
  },

  /**
   * Re-Buy Player:
   * "do not change field remaining and entry count, adjust prize pool"
   */
  rebuyPlayer: ({ name = '', cost = null, chips = null } = {}) => {
    if (state.tournamentType === 'freezeout') {
      return { success: false, error: 'Rebuys are not permitted in a freezeout tournament.' };
    }

    const rebuyCost = cost != null ? Number(cost) : (state.rebuyCost ?? state.buyIn);
    const rebuyChips = chips != null ? Number(chips) : (state.rebuyChips ?? state.startingStack);

    const newTotalRebuys = (state.totalRebuys || 0) + 1;
    const newPrizePool = (state.totalPrizePool || (state.totalPlayers + (state.reEntries || 0)) * state.buyIn) + rebuyCost;
    const newChips = state.totalChips + rebuyChips;
    const totalEntries = state.totalPlayers + (state.reEntries || 0);

    const isBounty = state.tournamentType === 'bounty' || state.tournamentType === 'mystery bounty';
    const bPct = isBounty ? (state.bountyPercent != null ? Number(state.bountyPercent) : 50) : 0;
    const bPool = isBounty ? Math.round((newPrizePool * bPct) / 100) : 0;
    const rPool = isBounty ? newPrizePool - bPool : newPrizePool;

    const newPayouts = calculateTournamentPayouts({
      totalPlayers: totalEntries,
      buyIn: state.buyIn,
      totalPool: rPool,
      payoutConfig: state.payoutConfig,
      tablesCount: state.tablesCount,
      splitSimultaneousTies: state.splitSimultaneousTies,
    });

    state = {
      ...state,
      totalRebuys: newTotalRebuys,
      totalChips: newChips,
      totalPrizePool: newPrizePool,
      bountyPool: bPool,
      rankPool: rPool,
      payouts: newPayouts,
    };
    emit();
    return { success: true };
  },

  updateStructure: (updates) => {
    const totalPlayers = updates.totalPlayers != null ? Number(updates.totalPlayers) : state.totalPlayers;
    const startingStack = updates.startingStack != null ? Number(updates.startingStack) : state.startingStack;
    const tablesCount = updates.tablesCount != null ? Number(updates.tablesCount) : state.tablesCount;
    const buyIn = updates.buyIn != null ? Number(updates.buyIn) : state.buyIn;
    const currency = updates.currency || state.currency;
    const splitSimultaneousTies =
      updates.splitSimultaneousTies != null ? updates.splitSimultaneousTies : state.splitSimultaneousTies;
    const payoutConfig = updates.payoutConfig || state.payoutConfig;
    const lateRegEnabled = updates.lateRegEnabled != null ? updates.lateRegEnabled : state.lateRegEnabled;
    const lateRegLevel = updates.lateRegLevel != null ? Number(updates.lateRegLevel) : state.lateRegLevel;
    const tournamentType = updates.tournamentType || state.tournamentType || 'reentry';
    const maxReEntries = updates.maxReEntries != null ? Number(updates.maxReEntries) : state.maxReEntries;
    const rebuyCost = updates.rebuyCost != null ? Number(updates.rebuyCost) : (state.rebuyCost ?? buyIn);
    const rebuyChips = updates.rebuyChips != null ? Number(updates.rebuyChips) : (state.rebuyChips ?? startingStack);
    const rebuyRules = updates.rebuyRules || state.rebuyRules;
    const anteType = updates.anteType || state.anteType || 'bba';
    const chipDenominations = updates.chipDenominations || state.chipDenominations;
    const playerNames = updates.playerNames || (updates.players ? updates.players.map((p) => p.name) : []);

    const roster = generateRoster(playerNames, totalPlayers);
    const totalEntries = totalPlayers + (state.reEntries || 0);
    const totalChips = totalEntries * startingStack + (state.totalRebuys || 0) * rebuyChips;
    const totalPrize = totalEntries * buyIn + (state.totalRebuys || 0) * rebuyCost;

    const isBounty = tournamentType === 'bounty' || tournamentType === 'mystery bounty';
    const bPercent = isBounty ? (updates.bountyPercent != null ? Number(updates.bountyPercent) : (state.bountyPercent ?? 50)) : 0;
    const bPool = isBounty ? Math.round((totalPrize * bPercent) / 100) : 0;
    const rPool = isBounty ? totalPrize - bPool : totalPrize;

    const payouts = calculateTournamentPayouts({
      totalPlayers: totalEntries,
      buyIn,
      totalPool: rPool,
      payoutConfig,
      tablesCount,
      splitSimultaneousTies,
    });

    state = {
      ...state,
      name: updates.name || state.name,
      totalPlayers,
      startingStack,
      tablesCount,
      buyIn,
      currency,
      totalChips,
      totalPrizePool: totalPrize,
      bountyPercent: bPercent,
      bountyPool: bPool,
      rankPool: rPool,
      mysteryBountyConfig: updates.mysteryBountyConfig || state.mysteryBountyConfig,
      tournamentType,
      maxReEntries,
      rebuyCost,
      rebuyChips,
      rebuyRules,
      anteType,
      chipDenominations,
      players: roster,
      splitSimultaneousTies,
      payoutConfig,
      payouts,
      lateRegEnabled,
      lateRegLevel,
      clock: {
        ...state.clock,
        levelDurationMinutes:
          updates.levelDurationMinutes != null
            ? Number(updates.levelDurationMinutes)
            : state.clock.levelDurationMinutes,
        blindSchedule: updates.blindSchedule || state.clock.blindSchedule,
      },
    };
    emit();
  },

  loadTournament: (savedState) => {
    if (savedState) {
      state = {
        ...defaultMTT(),
        ...savedState,
        active: true,
      };
      emit();
    }
  },

  getTournaments: () => {
    const cat = loadCatalog();
    if (state?.id && state.active) {
      cat[state.id] = state;
    }
    return Object.values(cat)
      .filter((t) => t && t.id && t.active)
      .map((t) => {
        const sched = t.clock?.blindSchedule || [];
        const curLvl = t.clock?.level || 0;
        const lvlObj = sched[curLvl] || {};
        const isB = isBreak(lvlObj);
        let blindsText = '';
        if (isB) {
          blindsText = lvlObj.name || 'Break';
        } else if (lvlObj.smallBlind != null) {
          blindsText = `${lvlObj.smallBlind}/${lvlObj.bigBlind}${lvlObj.ante ? ` (ante ${lvlObj.ante})` : ''}`;
        } else {
          blindsText = `Level ${curLvl + 1}`;
        }

        return {
          id: t.id,
          name: t.name || 'Championship Tournament',
          active: !!t.active,
          isRunning: !!t.clock?.isRunning,
          level: curLvl,
          levelNumber: getLevelNum(sched, curLvl),
          blindsText,
          isBreak: isB,
          secondsLeft: t.clock?.secondsLeft ?? (t.clock?.levelDurationMinutes || 15) * 60,
          remainingPlayers: t.remainingPlayers ?? t.totalPlayers ?? 0,
          totalPlayers: t.totalPlayers ?? 0,
          buyIn: t.buyIn,
          currency: t.currency || '$',
          totalPrizePool: t.totalPrizePool || 0,
          updatedAt: t.updatedAt || Date.now(),
          createdAt: t.createdAt || Date.now(),
        };
      })
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },

  toggleTimerForTournament: (tournamentId) => {
    if (!tournamentId) return;
    if (state?.id === tournamentId) {
      mttStore.toggleTimer();
      return;
    }
    const cat = loadCatalog();
    if (cat[tournamentId]) {
      const tourney = cat[tournamentId];
      const isRunning = !tourney.clock?.isRunning;
      tourney.clock = {
        ...tourney.clock,
        isRunning,
      };
      tourney.updatedAt = Date.now();
      cat[tournamentId] = tourney;
      saveCatalog(cat);
      syncTicker();
      emit();
    }
  },

  switchTournament: (tournamentId) => {
    const cat = loadCatalog();
    if (state?.id && state.active) {
      cat[state.id] = state;
      saveCatalog(cat);
    }
    if (cat[tournamentId]) {
      state = cat[tournamentId];
      localStorage.setItem(STORAGE_KEY_ACTIVE_ID, tournamentId);
      syncTicker();
      emit();
      return true;
    }
    return false;
  },

  startNewTournament: () => {
    const cat = loadCatalog();
    if (state?.id && state.active) {
      cat[state.id] = state;
      saveCatalog(cat);
    }
    const activeTournaments = Object.values(cat).filter((t) => t && t.active);
    const newId = `mtt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    state = {
      ...defaultMTT(),
      id: newId,
      name: `Tournament ${activeTournaments.length + 1}`,
      active: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, newId);
    if (clockTickerInterval) {
      clearInterval(clockTickerInterval);
      clockTickerInterval = null;
    }
    emit();
    return newId;
  },

  deleteTournament: (tournamentId) => {
    const cat = loadCatalog();
    delete cat[tournamentId];
    saveCatalog(cat);
    if (state?.id === tournamentId) {
      const remaining = Object.values(cat).filter((t) => t && t.active);
      if (remaining.length > 0) {
        state = remaining[0];
        localStorage.setItem(STORAGE_KEY_ACTIVE_ID, state.id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        syncTicker();
      } else {
        state = defaultMTT();
        localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
        localStorage.removeItem(STORAGE_KEY);
        if (clockTickerInterval) {
          clearInterval(clockTickerInterval);
          clockTickerInterval = null;
        }
      }
    }
    emit();
  },

  resetTournament: () => {
    state = defaultMTT();
    emit();
  },
};

export function useMTT() {
  return useSyncExternalStore(mttStore.subscribe, mttStore.get, mttStore.get);
}
